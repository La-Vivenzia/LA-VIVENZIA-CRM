import { describe, expect, it } from 'vitest';

import {
  extractMentionedWorkspaceMemberIds,
  newlyMentioned,
} from 'src/modules/lv-notifications/utils/mentions';

const mention = (props: Record<string, string>) => ({ type: 'mention', props });

const body = (content: unknown[]) =>
  JSON.stringify([
    { id: 'b1', type: 'paragraph', props: {}, content, children: [] },
  ]);

describe('extractMentionedWorkspaceMemberIds', () => {
  it('finds a member mention stored the new way (objectNameSingular)', () => {
    const blocknote = body([
      { type: 'text', text: 'Ping ', styles: {} },
      mention({ recordId: 'wm-1', objectNameSingular: 'workspaceMember', label: 'Jony' }),
    ]);

    expect(extractMentionedWorkspaceMemberIds({ blocknote })).toEqual(['wm-1']);
  });

  it('finds a legacy mention through the object metadata id', () => {
    const blocknote = body([mention({ recordId: 'wm-2', objectMetadataId: 'meta-wm' })]);

    expect(
      extractMentionedWorkspaceMemberIds({
        blocknote,
        workspaceMemberObjectMetadataId: 'meta-wm',
      }),
    ).toEqual(['wm-2']);
    expect(extractMentionedWorkspaceMemberIds({ blocknote })).toEqual([]);
  });

  it('ignores mentions of other objects — a lead chip is not a person', () => {
    const blocknote = body([
      mention({ recordId: 'lead-1', objectNameSingular: 'lvLead' }),
      mention({ recordId: 'p-1', objectNameSingular: 'person' }),
    ]);

    expect(extractMentionedWorkspaceMemberIds({ blocknote })).toEqual([]);
  });

  it('walks nested blocks and de-duplicates', () => {
    const blocknote = JSON.stringify([
      {
        type: 'bulletListItem',
        content: [mention({ recordId: 'wm-1', objectNameSingular: 'workspaceMember' })],
        children: [
          {
            type: 'paragraph',
            content: [
              mention({ recordId: 'wm-1', objectNameSingular: 'workspaceMember' }),
              mention({ recordId: 'wm-3', objectNameSingular: 'workspaceMember' }),
            ],
          },
        ],
      },
    ]);

    expect(extractMentionedWorkspaceMemberIds({ blocknote })).toEqual(['wm-1', 'wm-3']);
  });

  it('tolerates an empty or malformed body', () => {
    expect(extractMentionedWorkspaceMemberIds({ blocknote: null })).toEqual([]);
    expect(extractMentionedWorkspaceMemberIds({ blocknote: '' })).toEqual([]);
    expect(extractMentionedWorkspaceMemberIds({ blocknote: '{not json' })).toEqual([]);
    expect(extractMentionedWorkspaceMemberIds({ blocknote: '"a string"' })).toEqual([]);
  });
});

describe('newlyMentioned', () => {
  it('returns only people added by the edit', () => {
    expect(newlyMentioned(['a', 'b'], ['b', 'c'])).toEqual(['c']);
    expect(newlyMentioned([], ['a'])).toEqual(['a']);
    expect(newlyMentioned(['a'], ['a'])).toEqual([]);
  });
});
