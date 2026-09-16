import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ECOSYSTEM_CREATE_ID } from 'src/constants/universal-identifiers';
import { isLeadCategory, LEAD_SUBCATEGORIES_BY_CATEGORY } from 'src/modules/lv-core/constants/lead-taxonomy';
import { PROPERTY_TYPE_OPTIONS } from 'src/modules/lv-core/constants/partner-options';
import { allocateCodeFor, type EcosystemKind, loadListingsForPartner, loadPartner, OBJECT_OF } from 'src/modules/lv-core/services/ecosystem-service';
import { findDuplicates } from 'src/modules/lv-core/utils/duplicate-detection';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /ecosystem/create { kind: 'experience' | 'property' | 'partner', partnerId?, fields, duplicateDecision?: 'CREATE_NEW' }
//
// Creates an ecosystem record by hand — an experience or property for an
// existing partner from Partner 360, or (administrators / operations) a
// partner ahead of an onboarding. Written AS THE CALLER, so the platform's
// object permission is the gate; the code is allocated server-side; the
// duplicate check (same partner, similar name / same location) runs BEFORE
// the write and refuses until the person decides CREATE_NEW — the Day 6
// human-decision model, not a silent merge.

type Input = { kind?: unknown; partnerId?: unknown; fields?: unknown; duplicateDecision?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (value: unknown, max = 500): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null);

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can create ecosystem records.' };
  }

  const kind = (['experience', 'property', 'partner'] as EcosystemKind[]).find((candidate) => candidate === input.kind);
  const fields = typeof input.fields === 'object' && input.fields !== null ? (input.fields as Record<string, unknown>) : {};
  const name = str(fields.name, 200);

  if (!kind || !name) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'kind and a name are required.' };
  }

  const delegated = new DelegatedGraphqlClient();
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const meta = OBJECT_OF[kind];

  try {
    const caller = await resolveCaller(delegated);

    if (caller.workspaceMemberId === null) {
      return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can create ecosystem records.' };
    }

    if (!(caller.isAdmin || caller.objectPermissions[meta.singular]?.update === true)) {
      return { ok: false, refusal: 'NOT_PERMITTED', error: `Your role cannot create ${meta.label.toLowerCase()} records.` };
    }

    const location = str(fields.location, 200);
    let data: Record<string, unknown>;
    let partnerId: string | null = null;

    if (kind === 'partner') {
      const category = str(fields.category);

      data = {
        name,
        status: 'PROSPECTIVE',
        sourceKey: `manual:${crypto.randomUUID()}`,
        category: category && isLeadCategory(category) ? category : null,
        partnerType: str(fields.partnerType) ?? 'OTHER',
        location,
        ownerId: caller.workspaceMemberId,
        provenance: { source: 'MANUAL', createdById: caller.workspaceMemberId, createdAt: now },
      };

      // Duplicate partners: same name (normalised) anywhere.
      const { data: existing } = await delegated.query<{ lvPartners?: { edges: { node: { id: string; name: string | null; partnerCode: string | null; location: string | null } }[] } }>(`query($name: String!) { lvPartners(first: 10, filter: { name: { ilike: $name } }) { edges { node { id name partnerCode location } } } }`, { name: `%${name.replace(/[%_]/g, '')}%` });
      const matches = findDuplicates({ id: '', name, organisationName: name, location }, (existing.lvPartners?.edges ?? []).map(({ node }) => ({ id: node.id, name: node.name, organisationName: node.name, location: node.location })));

      if (matches.length > 0 && input.duplicateDecision !== 'CREATE_NEW') {
        return { ok: false, refusal: 'DUPLICATE_UNDECIDED', error: 'A partner with a similar name already exists.', duplicates: matches.map((match) => ({ id: match.recordId, percent: match.percent, reasons: match.reasons, ...(existing.lvPartners?.edges.find(({ node }) => node.id === match.recordId)?.node ?? {}) })) };
      }
    } else {
      if (typeof input.partnerId !== 'string' || !UUID.test(input.partnerId)) {
        return { ok: false, refusal: 'INVALID_INPUT', error: 'partnerId is required.' };
      }

      const partner = await loadPartner(delegated, input.partnerId);

      if (!partner || partner.deletedAt) {
        return { ok: false, refusal: 'NOT_FOUND', error: 'Partner not found.' };
      }

      if (partner.status === 'OFFBOARDED') {
        return { ok: false, refusal: 'NOT_ALLOWED', error: 'An offboarded partner cannot take new records.' };
      }

      partnerId = partner.id;

      // Duplicate listings under the same partner: similar name or same location + name.
      const siblings = await loadListingsForPartner(delegated, kind, partner.id);
      const matches = findDuplicates({ id: '', name, organisationName: null, location }, siblings.map((row) => ({ id: row.id, name: row.name, organisationName: null, location: row.location })));

      if (matches.length > 0 && input.duplicateDecision !== 'CREATE_NEW') {
        return { ok: false, refusal: 'DUPLICATE_UNDECIDED', error: `This partner already has a similar ${kind}.`, duplicates: matches.map((match) => { const row = siblings.find((candidate) => candidate.id === match.recordId); return { id: match.recordId, percent: match.percent, reasons: match.reasons, name: row?.name ?? null, code: row?.code ?? null, status: row?.status ?? null, location: row?.location ?? null }; }) };
      }

      const category = str(fields.category);
      const subcategory = str(fields.subcategory);
      const price = num(fields.basePrice);

      data = {
        name,
        status: 'DRAFT',
        sourceKey: `manual:${crypto.randomUUID()}`,
        partnerId: partner.id,
        ownerId: caller.workspaceMemberId,
        location: location ?? partner.location,
        description: str(fields.description, 4000),
        capacity: num(fields.capacity),
        priceUnit: str(fields.priceUnit, 60),
        ...(price !== null ? { basePrice: { amountMicros: Math.round(price * 1_000_000), currencyCode: 'INR' } } : {}),
        ...(kind === 'experience'
          ? { category: category && isLeadCategory(category) ? category : (partner.category ?? 'EXPERIENCE'), subcategory: category && isLeadCategory(category) && subcategory && (LEAD_SUBCATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(subcategory) ? subcategory : null, durationMinutes: num(fields.durationMinutes), hostName: str(fields.hostName, 120), hostId: partner.contactId }
          : { propertyType: PROPERTY_TYPE_OPTIONS.some((option) => option.value === fields.propertyType) ? fields.propertyType : 'OTHER', rooms: num(fields.rooms), streetAddress: str(fields.address, 300), managerId: partner.contactId }),
      };
    }

    const { data: created, errors } = await delegated.query<Record<string, { id: string } | null>>(
      `mutation($data: ${kind === 'partner' ? 'LvPartnerCreateInput' : kind === 'experience' ? 'LvExperienceCreateInput' : 'LvPropertyCreateInput'}!) { ${kind === 'partner' ? 'createLvPartner' : kind === 'experience' ? 'createLvExperience' : 'createLvProperty'}(data: $data) { id } }`,
      { data },
    );
    const record = created[kind === 'partner' ? 'createLvPartner' : kind === 'experience' ? 'createLvExperience' : 'createLvProperty'];

    if (errors.length > 0 || !record) {
      return { ok: false, refusal: 'NOT_PERMITTED', error: errors[0]?.message ?? 'The platform refused the create.' };
    }

    const code = await allocateCodeFor(application, kind, { id: record.id, code: null });

    await writeAuditEvent(application, {
      action: kind === 'partner' ? 'PARTNER_CREATED' : kind === 'experience' ? 'EXPERIENCE_CREATED' : 'PROPERTY_CREATED',
      outcome: 'APPLIED',
      targetObject: meta.singular,
      targetRecordId: record.id,
      targetLabel: name,
      actorWorkspaceMemberId: caller.workspaceMemberId,
      at: now,
      reason: 'Created by hand',
      metadata: { partnerId, code, duplicateDecision: input.duplicateDecision === 'CREATE_NEW' ? 'CREATE_NEW' : 'NONE' },
    });

    return { ok: true, id: record.id, code, kind, partnerId };
  } catch (error) {
    console.error('[lv-ecosystem] create failed:', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The record could not be created. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_ECOSYSTEM_CREATE_ID,
  name: 'lv-ecosystem-create',
  description: 'Creates a partner, experience or property by hand as the caller, with a server-allocated code, a duplicate check before the write and an audit row',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/ecosystem/create', httpMethod: 'POST', isAuthRequired: true },
});
