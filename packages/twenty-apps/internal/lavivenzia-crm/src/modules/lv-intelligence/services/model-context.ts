import { type InteractionRecord, type LeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { LEAD_CATEGORIES, LEAD_CATEGORY_LABELS, LEAD_SUBCATEGORIES_BY_CATEGORY } from 'src/modules/lv-core/constants/lead-taxonomy';

// Turns a LeadContext into the smallest text a model needs for a given
// purpose. Privacy rules applied here, once:
//   - email and phone VALUES are never sent; only whether they exist
//   - member ids are replaced by "the owner" / "a team member"
//   - raw capture input, provenance JSON, duplicate keys and audit trails are
//     never sent
//   - free text is truncated (interaction notes 600 chars, notes 500)
//   - onboarding: identity documents, legal name, address line, PIN and
//     contact fields are excluded; only the descriptive answers go
// Every record that appears is listed with its id so citations can be
// checked against `sourceRecordIds`.

const clip = (value: string | null | undefined, max: number): string | null => {
  if (!value) {
    return null;
  }

  const clean = value.replace(/\s+/g, ' ').trim();

  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const line = (label: string, value: string | number | null | undefined): string | null => (value === null || value === undefined || value === '' ? null : `${label}: ${value}`);

export const leadBlock = (context: LeadContext): string => {
  const { lead } = context;
  const ref = lead.lvLeadId ?? lead.id;

  return [
    `LEAD ${ref} (id ${lead.id})`,
    line('Name', lead.name),
    line('Organisation', lead.organisationName),
    line('Category', lead.category ? `${lead.category}${lead.subcategory ? ` / ${lead.subcategory}` : ''}` : null),
    line('Location', lead.location),
    line('Source', lead.source),
    line('Status', lead.status),
    line('Priority', lead.priority),
    line('Languages', lead.languages?.join(', ') || null),
    line('Contact channels', `${lead.emails?.primaryEmail ? 'email on file' : 'no email'}, ${lead.phones?.primaryPhoneNumber ? 'phone on file' : 'no phone'}`),
    line('Website', lead.website?.primaryLinkUrl ? 'on file' : null),
    line('Instagram', lead.instagram?.primaryLinkUrl ? 'on file' : null),
    line('Data completeness', lead.dataCompleteness !== null ? `${lead.dataCompleteness}%` : null),
    line('Owner', lead.ownerId ? 'assigned to a team member' : 'unassigned'),
    line('Next action (recorded)', clip(lead.nextAction, 200)),
    line('Next follow-up', lead.nextFollowUpAt?.slice(0, 10)),
    line('Last interaction', lead.lastInteractionAt?.slice(0, 10)),
    line('Onboarding status', lead.onboardingStatus),
    line('Created', lead.createdAt.slice(0, 10)),
  ]
    .filter((part): part is string => part !== null)
    .join('\n');
};

export const interactionLine = (row: InteractionRecord, maxNotes = 600): string =>
  [
    `- interaction #${row.id} ${row.occurredAt?.slice(0, 16) ?? ''} ${row.direction ?? ''} ${row.channel ?? ''}`,
    line('purpose', row.purpose),
    line('outcome', row.outcome),
    line('sentiment (recorded)', row.sentiment),
    line('notes', clip(row.summary, maxNotes)),
    line('objections (recorded)', clip(row.objections, 200)),
    line('commitments (recorded)', clip(row.commitments, 200)),
    line('next action (recorded)', clip(row.nextAction, 160)),
    line('next follow-up', row.nextFollowUpAt?.slice(0, 10)),
  ]
    .filter((part): part is string => part !== null)
    .join(' | ');

export const activityBlock = (context: LeadContext): string => {
  const parts: string[] = [];

  if (context.interactions.length > 0) {
    parts.push('INTERACTIONS (newest first)', ...context.interactions.map((row) => interactionLine(row)));
  } else {
    parts.push('INTERACTIONS: none recorded');
  }

  if (context.tasks.length > 0) {
    parts.push('TASKS', ...context.tasks.map((task) => `- task #${task.id} "${clip(task.title, 120) ?? 'Untitled'}" status ${task.status ?? '—'} due ${task.dueAt?.slice(0, 10) ?? 'no date'}`));
  } else {
    parts.push('TASKS: none');
  }

  if (context.notes.length > 0) {
    parts.push('NOTES', ...context.notes.map((note) => `- note #${note.id} "${clip(note.title, 80) ?? 'Untitled'}": ${clip(note.body, 500) ?? '(empty)'}`));
  }

  const openSlas = context.slas.filter((sla) => sla.status && !['RESOLVED'].includes(sla.status));

  if (openSlas.length > 0) {
    parts.push('SLAS', ...openSlas.map((sla) => `- sla #${sla.id} ${sla.rule ?? ''} ${sla.status ?? ''} due ${sla.dueAt?.slice(0, 10) ?? '—'}`));
  }

  if (context.onboarding) {
    const onboarding = context.onboarding;

    parts.push(
      `ONBOARDING #${onboarding.id} status ${onboarding.status ?? '—'} step ${onboarding.currentStep ?? '—'} progress ${onboarding.progressPercentage ?? '—'}%`,
      ...onboarding.documents.map((doc) => `- document #${doc.id} ${doc.documentType ?? ''} ${doc.verificationState ?? ''}${doc.rejectionReason ? ` (rejected: ${clip(doc.rejectionReason, 120)})` : ''}`),
    );
  }

  if (context.problems.length > 0) {
    parts.push('PROBLEMS', ...context.problems.map((problem) => `- problem #${problem.id} ${problem.problemType ?? ''} ${problem.severity ?? ''} ${problem.status ?? ''}: ${clip(problem.name, 120) ?? ''}`));
  }

  return parts.join('\n');
};

export const summaryContext = (context: LeadContext): string => `${leadBlock(context)}\n\n${activityBlock(context)}`;

export const classificationContext = (context: LeadContext): string => {
  const allowed = LEAD_CATEGORIES.map((category) => `${category} (${LEAD_CATEGORY_LABELS[category]}): sub-categories ${LEAD_SUBCATEGORIES_BY_CATEGORY[category].join(', ') || 'none'}`).join('\n');
  // Raw capture input is deliberately NOT part of the evidence: it is whatever
  // the hunter pasted and can carry an email, a phone number or a URL. The
  // structured lead block (name, organisation, location, source, website /
  // Instagram presence) plus recorded notes is the classification evidence.
  const texts = [
    ...context.interactions.slice(0, 3).map((row) => (row.summary ? `Interaction #${row.id} notes: ${clip(row.summary, 300)}` : null)),
    ...context.notes.slice(0, 2).map((note) => (note.body ? `Note #${note.id}: ${clip(note.body, 300)}` : null)),
  ].filter((part): part is string => part !== null);

  return `ALLOWED CATEGORIES\n${allowed}\n\n${leadBlock(context)}\n\nTEXT EVIDENCE\n${texts.length > 0 ? texts.join('\n') : 'none'}`;
};

export const conversationContext = (context: LeadContext, interaction: InteractionRecord): string => {
  const related = context.interactions.filter((row) => row.id !== interaction.id).slice(0, 4);

  return [
    leadBlock(context),
    '',
    'INTERACTION TO SUMMARISE',
    interactionLine(interaction, 2_000),
    '',
    related.length > 0 ? `RECENT RELATED INTERACTIONS\n${related.map((row) => interactionLine(row, 300)).join('\n')}` : 'RECENT RELATED INTERACTIONS: none',
    '',
    `Today is ${context.loadedAt.slice(0, 10)}.`,
  ].join('\n');
};

export const draftContext = (context: LeadContext, options: { kind: string; tone: string; senderFirstName: string | null; instructions: string | null }): string =>
  [
    `DRAFT KIND: ${options.kind}`,
    `TONE: ${options.tone}`,
    `SENDER FIRST NAME: ${options.senderFirstName ?? 'not available'}`,
    options.instructions ? `EXTRA INSTRUCTIONS FROM THE SENDER: ${clip(options.instructions, 400)}` : null,
    '',
    leadBlock(context),
    '',
    context.interactions.length > 0 ? `RECENT INTERACTIONS\n${context.interactions.slice(0, 4).map((row) => interactionLine(row, 300)).join('\n')}` : 'RECENT INTERACTIONS: none',
    context.onboarding ? `\nONBOARDING status ${context.onboarding.status ?? '—'}; documents: ${context.onboarding.documents.map((doc) => `${doc.documentType ?? ''} ${doc.verificationState ?? ''}`).join(', ') || 'none'}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join('\n');

// Onboarding answers minimised to descriptive content only.
const ONBOARDING_ALLOWED: Record<string, string[]> = {
  ABOUT_YOU: ['bio', 'yearsOfExperience'],
  EXPERIENCE: ['title', 'description', 'category', 'durationMinutes', 'capacity', 'inclusions'],
  LOCATION: ['city', 'state', 'country', 'directions'],
  PRICING: ['basePrice', 'priceUnit', 'minimumGuests', 'additionalCharges'],
  AVAILABILITY: ['availableDays', 'noticePeriodHours', 'seasonalNotes'],
  BASIC_INFORMATION: ['displayName', 'organisationName', 'languages'],
};

export const onboardingAssistContext = (context: LeadContext, request: { field: string | null; text: string | null }): string => {
  const answers = context.onboarding?.answers ?? {};
  const lines: string[] = [];

  for (const [step, fields] of Object.entries(ONBOARDING_ALLOWED)) {
    const stepAnswers = answers[step];

    if (!stepAnswers || typeof stepAnswers !== 'object') {
      continue;
    }

    for (const field of fields) {
      const value = (stepAnswers as Record<string, unknown>)[field];

      if (value === null || value === undefined || value === '') {
        continue;
      }

      lines.push(`${step}.${field}: ${clip(Array.isArray(value) ? value.join(', ') : String(value), 800)}`);
    }
  }

  return [
    `LEAD ${context.lead.lvLeadId ?? context.lead.id}: ${context.lead.name ?? ''}${context.lead.organisationName ? ` (${context.lead.organisationName})` : ''}`,
    context.onboarding ? `ONBOARDING #${context.onboarding.id} status ${context.onboarding.status ?? '—'}` : 'ONBOARDING: none',
    '',
    'PARTNER-PROVIDED ANSWERS (USER PROVIDED — the only facts you may use)',
    lines.length > 0 ? lines.join('\n') : 'none submitted yet',
    '',
    request.text ? `TEXT TO IMPROVE (${request.field ?? 'free text'}):\n${clip(request.text, 3_000)}` : 'No text to improve; only review the answers for missing information, inconsistencies and questions.',
  ].join('\n');
};
