// Every production prompt, in one place, with a version in its id. The
// version is stored on each generated insight and run; change the wording or
// the schema and you increment it here — never edit a version in place.
//
// Shared rules are prepended to every system prompt: ground everything in the
// supplied CRM context, never invent, say "not available in CRM data" when a
// fact is missing, and cite record ids the context actually contains.

import { type OutputValidator } from 'src/modules/lv-ai/provider/ai-provider';
import { confidence01, isRecord, objectValidator, oneOf, optionalString, requiredString, stringList } from 'src/modules/lv-ai/provider/structured-output';

export const GROUNDING_RULES = [
  'You are the AI assistant inside La Vivenzia CRM, a relationship system for experience and stay partners in India.',
  'Use ONLY the CRM context provided in the user message. Never invent names, contact details, prices, availability, policies, certifications, documents, dates or conversations.',
  'When something is not present in the context, say exactly that it is not available in CRM data. Do not guess.',
  'Refer to records by the ids given in the context (lead LV-000123, interaction #id, task #id). Never cite a record that is not in the context.',
  'Be concise and operational. No motivational filler. No emojis.',
].join('\n');

export type PromptDefinition<T> = {
  id: string;
  purpose: string;
  system: string;
  maxOutputTokens: number;
  temperature: number;
  validate: OutputValidator<T>;
};

// ---------------------------------------------------------------- lead summary
export type LeadSummaryOutput = {
  overview: string;
  currentRelationship: string;
  recentActivity: string[];
  openItems: string[];
  risks: string[];
  nextBestAction: string;
  insufficientData: boolean;
  citedRecordIds: string[];
};

export const LEAD_SUMMARY_PROMPT: PromptDefinition<LeadSummaryOutput> = {
  id: 'lead-summary-v1',
  purpose: 'Summarise a lead and its relationship from CRM records',
  system: `${GROUNDING_RULES}
Write a lead summary answering: who is this, what do they do, what do they want, what has happened, what is pending, what are the important problems, what should happen next.
Respond with JSON only:
{"overview": string, "currentRelationship": string, "recentActivity": string[], "openItems": string[], "risks": string[], "nextBestAction": string, "insufficientData": boolean, "citedRecordIds": string[]}
If the context has fewer than two meaningful facts beyond the lead's name, set insufficientData to true and write "Insufficient CRM data." in overview.
citedRecordIds must list only ids that appear in the context.`,
  maxOutputTokens: 700,
  temperature: 0.2,
  validate: objectValidator((record) => {
    const overview = requiredString(record.overview, 1_200);

    if (!overview) {
      return 'overview is required.';
    }

    return {
      overview,
      currentRelationship: optionalString(record.currentRelationship, 800) ?? 'Not available in CRM data.',
      recentActivity: stringList(record.recentActivity, 8),
      openItems: stringList(record.openItems, 8),
      risks: stringList(record.risks, 6),
      nextBestAction: optionalString(record.nextBestAction, 400) ?? 'Not available in CRM data.',
      insufficientData: record.insufficientData === true,
      citedRecordIds: stringList(record.citedRecordIds, 30, 80),
    };
  }),
};

// ------------------------------------------------------------- classification
export type ClassificationOutput = {
  category: string | null;
  subcategory: string | null;
  confidence: number | null;
  reasoning: string;
  evidence: string[];
  ambiguity: string[];
};

export const LEAD_CLASSIFICATION_PROMPT: PromptDefinition<ClassificationOutput> = {
  id: 'lead-classification-v1',
  purpose: 'Suggest a category and sub-category for a lead',
  system: `${GROUNDING_RULES}
Classify the lead into one of the allowed categories and, where the evidence supports it, one of that category's allowed sub-categories (both lists are in the context). Use null when the evidence is insufficient — do not force a classification.
Respond with JSON only:
{"category": string|null, "subcategory": string|null, "confidence": number 0..1, "reasoning": string, "evidence": string[], "ambiguity": string[]}
evidence quotes the context fields that support the choice; ambiguity lists what would change the answer.`,
  maxOutputTokens: 400,
  temperature: 0.1,
  validate: objectValidator((record) => ({
    category: optionalString(record.category, 80)?.toUpperCase() ?? null,
    subcategory: optionalString(record.subcategory, 80)?.toUpperCase() ?? null,
    confidence: confidence01(record.confidence),
    reasoning: optionalString(record.reasoning, 800) ?? '',
    evidence: stringList(record.evidence, 8),
    ambiguity: stringList(record.ambiguity, 6),
  })),
};

