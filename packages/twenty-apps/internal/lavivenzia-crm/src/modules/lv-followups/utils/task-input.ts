// What a task's own input has to survive before it is worth sending anywhere.
//
// Both checks below exist because something got through that should not have,
// and because what the person was then told was wrong about why.

/**
 * Characters Postgres will not store in a text column.
 *
 * The NULL byte is the one that actually happened. `trim()` does not remove
 * U+0000 — it is not whitespace — so a title consisting of nothing but a NULL
 * byte passed the "is it empty?" check, reached the database, and was rejected
 * there. The rejection came back as "Your role cannot create tasks on this
 * lead", which named the wrong cause to the person *and* wrote a permission
 * refusal into the audit trail for what was a malformed string.
 *
 * Tab, newline and carriage return are deliberately allowed: they are legal in
 * a text column and a pasted title may contain them.
 */
const UNSTORABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const hasUnstorableCharacters = (value: string): boolean => UNSTORABLE.test(value);

/**
 * Was a priority actually asked for?
 *
 * The distinction matters. No priority supplied means "use the default", and
 * falling back is right. A priority supplied that is not one of ours is a
 * mistake, and falling back silently stored something the caller never asked
 * for — `priority: 'SUPER'` was accepted, answered with ok: true, and written
 * as MEDIUM.
 */
export const priorityWasAsked = (value: unknown): boolean => value !== undefined && value !== null && value !== '';
