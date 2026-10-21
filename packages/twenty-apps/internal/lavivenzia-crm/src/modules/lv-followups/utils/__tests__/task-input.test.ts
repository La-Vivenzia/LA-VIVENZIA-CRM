import { describe, expect, it } from 'vitest';

import { LEAD_PRIORITIES, isLeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { classifyTaskFailure } from 'src/modules/lv-followups/services/create-lead-task';
import { hasUnstorableCharacters, priorityWasAsked } from 'src/modules/lv-followups/utils/task-input';

// Two defects in /tasks/create, and the shared cause behind them: input that
// was not checked, and a failure that was assumed to be about permission.

describe('a title the database cannot store', () => {
  it('catches the NULL byte, which trim() leaves behind', () => {
    // The actual bug. U+0000 is not whitespace, so `'\u0000'.trim()` is still
    // one character long and the emptiness check passed it through to
    // Postgres, which rejected it.
    expect('\u0000'.trim()).toHaveLength(1);
    expect(hasUnstorableCharacters('\u0000')).toBe(true);
    expect(hasUnstorableCharacters('Call Priya\u0000')).toBe(true);
  });

  it('catches the other control characters', () => {
    expect(hasUnstorableCharacters('\u0001')).toBe(true);
    expect(hasUnstorableCharacters('\u001F')).toBe(true);
    expect(hasUnstorableCharacters('\u007F')).toBe(true);
  });

  it('leaves ordinary titles alone', () => {
    expect(hasUnstorableCharacters('Call Priya about the Alleppey villa')).toBe(false);
    expect(hasUnstorableCharacters('Follow up — ₹45,000 quote')).toBe(false);
    expect(hasUnstorableCharacters('Chase the FSSAI licence')).toBe(false);
  });

  it('allows the whitespace that is legal in a text column', () => {
    // A pasted title can carry these, and they store fine. Rejecting them
    // would be a new bug in the other direction.
    expect(hasUnstorableCharacters('two\tcolumns')).toBe(false);
    expect(hasUnstorableCharacters('line\nbreak')).toBe(false);
    expect(hasUnstorableCharacters('carriage\rreturn')).toBe(false);
  });
});

describe('an invalid priority', () => {
  it('is distinguished from no priority at all', () => {
    // This is the whole fix. Absent means "use the default"; present and
    // wrong means "say so".
    expect(priorityWasAsked(undefined)).toBe(false);
    expect(priorityWasAsked(null)).toBe(false);
    expect(priorityWasAsked('')).toBe(false);

    expect(priorityWasAsked('SUPER')).toBe(true);
    expect(priorityWasAsked('HIGH')).toBe(true);
    expect(priorityWasAsked(0)).toBe(true);
  });

  it('is not one of the four the product has', () => {
    // 'SUPER' was accepted and silently stored as MEDIUM.
    expect(isLeadPriority('SUPER')).toBe(false);
    expect(LEAD_PRIORITIES).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });

  it('together, these reject SUPER and still default a missing one', () => {
    const rejected = (value: unknown) => priorityWasAsked(value) && !isLeadPriority(value);

    expect(rejected('SUPER')).toBe(true);
    expect(rejected('urgent')).toBe(true);
    expect(rejected('high')).toBe(true);

    expect(rejected(undefined)).toBe(false);
    expect(rejected('HIGH')).toBe(false);
    expect(rejected('CRITICAL')).toBe(false);
  });
});

describe('classifying why a task was not created', () => {
  it('calls a permission failure a permission failure', () => {
    for (const message of ['Forbidden', 'You do not have permission to create this record', 'Unauthorized', 'Request failed with 403']) {
      expect(classifyTaskFailure(new Error(message)).refusal, message).toBe('NOT_PERMITTED');
    }
  });

  it('no longer calls a malformed value a permission failure', () => {
    // The defect: one catch block, one hardcoded NOT_PERMITTED. A database
    // rejection was reported to the person as a role problem and recorded in
    // the audit trail as a refused permission — a durable wrong fact.
    const verdict = classifyTaskFailure(new Error('invalid byte sequence for encoding "UTF8": 0x00'));

    expect(verdict.refusal).toBe('INVALID_INPUT');
    expect(verdict.error).not.toMatch(/role/i);
    expect(verdict.auditReason).toBe('validation');
  });

  it('writes the real reason to the audit trail, not "permission" for everything', () => {
    expect(classifyTaskFailure(new Error('Forbidden')).auditReason).toBe('permission');
    expect(classifyTaskFailure(new Error('violates not-null constraint')).auditReason).toBe('validation');
    expect(classifyTaskFailure(new Error('socket hang up')).auditReason).toBe('error');
  });

  it('admits when it does not know, rather than guessing permission', () => {
    const verdict = classifyTaskFailure(new Error('ECONNRESET'));

    expect(verdict.refusal).toBe('FAILED');
    expect(verdict.error).toBe('The task was not created.');
  });

  it('survives a thrown non-error', () => {
    expect(() => classifyTaskFailure('something')).not.toThrow();
    expect(() => classifyTaskFailure(null)).not.toThrow();
    expect(classifyTaskFailure(null).refusal).toBe('FAILED');
  });
});
