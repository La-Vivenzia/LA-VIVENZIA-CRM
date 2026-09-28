import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LvIcon, channelIcon } from 'src/modules/lv-core/ui/icons';
import { LvActionRow, LvAvatar, LvCounter, LvIconTile, LvProgress, LvSearchField, LvTabs } from 'src/modules/lv-core/ui/kit';
import { LV_TINTS, themeFor } from 'src/modules/lv-core/ui/theme';

// The reference-system primitives are rendered rather than eyeballed: each one
// carries an accessibility contract (a name on every control, a real
// progressbar, tabs that say which one is selected) that a restyle could
// silently break.

const theme = themeFor('light');
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe('LvAvatar', () => {
  it('falls back to two initials when there is no photo', () => {
    expect(html(<LvAvatar theme={theme} name="Raj Malhotra" />)).toContain('RM');
  });

  it('uses the photo when there is one, and never announces itself twice', () => {
    const markup = html(<LvAvatar theme={theme} name="Raj Malhotra" src="https://example.test/raj.jpg" />);

    expect(markup).toContain('raj.jpg');
    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('survives a name that is empty or a single word', () => {
    expect(html(<LvAvatar theme={theme} name="" />)).toContain('·');
    expect(html(<LvAvatar theme={theme} name="Priya" />)).toContain('P');
  });
});

describe('LvActionRow', () => {
  const row = html(
    <LvActionRow
      theme={theme}
      title="Raj Malhotra"
      subtitle="Adventure Host · Lonavala"
      urgent="Follow-up overdue by 1 day"
      action={<button type="button">Call</button>}
      onOpen={() => {}}
    />,
  );

  it('shows the context and the reason it is in front of you', () => {
    expect(row).toContain('Raj Malhotra');
    expect(row).toContain('Adventure Host');
    expect(row).toContain('Follow-up overdue by 1 day');
  });

  it('gives the chevron an accessible name so it is not an unlabelled button', () => {
    expect(row).toContain('aria-label="Open Raj Malhotra"');
  });

  it('keeps the row action separate from opening the record', () => {
    expect(row.match(/<button/g)?.length).toBe(2);
  });

  it('can stand for something that is not a person', () => {
    expect(html(<LvActionRow theme={theme} title="Documents" icon="document" tint="blue" />)).toContain('<svg');
  });
});

describe('LvCounter', () => {
  it('counts the work with its label', () => {
    const markup = html(<LvCounter theme={theme} icon="phone" tint="mint" count={4} label="Calls" />);

    expect(markup).toContain('4');
    expect(markup).toContain('Calls');
  });

  it('is only a button when it goes somewhere', () => {
    expect(html(<LvCounter theme={theme} icon="phone" tint="mint" count={0} label="Calls" />)).not.toContain('<button');
    expect(html(<LvCounter theme={theme} icon="phone" tint="mint" count={0} label="Calls" onClick={() => {}} />)).toContain('<button');
  });
});

describe('LvTabs', () => {
  const markup = html(
    <LvTabs
      theme={theme}
      label="Lead sections"
      value="overview"
      onChange={() => {}}
      tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'documents', label: 'Documents', count: 4 },
      ]}
    />,
  );

  it('is a labelled tablist with a selected tab', () => {
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Lead sections"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup.match(/aria-selected="false"/g)?.length).toBe(1);
  });

  it('shows a count beside a tab when there is one', () => {
    expect(markup).toContain('Documents');
    expect(markup).toContain('>4<');
  });
});

describe('LvSearchField', () => {
  it('labels the input without showing the label twice', () => {
    const markup = html(<LvSearchField theme={theme} value="" onChange={() => {}} label="Search the CRM" placeholder="Search anything…" />);

    expect(markup).toContain('Search the CRM');
    expect(markup).toContain('placeholder="Search anything…"');
    expect(markup).toMatch(/<label[^>]*for="[^"]+"/);
    expect(markup).toMatch(/<input[^>]*id="[^"]+"/);
  });
});

describe('LvProgress', () => {
  const markup = html(<LvProgress theme={theme} percentage={70} caption="Documents pending" pending={['PAN', 'Business proof']} />);

  it('is a real progressbar with its value', () => {
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="70"');
    expect(markup).toContain('70%');
  });

  it('names what is missing rather than counting it', () => {
    expect(markup).toContain('PAN');
    expect(markup).toContain('Business proof');
  });

  it('clamps a value that arrives out of range', () => {
    expect(html(<LvProgress theme={theme} percentage={140} />)).toContain('aria-valuenow="100"');
    expect(html(<LvProgress theme={theme} percentage={-5} />)).toContain('aria-valuenow="0"');
  });
});

describe('icons', () => {
  it('are decorative unless the glyph alone carries the meaning', () => {
    expect(html(<LvIcon name="phone" />)).toContain('aria-hidden="true"');

    const titled = html(<LvIcon name="phone" title="Call" />);

    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Call</title>');
  });

  it('map every interaction channel to a glyph, including unknown ones', () => {
    expect(channelIcon('WHATSAPP')).toBe('whatsapp');
    expect(channelIcon('VIDEO_CALL')).toBe('meeting');
    expect(channelIcon('SOMETHING_NEW')).toBe('note');
    expect(channelIcon(null)).toBe('note');
  });
});

describe('category tints', () => {
  it.each(LV_TINTS)('%s has a wash and an ink in both schemes', (tint) => {
    for (const scheme of ['light', 'dark'] as const) {
      const { wash, ink } = themeFor(scheme).tint[tint];

      expect(wash).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(wash).not.toBe(ink);
    }
  });

  it('renders a tile that uses the tint rather than a literal colour', () => {
    const markup = html(<LvIconTile theme={theme} icon="today" tint="peach" />);

    expect(markup).toContain(theme.tint.peach.wash);
    expect(markup).toContain(theme.tint.peach.ink);
  });
});
