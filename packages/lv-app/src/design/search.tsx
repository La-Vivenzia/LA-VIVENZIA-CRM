import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvSkeletonRow, VisuallyHidden } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// Global search.
//
// The references put one wide field across the top of the product and label it
// "Search anything… (e.g. leads, partners, stays, documents)" — it is how a
// person navigates, not a filter bolted onto a list. So it behaves like a
// product surface: ⌘K from anywhere, arrow keys through the results, Enter to
// open, Escape to leave, and a remembered list of what you looked for last.
//
// It invents nothing. The caller supplies the search function, and this
// component owns only the interaction and the four states it can be in:
// recent (nothing typed), loading, results, and nothing found.

export type LvSearchResult = {
  id: string;
  /** What the record is called. */
  title: string;
  /** "Lead · Lonavala", "Document · Identity" — what kind of thing this is. */
  subtitle?: string | null;
  icon: LvIconName;
  /** The group this result belongs under, e.g. "Leads". */
  group: string;
  onOpen: () => void;
};

const RECENT_KEY = 'lv.search.recent';
const RECENT_LIMIT = 5;

// Per-viewer convenience only. It can throw in a private window or with site
// data blocked, so every access is guarded and the field works without it.
const readRecent = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);

    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
};

const writeRecent = (terms: string[]) => {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, RECENT_LIMIT)));
  } catch {
    // A remembered search is a convenience, never a requirement.
  }
};

