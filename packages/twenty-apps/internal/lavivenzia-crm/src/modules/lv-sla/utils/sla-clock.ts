import {
  BREACH_GRACE_HOURS,
  DUE_SOON_FRACTION,
  SLA_RULE_HOURS,
  type SlaRule,
  type SlaStatus,
} from 'src/modules/lv-sla/constants/sla-rules';

// The SLA clock. Pure arithmetic on ISO-8601 UTC strings: given when a
// commitment started and the rule, when is it due soon, due, and breached; and
// given "now", which clock state applies. Nothing here reads the system time —
// the evaluator passes its clock in, which is what makes 24-hour behaviour
// testable in milliseconds and independent of anyone's browser or timezone.

const HOUR_MS = 60 * 60 * 1000;

export type SlaSchedule = {
  startedAt: string;
  dueSoonAt: string;
  dueAt: string;
  breachAt: string;
};

const parseUtc = (isoTimestamp: string): number => {
  const parsed = Date.parse(isoTimestamp);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid timestamp: ${isoTimestamp}`);
  }

  return parsed;
};

// Always re-serialised through Date so the stored value is canonical UTC
// ("...Z") regardless of how the source timestamp was written.
const toUtc = (ms: number): string => new Date(ms).toISOString();

export const scheduleFor = ({ rule, startedAt }: { rule: SlaRule; startedAt: string }): SlaSchedule => {
  const start = parseUtc(startedAt);
  const window = SLA_RULE_HOURS[rule] * HOUR_MS;
  const due = start + window;

  return {
    startedAt: toUtc(start),
    dueSoonAt: toUtc(due - window * DUE_SOON_FRACTION),
    dueAt: toUtc(due),
    breachAt: toUtc(due + BREACH_GRACE_HOURS * HOUR_MS),
  };
};

// The state the clock alone dictates at `now`. Resolution and escalation are
// decided by the engine from facts, not from time, so they never come out of
// here.
export type ClockState = Extract<SlaStatus, 'ON_TRACK' | 'DUE_SOON' | 'DUE' | 'BREACHED'>;

export const clockStateAt = ({
  schedule,
  now,
}: {
  schedule: Pick<SlaSchedule, 'dueSoonAt' | 'dueAt' | 'breachAt'>;
  now: string;
}): ClockState => {
  const at = parseUtc(now);

  if (at >= parseUtc(schedule.breachAt)) {
    return 'BREACHED';
  }

  if (at >= parseUtc(schedule.dueAt)) {
    return 'DUE';
  }

  if (at >= parseUtc(schedule.dueSoonAt)) {
    return 'DUE_SOON';
  }

  return 'ON_TRACK';
};

// Whole hours until due (negative once overdue), for messages.
export const hoursUntil = (dueAt: string, now: string): number =>
  Math.round((parseUtc(dueAt) - parseUtc(now)) / HOUR_MS);