// ------------------------------------------------------- conversation summary
export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED', 'UNCLEAR'] as const;

export const OBJECTION_CATEGORIES = [
  'PRICING',
  'TIMING',
  'AVAILABILITY',
  'TRUST',
  'DOCUMENTATION',
  'LOCATION',
  'SERVICE',
  'COMMERCIAL_TERMS',
  'OTHER',
] as const;

export type ObjectionCategory = (typeof OBJECTION_CATEGORIES)[number];

export const PROBLEM_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type ConversationSummaryOutput = {
  summary: string;
  sentiment: (typeof SENTIMENTS)[number];
  keyPoints: string[];
  commitments: { text: string; certainty: 'CERTAIN' | 'UNCERTAIN' }[];
  objections: { category: ObjectionCategory; text: string; confidence: number | null; evidence: string }[];
  nextAction: string | null;
  followUpDateSuggestion: string | null;
  unresolvedQuestions: string[];
  problemSuggestions: {
    type: ObjectionCategory;
    severity: (typeof PROBLEM_SEVERITIES)[number];
    description: string;
    rootCauseHypothesis: string | null;
    suggestedResolution: string | null;
  }[];
  insufficientData: boolean;
};

export const CONVERSATION_SUMMARY_PROMPT: PromptDefinition<ConversationSummaryOutput> = {
  id: 'conversation-summary-v1',
  purpose: 'Summarise an interaction, extract objections, commitments and problem candidates',
  system: `${GROUNDING_RULES}
Summarise the interaction in the context (its own notes plus recent related interactions). Sentiment is a suggestion from the wording, not a diagnosis — use UNCLEAR when the text does not show it. A commitment is only CERTAIN when the text states it plainly; otherwise UNCERTAIN. Objections are business concerns; use category OTHER with an explanation when none fits. Problem suggestions are candidates for a human to confirm — never more than three, only when the text shows a real problem.
Respond with JSON only:
{"summary": string, "sentiment": "POSITIVE"|"NEUTRAL"|"NEGATIVE"|"MIXED"|"UNCLEAR", "keyPoints": string[], "commitments": [{"text": string, "certainty": "CERTAIN"|"UNCERTAIN"}], "objections": [{"category": one of ${OBJECTION_CATEGORIES.join('|')}, "text": string, "confidence": number 0..1, "evidence": string}], "nextAction": string|null, "followUpDateSuggestion": "YYYY-MM-DD"|null, "unresolvedQuestions": string[], "problemSuggestions": [{"type": one of ${OBJECTION_CATEGORIES.join('|')}, "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "description": string, "rootCauseHypothesis": string|null, "suggestedResolution": string|null}], "insufficientData": boolean}
If the interaction has no notes or summary text, set insufficientData true and keep every list empty.`,
  maxOutputTokens: 800,
  temperature: 0.2,
  validate: objectValidator((record) => {
    const summary = requiredString(record.summary, 1_200);

    if (!summary) {
      return 'summary is required.';
    }

    const commitments = Array.isArray(record.commitments)
      ? record.commitments
          .filter(isRecord)
          .map((item) => ({ text: optionalString(item.text, 300) ?? '', certainty: item.certainty === 'CERTAIN' ? ('CERTAIN' as const) : ('UNCERTAIN' as const) }))
          .filter((item) => item.text.length > 0)
          .slice(0, 8)
      : [];
    const objections = Array.isArray(record.objections)
      ? record.objections
          .filter(isRecord)
          .map((item) => ({
            category: oneOf(item.category, OBJECTION_CATEGORIES) ?? ('OTHER' as ObjectionCategory),
            text: optionalString(item.text, 300) ?? '',
            confidence: confidence01(item.confidence),
            evidence: optionalString(item.evidence, 300) ?? '',
          }))
          .filter((item) => item.text.length > 0)
          .slice(0, 8)
      : [];
    const problemSuggestions = Array.isArray(record.problemSuggestions)
      ? record.problemSuggestions
          .filter(isRecord)
          .map((item) => ({
            type: oneOf(item.type, OBJECTION_CATEGORIES) ?? ('OTHER' as ObjectionCategory),
            severity: oneOf(item.severity, PROBLEM_SEVERITIES) ?? ('MEDIUM' as const),
            description: optionalString(item.description, 400) ?? '',
            rootCauseHypothesis: optionalString(item.rootCauseHypothesis, 300),
            suggestedResolution: optionalString(item.suggestedResolution, 300),
          }))
          .filter((item) => item.description.length > 0)
          .slice(0, 3)
      : [];
    const date = optionalString(record.followUpDateSuggestion, 10);

    return {
      summary,
      sentiment: oneOf(record.sentiment, SENTIMENTS) ?? 'UNCLEAR',
      keyPoints: stringList(record.keyPoints, 8),
      commitments,
      objections,
      nextAction: optionalString(record.nextAction, 300),
      followUpDateSuggestion: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      unresolvedQuestions: stringList(record.unresolvedQuestions, 6),
      problemSuggestions,
      insufficientData: record.insufficientData === true,
    };
  }),
};

