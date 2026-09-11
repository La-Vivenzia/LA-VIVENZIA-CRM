import { describe, expect, it } from 'vitest';

import { ownerChangeFromEvent, type OwnerChangeEvent } from 'src/modules/lv-notifications/on-lead-updated.logic-function';
import { mentionsFromNoteEvent, type NoteEvent } from 'src/modules/lv-notifications/services/mention-handler';

// The parts of each producer that read the database event. The write path is
// the shared service, tested in notification-service.test.ts; the live flow is
// exercised by the integration test against a running server.

const leadEvent = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  workspaceMemberId?: string,
): OwnerChangeEvent =>
  ({
    name: 'lvLead.updated',
    workspaceId: 'ws',
    objectMetadata: {} as never,
    recordId: 'lead-1',
    workspaceMemberId,
    properties: {
      updatedFields: Object.keys(after),
      diff: {},
      before: { id: 'lead-1', name: 'Forest Table', priority: 'HIGH', ...before },
      after: {
        id: 'lead-1',
        name: 'Forest Table',
        priority: 'HIGH',
        updatedAt: '2026-09-11T10:00:00.000Z',
        ...after,
      },
    },
  }) as unknown as OwnerChangeEvent;

describe('ownerChangeFromEvent', () => {
  it('reads an assignment: no owner → owner', () => {
    expect(leadEvent({ ownerId: null }, { ownerId: 'wm-a' }, 'wm-admin')).toBeDefined();
    expect(ownerChangeFromEvent(leadEvent({ ownerId: null }, { ownerId: 'wm-a' }, 'wm-admin'))).toEqual({
      leadId: 'lead-1',
      leadName: 'Forest Table',
      previousOwnerWorkspaceMemberId: null,
      newOwnerWorkspaceMemberId: 'wm-a',
      priority: 'HIGH',
      changedAt: '2026-09-11T10:00:00.000Z',
      actorWorkspaceMemberId: 'wm-admin',
    });
  });

  it('reads a reassignment and keeps both sides', () => {
    const change = ownerChangeFromEvent(leadEvent({ ownerId: 'wm-a' }, { ownerId: 'wm-b' }));

    expect(change?.previousOwnerWorkspaceMemberId).toBe('wm-a');
    expect(change?.newOwnerWorkspaceMemberId).toBe('wm-b');
    // System change (assignment engine): no actor.
    expect(change?.actorWorkspaceMemberId).toBeNull();
  });

  it('ignores updates that did not touch the owner', () => {
    expect(
      ownerChangeFromEvent(leadEvent({ ownerId: 'wm-a', status: 'NEW' }, { ownerId: 'wm-a', status: 'CONTACTED' })),
    ).toBeNull();
  });

  it('takes the actor from the event envelope, never from the record', () => {
    const change = ownerChangeFromEvent(
      leadEvent({ ownerId: null }, { ownerId: 'wm-a', actorWorkspaceMemberId: 'forged' }, 'wm-real'),
    );

    expect(change?.actorWorkspaceMemberId).toBe('wm-real');
  });
});

const noteEvent = (
  after: Record<string, unknown>,
  before?: Record<string, unknown>,
  workspaceMemberId?: string,
): NoteEvent =>
  ({
    name: before ? 'note.updated' : 'note.created',
    workspaceId: 'ws',
    objectMetadata: {} as never,
    recordId: 'note-1',
    workspaceMemberId,
    properties: before
      ? { updatedFields: ['bodyV2'], diff: {}, before: { id: 'note-1', ...before }, after: { id: 'note-1', ...after } }
      : { after: { id: 'note-1', ...after } },
  }) as unknown as NoteEvent;

const bodyWith = (...memberIds: string[]) =>
  JSON.stringify([
    {
      type: 'paragraph',
      content: memberIds.map((recordId) => ({
        type: 'mention',
        props: { recordId, objectNameSingular: 'workspaceMember' },
      })),
    },
  ]);

describe('mentionsFromNoteEvent', () => {
  it('collects mentions from a new note and the author from the event', () => {
    const parsed = mentionsFromNoteEvent(
      noteEvent({ title: 'Visit', bodyV2: { blocknote: bodyWith('wm-1', 'wm-2') } }, undefined, 'wm-author'),
    );

    expect(parsed).toEqual({
      noteId: 'note-1',
      noteTitle: 'Visit',
      mentioned: ['wm-1', 'wm-2'],
      actorWorkspaceMemberId: 'wm-author',
    });
  });

  it('on edit, only reports people newly mentioned', () => {
    const parsed = mentionsFromNoteEvent(
      noteEvent(
        { bodyV2: { blocknote: bodyWith('wm-1', 'wm-3') } },
        { bodyV2: { blocknote: bodyWith('wm-1') } },
        'wm-author',
      ),
    );

    expect(parsed?.mentioned).toEqual(['wm-3']);
  });

  it('falls back to the note’s createdBy when the event carries no member', () => {
    const parsed = mentionsFromNoteEvent(
      noteEvent({ bodyV2: { blocknote: bodyWith('wm-1') }, createdBy: { workspaceMemberId: 'wm-c' } }),
    );

    expect(parsed?.actorWorkspaceMemberId).toBe('wm-c');
  });
});
