// CM-006 (La Vivenzia): files picked in a front component's <input type="file">
// never leave the host document — the sandboxed worker only receives their
// metadata (serializeFileList). That leaves application code no way to hand
// the bytes to `uploadFile`. The host therefore keeps the real File objects
// for a short while, keyed by a random handle that travels with the
// serialized metadata; the host-side uploadFile resolves the handle back to
// the File. Handles are unguessable, bounded in number, and expire, so the
// registry cannot be used to read arbitrary host files.

const MAX_ENTRIES = 32;
const TTL_MS = 30 * 60 * 1000;

const registry = new Map<string, { file: File; at: number }>();

const evict = () => {
  const now = Date.now();

  for (const [handle, entry] of registry) {
    if (now - entry.at > TTL_MS) {
      registry.delete(handle);
    }
  }

  while (registry.size > MAX_ENTRIES) {
    const oldest = registry.keys().next().value;

    if (oldest === undefined) {
      break;
    }

    registry.delete(oldest);
  }
};

export const registerSerializedFile = (file: File): string => {
  const handle = crypto.randomUUID();

  registry.set(handle, { file, at: Date.now() });
  evict();

  return handle;
};

export const resolveSerializedFile = (candidate: unknown): File | undefined => {
  if (candidate instanceof Blob) {
    return candidate as File;
  }

  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { handle?: unknown }).handle === 'string'
  ) {
    return registry.get((candidate as { handle: string }).handle)?.file;
  }

  return undefined;
};