// ------------------------------------------------------------------ briefing
export type BriefingOutput = { headline: string; topActions: { title: string; why: string; recordRef: string | null }[] };

export const MORNING_BRIEFING_PROMPT: PromptDefinition<BriefingOutput> = {
  id: 'morning-briefing-v1',
  purpose: 'Prioritise the day from deterministic dashboard facts',
  system: `${GROUNDING_RULES}
The context lists today's facts (counts and the specific records behind them) computed by the CRM. Do not recount or restate every number; choose the three to five actions that matter most and say why, each tied to one record reference from the context.
Respond with JSON only: {"headline": string, "topActions": [{"title": string, "why": string, "recordRef": string|null}]}
recordRef must be one of the refs listed in the context, or null.`,
  maxOutputTokens: 500,
  temperature: 0.2,
  validate: objectValidator((record) => {
    const headline = requiredString(record.headline, 300);

    if (!headline) {
      return 'headline is required.';
    }

    const topActions = Array.isArray(record.topActions)
      ? record.topActions
          .filter(isRecord)
          .map((item) => ({ title: optionalString(item.title, 200) ?? '', why: optionalString(item.why, 300) ?? '', recordRef: optionalString(item.recordRef, 80) }))
          .filter((item) => item.title.length > 0)
          .slice(0, 5)
      : [];

    return { headline, topActions };
  }),
};

// ---------------------------------------------------------------- drafting
export const DRAFT_KINDS = ['FOLLOW_UP_EMAIL', 'INTRODUCTION_EMAIL', 'REMINDER', 'DOCUMENT_REQUEST', 'ONBOARDING_REMINDER', 'MEETING_FOLLOW_UP', 'WHATSAPP_FOLLOW_UP'] as const;

export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_TONES = ['PROFESSIONAL', 'FRIENDLY', 'SHORTER'] as const;

export type DraftOutput = { subject: string | null; body: string; placeholders: string[] };

export const DRAFT_PROMPT: PromptDefinition<DraftOutput> = {
  id: 'communication-draft-v1',
  purpose: 'Draft a follow-up email or short message for a human to review',
  system: `${GROUNDING_RULES}
Draft the requested communication for a La Vivenzia team member to review and send themselves. Use only facts from the context. Where a fact is needed but missing (a price, a date, a document name), write a placeholder in square brackets like [confirm date] and list it in placeholders. Never promise pricing, availability, terms or approval. Sign off with the sender's first name from the context or [your name].
For WHATSAPP_FOLLOW_UP: no subject, under 500 characters, plain text.
Respond with JSON only: {"subject": string|null, "body": string, "placeholders": string[]}`,
  maxOutputTokens: 600,
  temperature: 0.4,
  validate: objectValidator((record) => {
    const body = requiredString(record.body, 4_000);

    if (!body) {
      return 'body is required.';
    }

    return { subject: optionalString(record.subject, 200), body, placeholders: stringList(record.placeholders, 10, 120) };
  }),
};

// ------------------------------------------------------- onboarding assistant
export type OnboardingAssistOutput = {
  improvedText: string | null;
  changesExplained: string[];
  missingInformation: string[];
  inconsistencies: string[];
  questions: string[];
};

export const ONBOARDING_ASSIST_PROMPT: PromptDefinition<OnboardingAssistOutput> = {
  id: 'onboarding-assist-v1',
  purpose: 'Improve partner-provided onboarding text without adding facts',
  system: `${GROUNDING_RULES}
You help an onboarding expert review partner-provided information. When asked to improve a text, rewrite it for clarity and tone using ONLY the facts already in it — do not add amenities, prices, policies, availability, certifications, addresses, quality claims or any detail that is not there. List what you changed. Separately, list information a partner listing normally needs that is missing, any inconsistencies between the provided fields, and the questions to ask the partner.
Respond with JSON only: {"improvedText": string|null, "changesExplained": string[], "missingInformation": string[], "inconsistencies": string[], "questions": string[]}`,
  maxOutputTokens: 700,
  temperature: 0.3,
  validate: objectValidator((record) => ({
    improvedText: optionalString(record.improvedText, 3_000),
    changesExplained: stringList(record.changesExplained, 8),
    missingInformation: stringList(record.missingInformation, 10),
    inconsistencies: stringList(record.inconsistencies, 8),
    questions: stringList(record.questions, 8),
  })),
};

