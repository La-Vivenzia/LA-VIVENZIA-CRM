import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ON_NOTE_UPDATED_ID } from 'src/constants/universal-identifiers';
import {
  handleNoteMentions,
  type NoteEvent,
} from 'src/modules/lv-notifications/services/mention-handler';

// MENTION notifications for people newly @-mentioned by an edit. People already
// mentioned before the edit are not told again. See mention-handler.ts.

export const handler = (payload: NoteEvent) => handleNoteMentions(payload);

export default defineLogicFunction({
  universalIdentifier: FN_ON_NOTE_UPDATED_ID,
  name: 'lv-on-note-updated',
  description: 'Notifies workspace members newly @-mentioned when a note is edited',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'note.updated' },
});
