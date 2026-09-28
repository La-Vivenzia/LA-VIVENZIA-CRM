// The unified status system.
//
// One vocabulary for every state the CRM shows — lead lifecycle, priority,
// SLA, onboarding, document verification, task, relationship health, AI
// insight and problem — mapped to five tones. A per-screen badge is how two
// screens end up calling the same state two different things; here the label
// and the tone are decided once and every surface reads them.
//
// Tones (never the only carrier of meaning — the label says it):
//   critical   needs action now             (danger)
//   caution    needs attention soon         (warning)
//   progress   moving, someone is on it     (info)
//   positive   done / healthy / verified    (success)
//   neutral    parked, terminal or unknown  (neutral)

import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, type LeadPriority, type LeadStatus } from 'src/domain/lead-lifecycle';

export type StatusTone = 'critical' | 'caution' | 'progress' | 'positive' | 'neutral';

// The badge tones used by layout(theme).badge().
export type BadgeTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export const badgeToneOf = (tone: StatusTone): BadgeTone =>
  tone === 'critical' ? 'danger' : tone === 'caution' ? 'warning' : tone === 'progress' ? 'info' : tone === 'positive' ? 'success' : 'neutral';

export type StatusDescriptor = { label: string; tone: StatusTone };

const LEAD_STATUS_TONES: Record<LeadStatus, StatusTone> = {
  DISCOVERED: 'neutral',
  NEW: 'progress',
  QUALIFYING: 'progress',
  ASSIGNED: 'progress',
  CONTACTED: 'progress',
  ENGAGED: 'progress',
  INTERESTED: 'progress',
  NEGOTIATION: 'caution',
  ONBOARDING_INITIATED: 'progress',
  ONBOARDING_IN_PROGRESS: 'progress',
  VERIFICATION: 'caution',
  APPROVED: 'positive',
  LIVE_ACTIVE: 'positive',
  GROWTH: 'positive',
  NOT_INTERESTED: 'neutral',
  FOLLOW_UP_LATER: 'caution',
  NO_RESPONSE: 'caution',
  WRONG_CONTACT: 'neutral',
  DUPLICATE: 'neutral',
  NOT_ELIGIBLE: 'neutral',
  TEMPORARILY_CLOSED: 'neutral',
  LOST: 'neutral',
  REJECTED: 'critical',
  DORMANT: 'neutral',
};

const PRIORITY_TONES: Record<LeadPriority, StatusTone> = { CRITICAL: 'critical', HIGH: 'caution', MEDIUM: 'progress', LOW: 'neutral' };

const SLA: Record<string, StatusDescriptor> = {
  ON_TRACK: { label: 'On track', tone: 'positive' },
  DUE_SOON: { label: 'Due soon', tone: 'caution' },
  DUE: { label: 'Due', tone: 'caution' },
  BREACHED: { label: 'Breached', tone: 'critical' },
  ESCALATED: { label: 'Escalated', tone: 'critical' },
  RESOLVED: { label: 'Resolved', tone: 'neutral' },
};

const ONBOARDING: Record<string, StatusDescriptor> = {
  NOT_STARTED: { label: 'Not started', tone: 'neutral' },
  INVITED: { label: 'Invited', tone: 'progress' },
  INITIATED: { label: 'Initiated', tone: 'progress' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  WAITING_FOR_PARTNER: { label: 'Waiting for partner', tone: 'caution' },
  VERIFICATION: { label: 'Verification', tone: 'caution' },
  INTERNAL_REVIEW: { label: 'Internal review', tone: 'caution' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'caution' },
  APPROVED: { label: 'Approved', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'critical' },
  ACTIVATED: { label: 'Activated', tone: 'positive' },
};

// Day 9 — ecosystem entities.
const PARTNER: Record<string, StatusDescriptor> = {
  PROSPECTIVE: { label: 'Prospective', tone: 'neutral' },
  ONBOARDING: { label: 'Onboarding', tone: 'progress' },
  APPROVED: { label: 'Approved', tone: 'progress' },
  ACTIVE: { label: 'Active', tone: 'positive' },
  PAUSED: { label: 'Paused', tone: 'caution' },
  SUSPENDED: { label: 'Suspended', tone: 'critical' },
  INACTIVE: { label: 'Inactive', tone: 'caution' },
  OFFBOARDED: { label: 'Offboarded', tone: 'neutral' },
};

const LISTING: Record<string, StatusDescriptor> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  IN_REVIEW: { label: 'In review', tone: 'caution' },
  CHANGES_REQUIRED: { label: 'Changes required', tone: 'caution' },
  READY: { label: 'Approved', tone: 'progress' },
  LIVE: { label: 'Active', tone: 'positive' },
  PAUSED: { label: 'Paused', tone: 'caution' },
  SUSPENDED: { label: 'Suspended', tone: 'critical' },
  RETIRED: { label: 'Archived', tone: 'neutral' },
};