// ------------------------------------------------------------------ copilot
export type CopilotIntentOutput = {
  intent: 'QUERY' | 'RECORD_QUESTION' | 'ACTION' | 'UNSUPPORTED';
  plan: unknown;
  recordRef: string | null;
  action: unknown;
  explanation: string;
};

export const COPILOT_INTENT_PROMPT: PromptDefinition<CopilotIntentOutput> = {
  id: 'copilot-intent-v1',
  purpose: 'Turn a natural-language CRM question into an allowlisted query plan',
  system: `${GROUNDING_RULES}
Translate the user's question into a structured plan using ONLY the objects, fields, operators and values listed in the context schema. You cannot write SQL, join objects, or reference fields that are not listed. If the question asks to change, delete, merge, approve, reassign or send anything, produce intent ACTION with the action shape from the schema (the CRM will ask a human to confirm). If the question cannot be expressed with the schema, produce intent UNSUPPORTED and explain.
Respond with JSON only: {"intent": "QUERY"|"RECORD_QUESTION"|"ACTION"|"UNSUPPORTED", "plan": {"object": string, "filters": [{"field": string, "operator": string, "value": any}], "sort": {"field": string, "direction": "asc"|"desc"}|null, "limit": number}|null, "recordRef": string|null, "action": {"kind": string, "recordRef": string|null, "dueIn": string|null, "title": string|null}|null, "explanation": string}`,
  maxOutputTokens: 400,
  temperature: 0,
  validate: objectValidator((record) => {
    const intent = oneOf(record.intent, ['QUERY', 'RECORD_QUESTION', 'ACTION', 'UNSUPPORTED'] as const);

    if (!intent) {
      return 'intent is required.';
    }

    return {
      intent,
      plan: isRecord(record.plan) ? record.plan : null,
      recordRef: optionalString(record.recordRef, 40),
      action: isRecord(record.action) ? record.action : null,
      explanation: optionalString(record.explanation, 400) ?? '',
    };
  }),
};

export type CopilotAnswerOutput = { known: string[]; inferred: string[]; suggested: string[] };

export const COPILOT_ANSWER_PROMPT: PromptDefinition<CopilotAnswerOutput> = {
  id: 'copilot-answer-v1',
  purpose: 'Explain a CRM result set in KNOWN / INFERRED / SUGGESTED terms',
  system: `${GROUNDING_RULES}
The context contains the user's question and the records the CRM returned under the user's own permissions. Write at most three KNOWN statements (facts read directly from the records), at most two INFERRED statements (reasonable readings of those facts, phrased as possibilities) and at most two SUGGESTED next steps. Never state a fact that is not in the records.
Respond with JSON only: {"known": string[], "inferred": string[], "suggested": string[]}`,
  maxOutputTokens: 400,
  temperature: 0.2,
  validate: objectValidator((record) => ({
    known: stringList(record.known, 3, 300),
    inferred: stringList(record.inferred, 2, 300),
    suggested: stringList(record.suggested, 2, 300),
  })),
};

export const PROMPT_VERSIONS = {
  leadSummary: LEAD_SUMMARY_PROMPT.id,
  classification: LEAD_CLASSIFICATION_PROMPT.id,
  conversationSummary: CONVERSATION_SUMMARY_PROMPT.id,
  briefing: MORNING_BRIEFING_PROMPT.id,
  draft: DRAFT_PROMPT.id,
  onboardingAssist: ONBOARDING_ASSIST_PROMPT.id,
  copilotIntent: COPILOT_INTENT_PROMPT.id,
  copilotAnswer: COPILOT_ANSWER_PROMPT.id,
  // Deterministic engines carry a rules version in the same registry so an
  // insight always says which logic produced it.
  opportunityScore: 'opportunity-score-v1',
  relationshipHealth: 'relationship-health-v1',
  nextBestAction: 'next-best-action-v1',
  dataQuality: 'data-quality-v1',
  duplicate: 'duplicate-intelligence-v1',
} as const;
