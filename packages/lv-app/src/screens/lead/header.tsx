import { useEffect, useRef, useState, type ReactNode } from 'react';

import { type Lead360 } from 'src/api/leads';
import { LV_ASSETS } from 'src/design/shell';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar, LvBadge, LvButton } from 'src/design/kit';
import { LvQuickActions } from 'src/design/page';
import { describeStatus, statusBadgeTone } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// The identity of a relationship, as A4 and M3 draw it.
//
// It is deliberately editorial rather than a contact record: a photograph the
// width of the page where one exists, the name set large, and underneath it
// only the facts a person checks before picking up the phone — where they are,
// how long they have done this, how they are rated, and the reference.
//
// The rating never appears without its count. 4.8 from three people is not the
// same fact as 4.8 from three hundred, and the boards show both for a reason.
// Nothing here is invented: a lead with no photograph gets its initials, a lead
// with no rating simply has no rating line.

const sentence = (value: string | null | undefined): string =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '';

export const leadMeta = (lead: Lead360['lead']): { icon: LvIconName; text: string }[] => [
  ...(lead.location ? [{ icon: 'location' as const, text: lead.location }] : []),
  ...(typeof lead.yearsOfExperience === 'number' ? [{ icon: 'clock' as const, text: `${lead.yearsOfExperience} years exp.` }] : []),
  ...(typeof lead.rating === 'number'
    ? [
        {
          icon: 'star' as const,
          text: `${lead.rating.toFixed(1)}${typeof lead.reviewCount === 'number' ? ` (${lead.reviewCount})` : ''}`,
        },
      ]
    : []),
  ...(lead.lvLeadId ? [{ icon: 'person' as const, text: lead.lvLeadId }] : []),
];

/** The channels this lead can actually be reached on. Nothing else is offered. */
export const leadChannels = (lead: Lead360['lead']) => {
  const phone = lead.phones?.primaryPhoneNumber ?? null;
  const email = lead.emails?.primaryEmail ?? null;

  return {
    phone,
    email,
    whatsapp: phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null,
  };
};

const MetaList = ({ theme, meta, inverse }: { theme: LvTheme; meta: { icon: LvIconName; text: string }[]; inverse?: boolean }) =>
  meta.length === 0 ? null : (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: `2px ${theme.space(4)}px`, margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none' }}>
      {meta.map((item) => (
        <li
          key={item.text}
          style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: inverse ? 'rgba(243,239,231,0.88)' : theme.color.textMuted }}
        >
          <span aria-hidden="true" style={{ display: 'inline-flex', opacity: 0.85 }}>
            <LvIcon name={item.icon} size={15} />
          </span>
          {item.text}
        </li>
      ))}
    </ul>
  );

/**
 * The bar that replaces the header once it has scrolled away on a phone: back,
 * the face, the name, the overflow. Identity stays available without keeping a
 * 300px header on a 640px screen.
 */
const CompactHeader = ({
  theme,
  lead,
  onBack,
  overflow,
  visible,
}: {
  theme: LvTheme;
  lead: Lead360['lead'];
  onBack: () => void;
  overflow?: ReactNode;
  visible: boolean;
}) => (
  <div
    className="lv-lead-compact"
    aria-hidden={!visible}
    style={{
      background: theme.color.surfaceRaised,
      borderBottom: `1px solid ${theme.color.border}`,
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: `opacity ${theme.motion.duration.fast}ms ${theme.motion.easing}`,
    }}
  >
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to my leads"
      className="lv-icon-button"
      tabIndex={visible ? 0 : -1}
      style={{
        width: 38,
        height: 38,
        flex: '0 0 auto',
        borderRadius: theme.radius.pill,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.surface,
        color: theme.color.textMuted,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LvIcon name="chevronLeft" size={18} />
    </button>
    <LvAvatar theme={theme} name={lead.name ?? 'Lead'} src={lead.photoUrl} size={32} />
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lead.name ?? 'Unnamed lead'}
      </span>
      {lead.location && (
        <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.location}
        </span>
      )}
    </span>
    {overflow}
  </div>
);

