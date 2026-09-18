import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ON_NOTE_CREATED_ID } from 'src/constants/universal-identifiers';
import {
  handleNoteMentions,
  type NoteEvent,
} from 'src/modules/lv-notifications/services/mention-handler';

// MENTION notifications for a newly written note. See mention-handler.ts.

export const handler = (payload: NoteEvent) => handleNoteMentions(payload);

export default defineLogicFunction({
  universalIdentifier: FN_ON_NOTE_CREATED_ID,
  name: 'lv-on-note-created',
  description: 'Notifies workspace members @-mentioned in a new note',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'note.created' },
});
