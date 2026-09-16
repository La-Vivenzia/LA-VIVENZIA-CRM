export type SerializedFileData = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  // CM-006: host-side handle for the real File (see serializedFileRegistry).
  handle?: string;
};
