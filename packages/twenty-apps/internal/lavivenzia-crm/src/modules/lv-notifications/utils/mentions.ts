// Extracts workspace-member mentions from a Twenty note body.
//
// Twenty's note editor (BlockNote) stores `bodyV2.blocknote` as JSON. An
// @-mention is an inline content node of type "mention" carrying the record
// it points at. Newer notes store `objectNameSingular`; older ones only
// `objectMetadataId`, which is why callers may pass the workspaceMember
// object metadata id as well. This is Twenty's own mention primitive — LV
// adds no syntax of its own.

type InlineNode = {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
};

const WORKSPACE_MEMBER = 'workspaceMember';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const collectMentions = (
  node: unknown,
  out: Set<string>,
  workspaceMemberObjectMetadataId: string | null,
): void => {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectMentions(child, out, workspaceMemberObjectMetadataId);
    }

    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const inline = node as InlineNode;

  if (inline.type === 'mention' && isRecord(inline.props)) {
    const recordId = inline.props.recordId;
    const objectNameSingular = inline.props.objectNameSingular;
    const objectMetadataId = inline.props.objectMetadataId;

    const isMember =
      objectNameSingular === WORKSPACE_MEMBER ||
      (workspaceMemberObjectMetadataId !== null &&
        objectMetadataId === workspaceMemberObjectMetadataId);

    if (isMember && typeof recordId === 'string' && recordId.length > 0) {
      out.add(recordId);
    }
  }

  collectMentions(inline.content, out, workspaceMemberObjectMetadataId);
  collectMentions(inline.children, out, workspaceMemberObjectMetadataId);
};

// Returns the distinct workspace member ids mentioned in the body, in first-
// seen order. Tolerates an empty, missing or malformed body.
export const extractMentionedWorkspaceMemberIds = ({
  blocknote,
  workspaceMemberObjectMetadataId = null,
}: {
  blocknote: string | null | undefined;
  workspaceMemberObjectMetadataId?: string | null;
}): string[] => {
  if (!blocknote) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(blocknote);
  } catch {
    return [];
  }

  const out = new Set<string>();

  collectMentions(parsed, out, workspaceMemberObjectMetadataId);

  return [...out];
};

// Mentions present after an edit that were not present before. Editing a note
// must only notify newly added people; the dedupe key already protects the
// existing ones, but there is no point building intents that will be dropped.
export const newlyMentioned = (before: readonly string[], after: readonly string[]): string[] => {
  const seen = new Set(before);

  return after.filter((id) => !seen.has(id));
};