export const LeadHeader = ({
  theme,
  data,
  onBack,
  onAction,
  overflow,
}: {
  theme: LvTheme;
  data: Lead360;
  onBack: () => void;
  /** Opens one of the Day 1 action dialogs. */
  onAction: (action: 'interaction' | 'task' | 'note' | 'status') => void;
  overflow?: ReactNode;
}) => {
  const tier = useLvTier();
  const { lead, capabilities } = data;
  const status = describeStatus('lead', lead.status);
  const channels = leadChannels(lead);
  const sentinel = useRef<HTMLElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);

  // The compact bar appears once the real header has left the screen.
  //
  // A scroll listener rather than an IntersectionObserver: the observer's
  // implicit root is the top-level viewport, so inside a scrolled or clipped
  // container it can simply never fire. The read is one getBoundingClientRect
  // on one element, done straight in the handler — batching it into a frame
  // callback sounds tidier but requestAnimationFrame is throttled in a
  // backgrounded or occluded frame, and then the bar never appears at all.
  useEffect(() => {
    const read = () => {
      const node = sentinel.current;

      if (node) {
        // Gone once its last pixel is above the shell's own sticky bar.
        setScrolledPast(node.getBoundingClientRect().bottom <= 72);
      }
    };

    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read, { passive: true });

    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  const subtitle = [lead.jobTitle, lead.organisationName].filter(Boolean).join(' · ');
  const meta = leadMeta(lead);

  // On a phone the photograph is the page's own hero, full-bleed, with the
  // identity card riding up over its lower edge — M3. On a wider screen it is
  // a band inside the card, because a full-bleed image beside a 240px sidebar
  // reads as a banner advert.
  // A TEXT field the partner never filled in comes back as "", not null, and
  // an empty src makes the browser re-request the page itself.
  const hero = lead.photoUrl || null;

  return (
    <>
      {tier === 'mobile' && <CompactHeader theme={theme} lead={lead} onBack={onBack} overflow={overflow} visible={scrolledPast} />}

      <section ref={sentinel} className="lv-lead-header" aria-label={`${lead.name ?? 'Lead'} identity`}>
        <div
          className="lv-lead-hero"
          style={{
            background: hero ? theme.color.surfaceInverse : theme.tint.mint.wash,
            borderRadius: `${theme.radius.xl}px ${theme.radius.xl}px 0 0`,
          }}
        >
          <img
            className="lv-lead-hero-image"
            src={hero ?? LV_ASSETS.hero}
            srcSet={hero ? undefined : `${LV_ASSETS.heroSmall} 1000w, ${LV_ASSETS.hero} 2000w`}
            alt=""
            aria-hidden="true"
            style={{ opacity: hero ? 1 : 0.55 }}
          />
          <span
            aria-hidden="true"
            className="lv-lead-hero-veil"
            style={{ background: `linear-gradient(180deg, rgba(22,38,30,0.15) 0%, rgba(22,38,30,0.05) 45%, ${theme.color.surfaceRaised} 100%)` }}
          />
          {/* On a phone the two controls float on the photograph, as M3 shows. */}
          <div className="lv-lead-hero-controls">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to my leads"
              className="lv-icon-button"
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.pill,
                border: 'none',
                background: theme.color.surfaceRaised,
                color: theme.color.heading,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: theme.shadow.md,
              }}
            >
              <LvIcon name="chevronLeft" size={19} />
            </button>
            <span style={{ flex: 1 }} />
            {overflow}
          </div>
        </div>

        <div className="lv-lead-identity-card" style={{ background: theme.color.surfaceRaised, borderRadius: `0 0 ${theme.radius.xl}px ${theme.radius.xl}px` }}>
          <div className="lv-lead-identity-top">
            <LvAvatar theme={theme} name={lead.name ?? 'Lead'} src={lead.photoUrl} size={72} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
                <h1 className="lv-lead-name" style={{ ...theme.type.title, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>
                  {lead.name ?? 'Unnamed lead'}
                </h1>
                <LvBadge theme={theme} tone={statusBadgeTone('lead', lead.status)}>
                  {status.label}
                </LvBadge>
                {lead.priority === 'HIGH' && (
                  <LvBadge theme={theme} tone="warning">
                    High priority
                  </LvBadge>
                )}
              </div>
              {subtitle && <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{subtitle}</p>}
              <MetaList theme={theme} meta={meta} />
            </div>

            <div className="lv-lead-header-actions">
              {channels.phone && (
                <LvButton theme={theme} variant="primary" icon={<LvIcon name="phone" size={16} />} onClick={() => window.open(`tel:${channels.phone}`)}>
                  Call
                </LvButton>
              )}
              {channels.whatsapp && (
                <LvButton theme={theme} variant="secondary" icon={<LvIcon name="whatsapp" size={16} />} onClick={() => window.open(channels.whatsapp as string, '_blank', 'noreferrer')}>
                  WhatsApp
                </LvButton>
              )}
            </div>
          </div>

          {/* M3's four-up row: the things you do, one tap away, before any tab.
              A channel the lead has no address for is shown disabled rather
              than hidden, so the row does not reshuffle between records. */}
          <LvQuickActions
            theme={theme}
            actions={[
              { key: 'call', label: 'Call', icon: 'phone', disabled: !channels.phone, onSelect: () => channels.phone && window.open(`tel:${channels.phone}`) },
              {
                key: 'whatsapp',
                label: 'WhatsApp',
                icon: 'whatsapp',
                disabled: !channels.whatsapp,
                onSelect: () => channels.whatsapp && window.open(channels.whatsapp, '_blank', 'noreferrer'),
              },
              { key: 'email', label: 'Email', icon: 'email', disabled: !channels.email, onSelect: () => channels.email && window.open(`mailto:${channels.email}`) },
              { key: 'log', label: 'Log', icon: 'note', disabled: !capabilities.canLogInteraction, onSelect: () => onAction('interaction') },
            ]}
          />
        </div>
      </section>
    </>
  );
};

export { sentence as sentenceCase };
