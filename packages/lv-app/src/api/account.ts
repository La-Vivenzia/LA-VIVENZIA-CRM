import { useCallback, useEffect, useRef, useState } from 'react';

import { graphql } from 'src/api/client';

// The signed-in person's own record, and the one mutation that may change it.
//
// There are two update paths on the platform and only one of them is right
// here. `updateWorkspaceMember` goes through object permissions, which the
// La Vivenzia team roles do not hold: a coordinator is refused on their *own*
// record with "Entity performing the request does not have permission".
// `updateWorkspaceMemberSettings` is the self-service path — the resolver
// allows it when `isUpdatingSelf`, or when the caller holds the
// WORKSPACE_MEMBERS setting permission — so every role can edit their own
// profile through it, and nobody can edit anyone else's.
//
// The server rejects custom fields on that endpoint
// (`assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly`), so La Vivenzia's own
// member fields — lvAcceptsLeads, lvLeadCapacity, lvExpertise, lvRegions,
// lvLanguages — are deliberately absent from everything below. They are
// administered where an administrator edits a member, not here.

/** Exactly the fields the self-service endpoint accepts and this screen uses. */
export type AccountRecord = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  avatarUrl: string;
  userEmail: string;
  colorScheme: string;
  locale: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
};

export type AccountPatch = Partial<{
  name: { firstName: string; lastName: string };
  jobTitle: string;
  colorScheme: string;
  locale: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
}>;

const RECORD_FIELDS = 'id jobTitle avatarUrl userEmail colorScheme locale timeZone dateFormat timeFormat numberFormat name { firstName lastName }';

type RawMember = {
  id: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  userEmail: string | null;
  colorScheme: string | null;
  locale: string | null;
  timeZone: string | null;
  dateFormat: string | null;
  timeFormat: string | null;
  numberFormat: string | null;
  name: { firstName: string | null; lastName: string | null } | null;
};

const toRecord = (node: RawMember): AccountRecord => ({
  id: node.id,
  firstName: node.name?.firstName ?? '',
  lastName: node.name?.lastName ?? '',
  jobTitle: node.jobTitle ?? '',
  avatarUrl: node.avatarUrl ?? '',
  userEmail: node.userEmail ?? '',
  // The platform's own defaults when a member has never chosen.
  colorScheme: node.colorScheme ?? 'System',
  locale: node.locale ?? 'en',
  timeZone: node.timeZone ?? 'system',
  dateFormat: node.dateFormat ?? 'SYSTEM',
  timeFormat: node.timeFormat ?? 'SYSTEM',
  numberFormat: node.numberFormat ?? 'SYSTEM',
});

export const fetchAccount = async (workspaceMemberId: string): Promise<AccountRecord> => {
  const data = await graphql<{ workspaceMembers?: { edges: { node: RawMember }[] } }>(
    `query($id: UUID!) { workspaceMembers(first: 1, filter: { id: { eq: $id } }) { edges { node { ${RECORD_FIELDS} } } } }`,
    { id: workspaceMemberId },
  );
  const node = data.workspaceMembers?.edges?.[0]?.node;

  if (!node) {
    throw new Error('Your workspace membership could not be read.');
  }

  return toRecord(node);
};

/**
 * Writes one or more fields on the caller's own record.
 *
 * Returns Boolean, not the record, so the caller re-reads to prove the change
 * landed rather than trusting the acknowledgement. "Saved" has to mean the
 * server agrees.
 */
export const saveAccount = async (workspaceMemberId: string, patch: AccountPatch): Promise<void> => {
  if (Object.keys(patch).length === 0) {
    return;
  }

  const data = await graphql<{ updateWorkspaceMemberSettings?: boolean }>(
    'mutation($input: UpdateWorkspaceMemberSettingsInput!) { updateWorkspaceMemberSettings(input: $input) }',
    { input: { workspaceMemberId, update: patch } },
    'metadata',
  );

  if (data.updateWorkspaceMemberSettings !== true) {
    throw new Error('The change was not saved.');
  }
};

/**
 * `emailPasswordResetLink` — the only password path the platform has.
 *
 * There is no "change my password with my current one" mutation anywhere in
 * the auth module: the pair is `emailPasswordResetLink` and
 * `updatePasswordViaResetToken`, and the second needs a token that only
 * arrives by email. So the honest control is "send me the link", not a form
 * with three password boxes that could not work.
 */
export const requestPasswordReset = async (email: string): Promise<string> => {
  const data = await graphql<{ emailPasswordResetLink?: { success?: boolean } }>(
    'mutation($email: String!) { emailPasswordResetLink(email: $email) { success } }',
    { email },
    'metadata',
  );

  if (data.emailPasswordResetLink?.success !== true) {
    throw new Error('The reset email could not be sent.');
  }

  return email;
};

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

// These three are real GraphQL enums, so the values are exact.
export const DATE_FORMATS = [
  { value: 'SYSTEM', label: 'Match this device' },
  { value: 'DAY_FIRST', label: 'Day first — 31/12/2026' },
  { value: 'MONTH_FIRST', label: 'Month first — 12/31/2026' },
  { value: 'YEAR_FIRST', label: 'Year first — 2026-12-31' },
] as const;

export const TIME_FORMATS = [
  { value: 'SYSTEM', label: 'Match this device' },
  { value: 'HOUR_24', label: '24-hour — 18:30' },
  { value: 'HOUR_12', label: '12-hour — 6:30 pm' },
] as const;

export const NUMBER_FORMATS = [
  { value: 'SYSTEM', label: 'Match this device' },
  { value: 'COMMAS_AND_DOT', label: '1,234.56' },
  { value: 'DOTS_AND_COMMA', label: '1.234,56' },
  { value: 'SPACES_AND_COMMA', label: '1 234,56' },
  { value: 'APOSTROPHE_AND_DOT', label: '1’234.56' },
] as const;

