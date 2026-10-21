import { VisuallyHidden } from 'src/design/kit';
import { type LvTheme, type LvTint } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// Charts, drawn by hand in SVG.
//
// There is no chart library here on purpose: the CRM shows counts and one
// trend, and a 300KB dependency to draw a dozen rectangles would be the
// largest thing in the bundle. Everything is plain <svg>, so it themes with
// tokens and costs nothing.
//
// Two rules. Every chart prints its numbers as text as well as drawing them,
// so nobody needs a tooltip — or sight — to read it. And on a phone the bars
// turn horizontal, because a vertical bar chart with rotated category labels
// is unreadable at 390px and nobody rotates their head.

export type LvSeriesPoint = { key: string; label: string; value: number; tint?: LvTint };

/** Categories beyond the tenth become "Other", so the axis stays legible. */
const GROUP_AFTER = 10;

const condense = (data: LvSeriesPoint[]): LvSeriesPoint[] => {
  if (data.length <= GROUP_AFTER) {
    return data;
  }

  const head = data.slice(0, GROUP_AFTER - 1);
  const rest = data.slice(GROUP_AFTER - 1);

  return [...head, { key: '__other', label: 'Other', value: rest.reduce((sum, point) => sum + point.value, 0) }];
};

export const LvBarChart = ({
  theme,
  data,
  caption,
  tint = 'mint',
}: {
  theme: LvTheme;
  data: LvSeriesPoint[];
  /** Names the chart. Always rendered — as a heading, not a tooltip. */
  caption: string;
  tint?: LvTint;
}) => {
  const tier = useLvTier();
  const points = condense(data);
  const max = Math.max(1, ...points.map((point) => point.value));
  const horizontal = tier === 'mobile';

  if (points.length === 0) {
    return null;
  }

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: theme.space(3) }}>{caption}</figcaption>

      {horizontal ? (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
          {points.map((point) => (
            <li key={point.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
              <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, flex: '0 0 35%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {point.label}
              </span>
              <span aria-hidden="true" style={{ flex: 1, height: 10, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${(point.value / max) * 100}%`,
                    background: theme.tint[point.tint ?? tint].ink,
                    borderRadius: theme.radius.pill,
                  }}
                />
              </span>
              <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{point.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: theme.space(3), height: 160 }}>
          {points.map((point) => (
            <div key={point.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.space(1), height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ ...theme.type.bodySmall, color: theme.color.heading, fontVariantNumeric: 'tabular-nums' }}>{point.value}</span>
              <span
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: `${Math.max(2, (point.value / max) * 100)}%`,
                  background: theme.tint[point.tint ?? tint].ink,
                  borderRadius: `${theme.radius.sm}px ${theme.radius.sm}px 0 0`,
                }}
              />
              <span
                style={{ ...theme.type.caption, color: theme.color.textMuted, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={point.label}
              >
                {point.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <VisuallyHidden>
        {caption}: {points.map((point) => `${point.label} ${point.value}`).join(', ')}.
      </VisuallyHidden>
    </figure>
  );
};

/**
 * A trend line small enough to sit inside a tile. It never stands alone: the
 * figure it belongs to is printed beside it.
 */
export const LvSparkline = ({
  theme,
  values,
  label,
  width = 120,
  height = 32,
}: {
  theme: LvTheme;
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) => {
  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)} ${(height - ((value - min) / span) * height).toFixed(1)}`).join(' ');
  const rising = values[values.length - 1] >= values[0];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${rising ? 'rising' : 'falling'}, from ${values[0]} to ${values[values.length - 1]}`}>
        <path d={path} fill="none" stroke={rising ? theme.color.success : theme.color.danger} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

/**
 * A ring for one percentage — onboarding progress, document completeness. The
 * number sits in the middle, so the ring is decoration over a fact rather than
 * the fact itself.
 */
export const LvRing = ({
  theme,
  percentage,
  label,
  size = 96,
}: {
  theme: LvTheme;
  percentage: number;
  label: string;
  size?: number;
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <figure style={{ margin: 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: theme.space(2) }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${clamped} per cent`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.color.surfaceSunken} strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.color.brand}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={theme.color.heading} style={{ ...theme.type.subheading, fontSize: size / 4 }}>
          {clamped}%
        </text>
      </svg>
      <figcaption style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{label}</figcaption>
    </figure>
  );
};

/**
 * A proportion split across a few categories. Rendered as a single stacked bar
 * rather than a pie: a pie of five slices is harder to compare than one bar,
 * and it survives a phone without changing shape.
 */
export const LvDonut = ({ theme, data, caption }: { theme: LvTheme; data: LvSeriesPoint[]; caption: string }) => {
  const points = condense(data).filter((point) => point.value > 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);

  if (total === 0) {
    return null;
  }

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: theme.space(2) }}>{caption}</figcaption>
      <div aria-hidden="true" style={{ display: 'flex', height: 12, borderRadius: theme.radius.pill, overflow: 'hidden', background: theme.color.surfaceSunken }}>
        {points.map((point, index) => (
          <span
            key={point.key}
            style={{ width: `${(point.value / total) * 100}%`, background: theme.tint[point.tint ?? (['mint', 'blue', 'peach', 'lavender', 'pink'] as const)[index % 5]].ink }}
          />
        ))}
      </div>
      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: `${theme.space(1)}px ${theme.space(4)}px`, margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none' }}>
        {points.map((point, index) => (
          <li key={point.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: theme.radius.pill,
                background: theme.tint[point.tint ?? (['mint', 'blue', 'peach', 'lavender', 'pink'] as const)[index % 5]].ink,
              }}
            />
            {point.label} <span style={{ color: theme.color.heading, fontVariantNumeric: 'tabular-nums' }}>{point.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};
