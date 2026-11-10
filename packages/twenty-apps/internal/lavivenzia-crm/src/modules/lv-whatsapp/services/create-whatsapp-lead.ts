import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  type CaptureProvenance,
  draftFor,
  findLeadByCaptureKey,
  leadCreateData,
} from 'src/modules/lv-capture/services/capture-service';
import { readCaptureInput } from 'src/modules/lv-capture/services/capture-request';
import { type ParsedWhatsAppMessage } from 'src/modules/lv-whatsapp/utils/parse-whatsapp-message';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

export type CreateWhatsAppLeadResult =
  | {
      ok: true;
      leadId: string;
      lvLeadId: string | null;
      personId?: string | null;
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
  if (parsed.isTripConfirmation) {
    const lines: string[] = ['Inbound Curated Trip Confirmation (Trip Butler):'];

    if (parsed.tripTitle) {
      lines.push(`• Trip: ${parsed.tripTitle}`);
    }

    if (parsed.bookingReference) {
      lines.push(`• Booking Reference: ${parsed.bookingReference}`);
    }

    if (parsed.guestCount) {
      lines.push(`• Party size: ${parsed.guestCount}`);
    }

    if (parsed.tripRegion) {
      lines.push(`• Region: ${parsed.tripRegion}`);
    }

    if (parsed.zoneLabel) {
      lines.push(`• Pilot Zone: ${parsed.zoneLabel}`);
    }

    lines.push('');
    lines.push('Raw message:');
    lines.push(parsed.rawText);

    return lines.join('\n');
  }

  const lines: string[] = ['Inbound WhatsApp Inquiry:'];

  if (parsed.zoneLabel) {
    lines.push(`• Zone: ${parsed.zoneLabel}`);
  }

  if (parsed.destinationCorridor) {
    lines.push(`• Corridor: ${parsed.destinationCorridor}`);
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

  const notes = formatWhatsAppLeadNotes(parsedMessage);
  const location = parsedMessage.zoneLabel
    ? `${parsedMessage.zoneLabel}, Pune`
    : (parsedMessage.destination || 'Pune');

  // Integrate through canonical readCaptureInput validation pipeline
  const captureParsed = readCaptureInput({
    method: 'API',
    fields: {
      name: leadName,
      phone: parsedMessage.fromPhone,
      pilotZone: parsedMessage.zone,
      location,
      rawInput: parsedMessage.rawText,
      notes,
      source: 'WHATSAPP',
      category: parsedMessage.isTripConfirmation ? 'EXPERIENCE' : undefined,
      subcategory: parsedMessage.isTripConfirmation ? 'CURATOR' : undefined,
      priority: parsedMessage.isTripConfirmation ? 'HIGH' : 'MEDIUM',
      isHumanConfirmed: false,
    },
  });

  if (!captureParsed.ok) {
    return {
      ok: false,
      error: 'Failed to construct lead draft',
      detail: captureParsed.error,
    };
  }

  const built = draftFor(captureParsed.input);

  if (!built.ok) {
    return {
      ok: false,
      error: 'Failed to construct lead draft',
      detail: built.errors.join('; '),
    };
  }

  const draft = built.draft;

  // Inbound webhook is automated: verification must be UNCONFIRMED until reviewed by a person
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
    verification: 'UNCONFIRMED',
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
  let lvLeadId: string | null = null;

  try {
    const created = await application.mutation({
      createLvLead: {
        __args: { data: payload },
        id: true,
        lvLeadId: true,
      },
    });

    const leadRecord = (created as { createLvLead?: { id?: string; lvLeadId?: string | null } })
      ?.createLvLead;

    leadId = leadRecord?.id ?? null;
    lvLeadId = leadRecord?.lvLeadId ?? null;
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

  // Find or create Person record in Twenty CRM
  let personId: string | null = null;

  try {
    const cleanPhone = parsedMessage.fromPhone.replace(/\D/g, '');
    const isIndia = cleanPhone.length === 12 && cleanPhone.startsWith('91') || cleanPhone.length === 10;
    const countryCode = isIndia ? 'IN' : '';
    const callingCode = isIndia ? '+91' : '';

    const existingPerson = (await application.query({
      people: {
        __args: {
          first: 1,
          filter: {
            phones: {
              primaryPhoneNumber: {
                ilike: parsedMessage.fromPhone.replace(/[%_]/g, ''),
              },
            },
          },
        },
        edges: { node: { id: true } },
      },
    })) as { people?: { edges?: { node: { id: string } }[] } };

    const person = existingPerson.people?.edges?.[0]?.node;

    if (person) {
      personId = person.id;
    } else {
      const [firstName, ...rest] = (
        parsedMessage.senderName || 'WhatsApp Contact'
      ).split(/\s+/);

      const createdPerson = (await application.mutation({
        createPerson: {
          __args: {
            data: {
              name: { firstName: firstName ?? '', lastName: rest.join(' ') },
              phones: {
                primaryPhoneNumber: parsedMessage.fromPhone,
                primaryPhoneCountryCode: countryCode,
                primaryPhoneCallingCode: callingCode,
                additionalPhones: null,
              },
            },
          },
          id: true,
        },
      })) as { createPerson?: { id: string } };

      personId = createdPerson.createPerson?.id ?? null;
    }
  } catch (err) {
    console.warn('[lv-whatsapp] Person lookup/creation failed:', describeError(err));
    personId = null;
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
      destination: parsedMessage.destination,
      corridor: parsedMessage.destinationCorridor,
      guestCount: parsedMessage.guestCount,
      budget: parsedMessage.budget,
      cravings: parsedMessage.cravings,
      isTripConfirmation: parsedMessage.isTripConfirmation,
      bookingReference: parsedMessage.bookingReference,
      personId,
    },
  });

  return {
    ok: true,
    leadId,
    lvLeadId,
    personId,
    replayed: false,
  };
};