/**
 * `colorScheme` is stored as free text with no server-side validation — it
 * accepted a lowercase "dark" when probed — so the canonical three are sent
 * and nothing else.
 */
export const COLOR_SCHEMES = [
  { value: 'System', label: 'System' },
  { value: 'Light', label: 'Light' },
  { value: 'Dark', label: 'Dark' },
] as const;

/** A subset of `APP_LOCALES`: the ones this product is actually used in. */
export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
] as const;

/**
 * `timeZone` is free text, so a curated list is offered rather than four
 * hundred IANA names — but whatever is already stored is always kept as an
 * option, so opening this screen can never silently change someone's zone to
 * the nearest thing on a shortlist.
 */
export const TIME_ZONES = [
  { value: 'system', label: 'Match this device' },
  { value: 'Asia/Kolkata', label: 'India — Asia/Kolkata' },
  { value: 'Asia/Dubai', label: 'Gulf — Asia/Dubai' },
  { value: 'Europe/London', label: 'United Kingdom — Europe/London' },
  { value: 'Europe/Paris', label: 'Central Europe — Europe/Paris' },
  { value: 'America/New_York', label: 'US East — America/New_York' },
  { value: 'America/Los_Angeles', label: 'US West — America/Los_Angeles' },
  { value: 'Asia/Singapore', label: 'Singapore — Asia/Singapore' },
  { value: 'Australia/Sydney', label: 'Australia — Australia/Sydney' },
  { value: 'UTC', label: 'UTC' },
] as const;

/** The stored value, plus the curated list, without duplicating it. */
export const timeZoneOptions = (current: string): { value: string; label: string }[] => {
  const known = TIME_ZONES.some((zone) => zone.value === current);

  return known ? [...TIME_ZONES] : [...TIME_ZONES, { value: current, label: current }];
};

export const localeOptions = (current: string): { value: string; label: string }[] => {
  const known = LOCALES.some((locale) => locale.value === current);

  return known ? [...LOCALES] : [...LOCALES, { value: current, label: current }];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const NAME_MAX = 100;
export const JOB_TITLE_MAX = 120;

/** What is wrong with a field, or null. Checked before anything is sent. */
export const validateAccount = (draft: { firstName: string; lastName: string; jobTitle: string }): Partial<Record<'firstName' | 'lastName' | 'jobTitle', string>> => {
  const errors: Partial<Record<'firstName' | 'lastName' | 'jobTitle', string>> = {};

  if (draft.firstName.trim().length === 0) {
    errors.firstName = 'A first name is needed.';
  } else if (draft.firstName.trim().length > NAME_MAX) {
    errors.firstName = `Keep this under ${NAME_MAX} characters.`;
  }

  if (draft.lastName.trim().length > NAME_MAX) {
    errors.lastName = `Keep this under ${NAME_MAX} characters.`;
  }

  if (draft.jobTitle.trim().length > JOB_TITLE_MAX) {
    errors.jobTitle = `Keep this under ${JOB_TITLE_MAX} characters.`;
  }

  return errors;
};

/** Only what actually changed, so a save never rewrites untouched fields. */
export const accountPatch = (current: AccountRecord, draft: AccountRecord): AccountPatch => {
  const patch: AccountPatch = {};

  if (draft.firstName.trim() !== current.firstName || draft.lastName.trim() !== current.lastName) {
    patch.name = { firstName: draft.firstName.trim(), lastName: draft.lastName.trim() };
  }

  if (draft.jobTitle.trim() !== current.jobTitle) {
    patch.jobTitle = draft.jobTitle.trim();
  }

  for (const key of ['colorScheme', 'locale', 'timeZone', 'dateFormat', 'timeFormat', 'numberFormat'] as const) {
    if (draft[key] !== current[key]) {
      patch[key] = draft[key];
    }
  }

  return patch;
};

// ---------------------------------------------------------------------------
// The hook the screen uses
// ---------------------------------------------------------------------------

export type AccountState = {
  record: AccountRecord | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  reload: () => void;
  save: (draft: AccountRecord) => Promise<boolean>;
};

export const useAccount = (workspaceMemberId: string | null, onSchemeChange?: (scheme: string) => void): AccountState => {
  const [record, setRecord] = useState<AccountRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (workspaceMemberId === null) {
      setLoading(false);
      setError('You are signed out.');

      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRecord(await fetchAccount(workspaceMemberId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [workspaceMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (savedTimer.current !== null) {
      clearTimeout(savedTimer.current);
    }
  }, []);

  const save = useCallback(
    async (draft: AccountRecord): Promise<boolean> => {
      if (workspaceMemberId === null || record === null) {
        return false;
      }

      const patch = accountPatch(record, draft);

      if (Object.keys(patch).length === 0) {
        return true;
      }

      setSaving(true);
      setSaveError(null);
      setSaved(false);

      try {
        await saveAccount(workspaceMemberId, patch);
        // Re-read rather than trusting the boolean: "Saved" is only shown for
        // a change the server will hand back.
        const fresh = await fetchAccount(workspaceMemberId);

        setRecord(fresh);

        if (patch.colorScheme !== undefined) {
          onSchemeChange?.(fresh.colorScheme);
        }

        setSaved(true);
        savedTimer.current = setTimeout(() => setSaved(false), 4000);

        return true;
      } catch (cause) {
        setSaveError(cause instanceof Error ? cause.message : 'That change was not saved.');

        return false;
      } finally {
        setSaving(false);
      }
    },
    [onSchemeChange, record, workspaceMemberId],
  );

  return { record, loading, error, saving, saved, saveError, reload: load, save };
};