const READINESS: Record<string, StatusDescriptor> = {
  READY: { label: 'Ready', tone: 'positive' },
  NOT_READY: { label: 'Not ready', tone: 'caution' },
};

const DOCUMENT: Record<string, StatusDescriptor> = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  UNDER_REVIEW: { label: 'Under review', tone: 'progress' },
  VERIFIED: { label: 'Verified', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'critical' },
  EXPIRED: { label: 'Expired', tone: 'critical' },
  NEEDS_REPLACEMENT: { label: 'Needs replacement', tone: 'caution' },
};

const TASK: Record<string, StatusDescriptor> = {
  TODO: { label: 'To do', tone: 'progress' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  DONE: { label: 'Done', tone: 'positive' },
};

const HEALTH: Record<string, StatusDescriptor> = {
  HEALTHY: { label: 'Healthy', tone: 'positive' },
  ATTENTION: { label: 'Attention', tone: 'caution' },
  AT_RISK: { label: 'At risk', tone: 'critical' },
  DORMANT: { label: 'Dormant', tone: 'neutral' },
  UNKNOWN: { label: 'Not assessed', tone: 'neutral' },
};

const INSIGHT: Record<string, StatusDescriptor> = {
  AI_SUGGESTED: { label: 'AI suggested', tone: 'progress' },
  AI_CONFIRMED: { label: 'Confirmed', tone: 'positive' },
  AI_REJECTED: { label: 'Rejected', tone: 'neutral' },
  AI_STALE: { label: 'Stale', tone: 'caution' },
  UNAVAILABLE: { label: 'AI unavailable', tone: 'neutral' },
};

const PROBLEM_STATUS: Record<string, StatusDescriptor> = {
  OPEN: { label: 'Open', tone: 'critical' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  RESOLVED: { label: 'Resolved', tone: 'positive' },
  DISMISSED: { label: 'Dismissed', tone: 'neutral' },
};

const SEVERITY: Record<string, StatusDescriptor> = {
  CRITICAL: { label: 'Critical', tone: 'critical' },
  HIGH: { label: 'High', tone: 'critical' },
  MEDIUM: { label: 'Medium', tone: 'caution' },
  LOW: { label: 'Low', tone: 'neutral' },
};

export type StatusKind = 'lead' | 'priority' | 'sla' | 'onboarding' | 'document' | 'task' | 'health' | 'insight' | 'problem' | 'severity' | 'partner' | 'listing' | 'readiness';

const humanise = (value: string): string => value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// Every status the product shows goes through here. Unknown values (a value
// added to the data model before this map learns it) still render — as a
// neutral, humanised label — rather than crashing or showing raw SNAKE_CASE.
export const describeStatus = (kind: StatusKind, value: string | null | undefined): StatusDescriptor => {
  if (!value) {
    return { label: '—', tone: 'neutral' };
  }

  switch (kind) {
    case 'lead':
      return { label: LEAD_STATUS_LABELS[value as LeadStatus] ?? humanise(value), tone: LEAD_STATUS_TONES[value as LeadStatus] ?? 'neutral' };
    case 'priority':
      return { label: LEAD_PRIORITY_LABELS[value as LeadPriority] ?? humanise(value), tone: PRIORITY_TONES[value as LeadPriority] ?? 'neutral' };
    case 'sla':
      return SLA[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'onboarding':
      return ONBOARDING[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'document':
      return DOCUMENT[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'task':
      return TASK[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'health':
      return HEALTH[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'insight':
      return INSIGHT[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'problem':
      return PROBLEM_STATUS[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'severity':
      return SEVERITY[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'partner':
      return PARTNER[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'listing':
      return LISTING[value] ?? { label: humanise(value), tone: 'neutral' };
    case 'readiness':
      return READINESS[value] ?? { label: humanise(value), tone: 'neutral' };
  }
};

// The badge tone for a status, in one call.
export const statusBadgeTone = (kind: StatusKind, value: string | null | undefined): BadgeTone => badgeToneOf(describeStatus(kind, value).tone);
