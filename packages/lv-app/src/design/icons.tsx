import { type CSSProperties } from 'react';

// The La Vivenzia glyph set.
//
// Plain inline <svg> elements — no dependency, no network request, no build
// step — drawn on a 24-grid with a 1.75 stroke so they sit beside 15px body
// text without shouting. An icon library would be the largest thing in the
// bundle and would bring a drawing style that is not ours.
//
// Every icon is decorative by default (`aria-hidden`); the label lives in the
// surrounding button or row. Pass `title` only when the glyph is the *only*
// thing carrying the meaning.

export type LvIconName =
  // navigation — the six doors plus profile and settings
  | 'today'
  | 'leads'
  | 'capture'
  | 'onboarding'
  | 'messages'
  | 'ask'
  | 'profile'
  | 'settings'
  // channels
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'meeting'
  | 'instagram'
  | 'website'
  | 'note'
  // objects
  | 'partner'
  | 'property'
  | 'experience'
  | 'document'
  | 'task'
  | 'organisation'
  | 'person'
  // signals and actions
  | 'sparkle'
  | 'bell'
  | 'search'
  | 'clock'
  | 'warning'
  | 'check'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronUp'
  | 'filter'
  | 'chart'
  | 'signout'
  | 'download'
  | 'trash'
  | 'image'
  | 'info'
  | 'plus'
  | 'more'
  | 'camera'
  | 'microphone'
  | 'upload'
  | 'star'
  // the time of day, for the greeting
  | 'sun'
  | 'moon'
  | 'location';

// Paths are stroked unless listed in FILLED (a filled glyph reads better at
// small sizes for the few solid marks the reference screens use).
const FILLED = new Set<LvIconName>([
  // The reference draws every door glyph solid — the house, the group, the
  // circled plus, the document, the bubble and the sparkles — and the rest of
  // the set as strokes. Holes (the doorway, the plus, the ruled lines, the
  // folded corner) are inner subpaths knocked out by `fill-rule: evenodd`.
  'today',
  'leads',
  'capture',
  'onboarding',
  'messages',
  'ask',
  'star',
  'sparkle',
]);