export const useLvRecentSearches = () => {
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  const remember = useCallback((term: string) => {
    const trimmed = term.trim();

    if (trimmed.length < 2) {
      return;
    }

    setRecent((current) => {
      const next = [trimmed, ...current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_LIMIT);

      writeRecent(next);

      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    writeRecent([]);
  }, []);

  return { recent, remember, clear };
};

const ResultRow = ({
  theme,
  result,
  selected,
  onSelect,
  id,
}: {
  theme: LvTheme;
  result: LvSearchResult;
  selected: boolean;
  onSelect: () => void;
  id: string;
}) => (
  <li role="option" aria-selected={selected} id={id}>
    <button
      type="button"
      // The active row is chosen by the arrow keys, so it must not need a
      // pointer to be visible.
      onMouseEnter={onSelect}
      onClick={result.onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.space(3),
        width: '100%',
        minHeight: 52,
        padding: `${theme.space(2)}px ${theme.space(3)}px`,
        borderRadius: theme.radius.md,
        border: '1px solid transparent',
        background: selected ? theme.color.surfaceSunken : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: theme.font.body,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          flex: '0 0 auto',
          borderRadius: theme.radius.md,
          background: theme.color.brandMuted,
          color: theme.color.textOnBrand,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name={result.icon} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.title}
        </span>
        {result.subtitle && (
          <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.subtitle}
          </span>
        )}
      </span>
      <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
        <LvIcon name="chevronRight" size={16} />
      </span>
    </button>
  </li>
);

export const LvGlobalSearch = ({
  theme,
  onSearch,
  onSubmitAll,
  placeholder = 'Search anything… (e.g. leads, partners, stays, documents)',
  shortPlaceholder = 'Search',
}: {
  theme: LvTheme;
  /**
   * Runs the search. It is given an AbortSignal so a slow query cannot land
   * after a newer one. Returning an empty array is "nothing found", which is
   * a different state from never having searched.
   */
  onSearch: (term: string, signal: AbortSignal) => Promise<LvSearchResult[]>;
  /** Enter with nothing selected — take the person to the full list. */
  onSubmitAll?: (term: string) => void;
  placeholder?: string;
  shortPlaceholder?: string;
}) => {
  const tier = useLvTier();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<LvSearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const { recent, remember, clear } = useLvRecentSearches();

  // ⌘K / Ctrl-K from anywhere in the product.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced, and cancelled when the term moves on.
  useEffect(() => {
    const trimmed = term.trim();

    if (trimmed.length < 2) {
      setResults(null);
      setBusy(false);
      setError(null);

      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(null);

      try {
        const found = await onSearch(trimmed, controller.signal);

        if (!controller.signal.aborted) {
          setResults(found);
          setCursor(0);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'That search could not be run.');
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, onSearch]);

  const close = useCallback(() => {
    setOpen(false);
    setCursor(0);
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, LvSearchResult[]>();

    for (const result of results ?? []) {
      groups.set(result.group, [...(groups.get(result.group) ?? []), result]);
    }

    return [...groups.entries()];
  }, [results]);

  const flat = results ?? [];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      inputRef.current?.blur();

      return;
    }

    if (event.key === 'ArrowDown' && flat.length > 0) {
      event.preventDefault();
      setCursor((value) => (value + 1) % flat.length);

      return;
    }

    if (event.key === 'ArrowUp' && flat.length > 0) {
      event.preventDefault();
      setCursor((value) => (value - 1 + flat.length) % flat.length);

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      remember(term);

      const chosen = flat[cursor];

      if (chosen) {
        chosen.onOpen();
        close();
      } else if (term.trim().length > 1) {
        onSubmitAll?.(term.trim());
        close();
      }
    }
  };

  const field = (
    <div className="lv-search-field" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span aria-hidden="true" className="lv-search-icon" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
        <LvIcon name="search" size={19} />
      </span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[cursor] ? `${listId}-${flat[cursor].id}` : undefined}
        aria-label="Search the CRM"
        value={term}
        placeholder={tier === 'mobile' ? shortPlaceholder : placeholder}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          ...theme.type.body,
          flex: 1,
          minWidth: 0,
          // Fills the pill's full height rather than sitting as a 25px line in
          // the middle of a 46px pill. The pill is a plain div, so the ~10px
          // above and below the text was dead: a click there landed on the div
          // and focused nothing — on the one control that is on every screen.
          alignSelf: 'stretch',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.color.text,
          fontFamily: theme.font.body,
        }}
      />
      {term.length > 0 && (
        <button
          type="button"
          aria-label="Clear the search"
          onClick={() => {
            setTerm('');
            inputRef.current?.focus();
          }}
          style={{
            width: 32,
            height: 32,
            flex: '0 0 auto',
            borderRadius: theme.radius.pill,
            border: '1px solid transparent',
            background: 'transparent',
            color: theme.color.textMuted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LvIcon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} />
        </button>
      )}
      <span className="lv-search-hint" aria-hidden="true" style={{ ...theme.type.caption, color: theme.color.textSubtle, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, padding: '1px 6px' }}>
        ⌘K
      </span>
    </div>
  );

  const panel = (
    <div className="lv-search-panel" style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, boxShadow: theme.shadow.lg }}>
      {/* Recent — nothing typed yet. */}
      {term.trim().length < 2 && (
        <div style={{ padding: theme.space(2) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${theme.space(1)}px ${theme.space(3)}px` }}>
            <span style={{ ...theme.type.label, color: theme.color.textMuted }}>{recent.length > 0 ? 'Recent searches' : 'Search'}</span>
            {recent.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="lv-chip-control"
                style={{ ...theme.type.bodySmall, background: 'transparent', border: '1px solid transparent', color: theme.color.textMuted, cursor: 'pointer', padding: `0 ${theme.space(2)}px` }}
              >
                Clear
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0, padding: `${theme.space(2)}px ${theme.space(3)}px ${theme.space(3)}px` }}>
              Look for a lead, a partner, a property or a document. Two letters is enough to start.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {recent.map((entry) => (
                <li key={entry}>
                  <button
                    type="button"
                    onClick={() => {
                      setTerm(entry);
                      inputRef.current?.focus();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.space(3),
                      width: '100%',
                      minHeight: 44,
                      padding: `0 ${theme.space(3)}px`,
                      borderRadius: theme.radius.md,
                      border: '1px solid transparent',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      ...theme.type.body,
                      fontFamily: theme.font.body,
                      color: theme.color.text,
                    }}
                  >
                    <LvIcon name="clock" size={16} />
                    {entry}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Loading — the shape of what is coming. */}
      {term.trim().length >= 2 && busy && (
        <div style={{ padding: theme.space(4), display: 'flex', flexDirection: 'column', gap: theme.space(3) }} aria-busy="true">
          <VisuallyHidden>Searching</VisuallyHidden>
          <LvSkeletonRow theme={theme} width="45%" />
          <LvSkeletonRow theme={theme} width="80%" />
          <LvSkeletonRow theme={theme} width="65%" />
        </div>
      )}

      {/* Nothing found, or the search itself failed. */}
      {term.trim().length >= 2 && !busy && flat.length === 0 && (
        <div style={{ padding: theme.space(5), textAlign: 'center' }} role="status">
          <p style={{ ...theme.type.body, color: theme.color.heading, margin: 0 }}>
            {error ? 'That search could not be run' : `Nothing matches “${term.trim()}”`}
          </p>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>
            {error ?? 'Try a name, a reference like LV-000005, a place, or a phone number.'}
          </p>
        </div>
      )}

      {/* Results, grouped by what kind of thing they are. */}
      {term.trim().length >= 2 && !busy && flat.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Search results" style={{ margin: 0, padding: theme.space(2), listStyle: 'none', maxHeight: '60vh', overflowY: 'auto' }}>
          {grouped.map(([group, rows]) => (
            <li key={group}>
              <span style={{ display: 'block', ...theme.type.label, color: theme.color.textMuted, padding: `${theme.space(2)}px ${theme.space(3)}px ${theme.space(1)}px` }}>{group}</span>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {rows.map((result) => (
                  <ResultRow
                    key={result.id}
                    theme={theme}
                    result={result}
                    id={`${listId}-${result.id}`}
                    selected={flat[cursor]?.id === result.id}
                    onSelect={() => setCursor(flat.findIndex((candidate) => candidate.id === result.id))}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // On a phone the field is a button in the bar; tapping it opens search as a
  // full screen, which is the only way a result list and a keyboard both fit.
  if (tier === 'mobile') {
    return (
      <>
        <button
          type="button"
          className="lv-search-trigger"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-label="Search the CRM"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.space(2),
            width: '100%',
            background: theme.color.surfaceRaised,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.pill,
            color: theme.color.textSubtle,
            cursor: 'pointer',
            ...theme.type.body,
            fontFamily: theme.font.body,
            boxShadow: theme.shadow.sm,
          }}
        >
          <LvIcon name="search" size={18} />
          {shortPlaceholder}
        </button>

        {open && (
          <div className="lv-search-fullscreen" style={{ background: theme.color.page }}>
            <div className="lv-search-fullscreen-bar" style={{ background: theme.color.surfaceRaised, borderBottom: `1px solid ${theme.color.border}` }}>
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                style={{
                  width: 40,
                  height: 40,
                  flex: '0 0 auto',
                  borderRadius: theme.radius.pill,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: theme.color.textMuted,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LvIcon name="chevronLeft" size={20} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>{field}</div>
            </div>
            <div className="lv-search-fullscreen-body">{panel}</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="lv-search" style={{ position: 'relative' }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        close();
      }
    }}>
      {field}
      {open && panel}
    </div>
  );
};

/** The bell and the panel behind it. */
export const LvNotificationBell = ({
  theme,
  count,
  children,
  open,
  onToggle,
}: {
  theme: LvTheme;
  count: number;
  /** The panel, rendered only while open. */
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) => (
  <div style={{ position: 'relative' }}>
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: theme.radius.pill,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.surfaceRaised,
        color: theme.color.textMuted,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: theme.shadow.sm,
      }}
    >
      <LvIcon name="bell" size={20} />
      {count > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: theme.radius.pill,
            background: theme.color.danger,
            color: theme.color.textInverse,
            fontSize: 10,
            fontWeight: theme.font.weight.bold,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
    {open && children}
  </div>
);
