import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// The one-tap follow-ups on Lead 360. Each is a plain task draft — title,
// due offset and priority — so "Call tomorrow" and a hand-written task go
// through exactly the same route and land on the same Twenty task object.

export type QuickAction = {
  key: 'CALL_TOMORROW' | 'FOLLOW_UP_2_DAYS' | 'SEND_ONBOARDING_INFO' | 'REVIEW_DOCUMENTS' | 'SCHEDULE_MEETING';
  label: string;
  title: string;
  dueInHours: number;
  // 11:00 local for a call, 09:00 for desk work — see dueAtFor.
  dueHourLocal: number;
  priority: LeadPriority;
};

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { key: 'CALL_TOMORROW', label: 'Call tomorrow', title: 'Call the lead', dueInHours: 24, dueHourLocal: 11, priority: 'HIGH' },
  { key: 'FOLLOW_UP_2_DAYS', label: 'Follow up in 2 days', title: 'Follow up with the lead', dueInHours: 48, dueHourLocal: 10, priority: 'MEDIUM' },
  { key: 'SEND_ONBOARDING_INFO', label: 'Send onboarding information', title: 'Send onboarding information', dueInHours: 24, dueHourLocal: 9, priority: 'MEDIUM' },
  { key: 'REVIEW_DOCUMENTS', label: 'Review documents', title: 'Review the submitted documents', dueInHours: 24, dueHourLocal: 9, priority: 'HIGH' },
  { key: 'SCHEDULE_MEETING', label: 'Schedule meeting', title: 'Schedule a meeting with the lead', dueInHours: 48, dueHourLocal: 10, priority: 'MEDIUM' },
];

export const quickAction = (key: unknown): QuickAction | null =>
  QUICK_ACTIONS.find((action) => action.key === key) ?? null;

// Due date for a quick action: `dueInHours` from now, snapped to the action's
// working hour in the given UTC offset (minutes, as the browser reports it),
// so "call tomorrow" lands at 11:00 for the person, not at 03:17.
export const dueAtFor = (action: QuickAction, now: string, timezoneOffsetMinutes: number): string => {
  const base = new Date(Date.parse(now) + action.dueInHours * 3_600_000);
  const local = new Date(base.getTime() - timezoneOffsetMinutes * 60_000);

  local.setUTCHours(action.dueHourLocal, 0, 0, 0);

  return new Date(local.getTime() + timezoneOffsetMinutes * 60_000).toISOString();
};