const PATHS: Record<LvIconName, string> = {
  today: 'M12 2.6 22.5 11.5h-2.9v9.9H4.4v-9.9H1.5L12 2.6ZM12 12.8a2.6 2.6 0 0 0-2.6 2.6v6h5.2v-6a2.6 2.6 0 0 0-2.6-2.6Z',
  leads: 'M12 11.6a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM12 13c-3.5 0-6.3 2.2-6.3 4.9v1.3a.8.8 0 0 0 .8.8h11a.8.8 0 0 0 .8-.8v-1.3c0-2.7-2.8-4.9-6.3-4.9ZM5.4 11.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5.6 12.7a4.2 4.2 0 0 0-4.5 4.1.7.7 0 0 0 .7.7h3v-1.6c0-1.2.3-2.3.8-3.2ZM18.6 11.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.4 12.7c.5.9.8 2 .8 3.2v1.6h3a.7.7 0 0 0 .7-.7 4.2 4.2 0 0 0-4.5-4.1Z',
  capture: 'M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4ZM12.95 7.6v3.45h3.45v1.9h-3.45v3.45h-1.9v-3.45H7.6v-1.9h3.45V7.6h1.9Z',
  onboarding: 'M6.2 2.6h7.4l5.2 5.2v13.6a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 21.4V3.8a1.2 1.2 0 0 1 1.2-1.2ZM13.6 2.6 18.8 7.8h-4.4a.8.8 0 0 1-.8-.8V2.6ZM8.2 11.4h7.6v1.7H8.2ZM8.2 14.6h7.6v1.7H8.2ZM8.2 17.8h4.6v1.7H8.2Z',
  messages: 'M5.4 3.9h13.2a2.4 2.4 0 0 1 2.4 2.4v7.6a2.4 2.4 0 0 1-2.4 2.4H9.2l-3.9 3.3a.8.8 0 0 1-1.3-.6v-2.7a2.4 2.4 0 0 1-1-2V6.3a2.4 2.4 0 0 1 2.4-2.4ZM6.8 8.2h10.4v1.7H6.8ZM6.8 11.6h6.6v1.7H6.8Z',
  ask: 'm9.8 4.6 2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2 2-5.4ZM18.4 3.4l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5ZM18.6 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.5 13h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z',
  phone: 'M6.2 3.8h3l1.5 3.7-1.9 1.4a11.5 11.5 0 0 0 5.3 5.3l1.4-1.9 3.7 1.5v3a1.7 1.7 0 0 1-1.9 1.7A15.8 15.8 0 0 1 4.5 5.7a1.7 1.7 0 0 1 1.7-1.9Z',
  whatsapp: 'M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.3ZM9 8.6c.4-.1.8 0 1 .4l.7 1.3c.2.3.1.7-.1 1l-.5.5a6 6 0 0 0 2.6 2.6l.5-.5c.3-.2.7-.3 1-.1l1.3.7c.4.2.5.6.4 1a2 2 0 0 1-2.4 1.4 8.6 8.6 0 0 1-6-6A2 2 0 0 1 9 8.6Z',
  email: 'M3.5 6.5h17v11h-17v-11ZM4 7l8 5.5L20 7',
  meeting: 'M4.5 5.5h15v14h-15v-14ZM8 3.5v4M16 3.5v4M4.5 10.5h15M9 14.5h2M9 17h6',
  instagram: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4ZM12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM17.2 6.9h.01',
  website: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z',
  note: 'M6 3.5h12a.5.5 0 0 1 .5.5v16l-3-2-3 2-3-2-3 2V4a.5.5 0 0 1 .5-.5ZM9 8h6M9 12h6',
  partner: 'M12 20.5s-7.5-4.3-7.5-9.4A4.1 4.1 0 0 1 12 8.4a4.1 4.1 0 0 1 7.5 2.7c0 5.1-7.5 9.4-7.5 9.4Z',
  property: 'M3.5 10 12 3.5l8.5 6.5V20a.5.5 0 0 1-.5.5h-4.5V15h-6v5.5H4a.5.5 0 0 1-.5-.5v-10Z',
  experience: 'm3.5 19 5-9 3.5 5 2.5-3.5 6 7.5h-17ZM16.5 8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  document: 'M6.5 3.5h8l4 4V20a.5.5 0 0 1-.5.5H6.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4.5',
  task: 'M4.5 6.5h15M4.5 12h15M4.5 17.5h9M17 16l1.6 1.8 3-3.4',
  organisation: 'M4.5 20.5v-16h9v16M13.5 10.5h6v10M7.5 8h3M7.5 12h3M7.5 16h3M16 14h1M16 17.5h1M2.5 20.5h19',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  sparkle: 'm12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  bell: 'M6 9.5a6 6 0 1 1 12 0c0 3.2.8 5 1.5 6h-15c.7-1 1.5-2.8 1.5-6ZM10 19a2 2 0 0 0 4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2 20.5 20.5',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2',
  warning: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.2h.01',
  check: 'm4.5 12.5 5 5 10-11',
  chevronRight: 'm9.5 5 7 7-7 7',
  chevronDown: 'm5 9.5 7 7 7-7',
  chevronLeft: 'm14.5 5-7 7 7 7',
  chevronUp: 'm5 14.5 7-7 7 7',
  filter: 'M3.5 5.5h17l-6.5 7.5v6l-4 2v-8L3.5 5.5Z',
  chart: 'M4 20.5h16M7 20.5V11M12 20.5V5M17 20.5v-6',
  signout: 'M14 3.5H6a.5.5 0 0 0-.5.5v16a.5.5 0 0 0 .5.5h8M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5',
  download: 'M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 18.5v2h15v-2',
  trash: 'M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5 7.5 20h9l1-13.5M10 10v6M14 10v6',
  image: 'M4 4.5h16a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3.5 16.5 9 11l4 4 3-2.5 4.5 4',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.6h.01',
  plus: 'M12 5v14M5 12h14',
  more: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  camera: 'M4 7.5h3.5L9 5h6l1.5 2.5H20a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V8a.5.5 0 0 1 .5-.5ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  microphone: 'M12 3.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5ZM6 11.5a6 6 0 0 0 12 0M12 17.5v3M9 20.5h6',
  upload: 'M12 16.5V4.5M7.5 9 12 4.5 16.5 9M4.5 16.5v3a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5v-3',
  star: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8L12 3.5Z',
  // A disc with eight rays: the plain, universally legible sun. Drawn open
  // rather than filled so it keeps the weight of the glyphs beside it.
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  // A waxing crescent, for the evening greeting.
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  location: 'M12 20.5s-6.5-5.3-6.5-10a6.5 6.5 0 1 1 13 0c0 4.7-6.5 10-6.5 10ZM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
};

export const LvIcon = ({
  name,
  size = 18,
  colour = 'currentColor',
  weight = 1.75,
  title,
  style,
}: {
  name: LvIconName;
  size?: number;
  colour?: string;
  /** Stroke width, for the few places the reference draws a heavier mark. */
  weight?: number;
  // Only when the glyph alone carries the meaning; otherwise leave it out and
  // let the surrounding control provide the accessible name.
  title?: string;
  style?: CSSProperties;
}) => {
  const filled = FILLED.has(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? colour : 'none'}
      fillRule="evenodd"
      clipRule="evenodd"
      stroke={filled ? 'none' : colour}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      style={{ display: 'block', flex: '0 0 auto', ...style }}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
};

// The glyph that represents an interaction channel, so a timeline entry and a
// row action never disagree about what a WhatsApp message looks like.
export const channelIcon = (channel: string | null | undefined): LvIconName => {
  switch ((channel ?? '').toUpperCase()) {
    case 'PHONE':
      return 'phone';
    case 'WHATSAPP':
      return 'whatsapp';
    case 'EMAIL':
      return 'email';
    case 'MEETING':
    case 'VIDEO_CALL':
      return 'meeting';
    case 'INSTAGRAM':
      return 'instagram';
    case 'LINKEDIN':
    case 'WEBSITE':
    case 'FORM':
      return 'website';
    case 'DOCUMENT':
      return 'document';
    default:
      return 'note';
  }
};
