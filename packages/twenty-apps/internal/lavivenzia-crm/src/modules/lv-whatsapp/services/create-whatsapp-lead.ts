import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  type CaptureProvenance,
  draftFor,
  findLeadByCaptureKey,
  leadCreateData,
} from 'src/modules/lv-capture/services/capture-service';
import { type ParsedWhatsAppMessage } from 'src/modules/lv-whatsapp/utils/parse-whatsapp-message';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

export type CreateWhatsAppLeadResult =
  | {
      ok: true;
      leadId: string;
      lvLeadId: string | null;
      replayed: boolean;
    }
  | {
      ok: false;
      error: string;
      detail?: string;
    };

export const formatWhatsAppLeadNotes = (
  parsed: ParsedWhatsAppMessage,
): string => {
  const lines: string[] = ['Inbound WhatsApp Inquiry:'];

  if (parsed.zoneLabel) {
    lines.push(`• Zone: ${parsed.zoneLabel}`);
  }

  if (parsed.guestCount) {
    lines.push(`• Guest count: ${parsed.guestCount}`);
  }

  if (parsed.budgetFormatted) {
    lines.push(`• Budget: ${parsed.budgetFormatted}`);
  }

  if (parsed.cravings.length > 0) {
    lines.push(`• Cravings: ${parsed.cravings.join(', ')}`);
  }

  lines.push('');
  lines.push('Raw message:');
  lines.push(parsed.rawText);

  return lines.join('\n');
};

export const createWhatsAppLead = async ({
  parsedMessage,
  applicationClient,
  now = new Date().toISOString(),
}: {
  parsedMessage: ParsedWhatsAppMessage;
  applicationClient?: CoreApiClient;
  now?: string;
}): Promise<CreateWhatsAppLeadResult> => {
  const application =
    applicationClient ?? new CoreApiClient({ runAs: 'application' });
  const captureKey = `whatsapp:${parsedMessage.wamid}`;

  // Idempotency: return existing lead if already processed for this wamid
  const existing = await findLeadByCaptureKey(application, captureKey);

  if (existing) {
    return {
      ok: true,
      leadId: existing.id,
      lvLeadId: existing.lvLeadId,
      replayed: true,
    };
  }

  const leadName =
    parsedMessage.senderName || `WhatsApp Lead (${parsedMessage.fromPhone})`;

  const built = draftFor({
    captureMode: 'API',
    source: 'WHATSAPP',
    name: leadName,
    phone: parsedMessage.fromPhone,
    pilotZone: parsedMessage.zone,
    location: parsedMessage.zoneLabel
      ? `${parsedMessage.zoneLabel}, Pune`
      : 'Pune',
    rawInput: parsedMessage.rawText,
    priority: 'MEDIUM',
    isHumanConfirmed: true,
  });

  if (!built.ok) {
    return {
      ok: false,
      error: 'Failed to construct lead draft',
      detail: built.errors.join('; '),
    };
  }

  const draft = built.draft;

  const provenance: CaptureProvenance = {
    method: 'API',
    platform: 'WHATSAPP',
    originalUrl: null,
    originalHandle: parsedMessage.fromPhone,
    capturedAt: now,
    capturedById: null, // automated inbound webhook
    extraction: {
      status: 'NOT_APPLICABLE',
      kind: null,
      runId: null,
      fieldCount: 0,
    },
    classification: {
      status: 'NOT_RUN',
      runId: null,
    },
    verification: 'CONFIRMED_BY_PERSON',
    duplicateDecision: {
      decision: 'NONE',
      candidateLeadIds: [],
    },
    captureKey,
  };

  const payload = leadCreateData(draft, provenance, {
    ownerId: null, // Left unassigned so lvLead.created trigger routes via smart assignment engine
    attachment: null,
  });

  let leadId: string | null = null;

  try {
    const created = await application.mutation({
      createLvLead: {
        __args: { data: payload },
        id: true,
      },
    });

    leadId =
      (created as { createLvLead?: { id?: string } })?.createLvLead?.id ?? null;
  } catch (error) {
    const message = describeError(error);

    // If another worker/request created the lead simultaneously, handle race
    if (/duplicate|unique|already exists/i.test(message)) {
      const winner = await findLeadByCaptureKey(application, captureKey);

      if (winner) {
        return {
          ok: true,
          leadId: winner.id,
          lvLeadId: winner.lvLeadId,
          replayed: true,
        };
      }
    }

    return {
      ok: false,
      error: 'Failed to save lead in CRM',
      detail: message.slice(0, 160),
    };
  }

  if (!leadId) {
    return {
      ok: false,
      error: 'Lead record ID was not returned by CRM',
    };
  }

  // Create note on the lead with the structured details
  const noteBody = formatWhatsAppLeadNotes(parsedMessage);

  try {
    const createdNote = await application.mutation({
      createNote: {
        __args: {
          data: {
            title: `WhatsApp inquiry: ${leadName}`,
            bodyV2: { markdown: noteBody },
          },
        },
        id: true,
      },
    });

    const noteId =
      (createdNote as { createNote?: { id?: string } })?.createNote?.id ?? null;

    if (noteId) {
      await application.mutation({
        createNoteTarget: {
          __args: {
            data: {
              noteId,
              targetLvLeadId: leadId,
            },
          },
          id: true,
        },
      });
    }
  } catch (noteError) {
    // Non-fatal if note target attachment fails
    console.warn('[lv-whatsapp] capture note creation failed:', describeError(noteError));
  }

  // Record audit trail event
  await writeAuditEvent(application, {
    action: 'LEAD_CREATED',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: leadId,
    targetLabel: draft.name,
    actorWorkspaceMemberId: null,
    at: now,
    reason: 'Inbound WhatsApp webhook',
    metadata: {
      source: 'WHATSAPP',
      wamid: parsedMessage.wamid,
      fromPhone: parsedMessage.fromPhone,
      zone: parsedMessage.zone,
      guestCount: parsedMessage.guestCount,
      budget: parsedMessage.budget,
      cravings: parsedMessage.cravings,
    },
  });

  return {
    ok: true,
    leadId,
    lvLeadId: null,
    replayed: false,
  };
};
