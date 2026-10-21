import { graphql } from 'src/api/client';

// Getting a file out of this browser and into the CRM.
//
// Twenty stores a file against a FILES field, and the upload is a three-step
// handshake the platform runs itself: ask for a signed target, PUT the bytes
// straight at it, then tell the server they arrived. Only after the third
// step does the file have a URL this server will read back — which is exactly
// what `/capture/import/inspect` demands, and why a CSV cannot simply be
// posted to the route.
//
// The PUT goes through XMLHttpRequest rather than fetch for one reason: it
// reports how many bytes have actually left the machine. That is the only
// real progress anywhere in an import, so it is the only place a percentage
// is shown.

export type LvUploadedFile = {
  fileId: string;
  url: string;
  /**
   * The storage-relative path the platform recorded. Routes that register a
   * file against a record want this rather than the signed URL, which expires.
   */
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

type ObjectsResponse = {
  objects?: { edges?: { node?: { nameSingular?: string; fields?: { edges?: { node?: { id?: string; name?: string } }[] } } }[] };
};

// The metadata ids are workspace-specific, so they cannot be baked in. One
// lookup per session is enough; the shape of a workspace does not change
// while someone is importing.
const fieldIds = new Map<string, string>();

export const resolveFilesFieldId = async (objectNameSingular: string, fieldName: string): Promise<string> => {
  const cacheKey = `${objectNameSingular}.${fieldName}`;
  const known = fieldIds.get(cacheKey);

  if (known) {
    return known;
  }

  const data = await graphql<ObjectsResponse>(
    'query { objects(paging: { first: 200 }) { edges { node { nameSingular fields(paging: { first: 200 }) { edges { node { id name } } } } } } }',
    {},
    'metadata',
  );

  const object = (data.objects?.edges ?? []).map((edge) => edge.node).find((node) => node?.nameSingular === objectNameSingular);
  const fieldId = (object?.fields?.edges ?? []).map((edge) => edge.node).find((node) => node?.name === fieldName)?.id;

  if (!fieldId) {
    throw new Error(`This workspace has no ${objectNameSingular}.${fieldName} field to upload into.`);
  }

  fieldIds.set(cacheKey, fieldId);

  return fieldId;
};

const putBytes = (url: string, contentType: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`The file could not be stored (${request.status}).`));
      }
    };

    request.onerror = () => reject(new Error('The file could not be stored. Check your connection and try again.'));
    request.onabort = () => reject(new Error('The upload was cancelled.'));

    if (signal) {
      signal.addEventListener('abort', () => request.abort(), { once: true });
    }

    request.send(file);
  });

/**
 * Uploads one file into a FILES field and returns the handle the LV routes
 * need. `onProgress` is called with the real fraction of bytes sent, never a
 * simulated one; it stays at 0 until the browser starts reporting.
 */
export const uploadToFilesField = async (
  file: File,
  options: { objectNameSingular: string; fieldName: string; onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<LvUploadedFile> => {
  const fieldMetadataId = await resolveFilesFieldId(options.objectNameSingular, options.fieldName);
  const created = await graphql<{ createFileUpload?: { fileId: string; uploadUrl: string; contentType: string } }>(
    `mutation($filename: String!, $size: Float!, $fileFolder: FileFolder!, $fieldMetadataId: String) {
      createFileUpload(filename: $filename, size: $size, fileFolder: $fileFolder, fieldMetadataId: $fieldMetadataId) { fileId uploadUrl contentType }
    }`,
    { filename: file.name, size: file.size, fileFolder: 'FilesField', fieldMetadataId },
    'metadata',
  );

  const target = created.createFileUpload;

  if (!target) {
    throw new Error('The server did not accept the upload.');
  }

  await putBytes(target.uploadUrl, target.contentType, file, options.onProgress ?? (() => undefined), options.signal);

  // Until this lands the file exists but is not readable: the routes would
  // be handed a URL that resolves to nothing.
  const completed = await graphql<{ completeFileUpload?: { id: string; url: string; path: string; size: number } }>(
    'mutation($fileId: String!) { completeFileUpload(fileId: $fileId) { id url path size } }',
    { fileId: target.fileId },
    'metadata',
  );

  const uploaded = completed.completeFileUpload;

  if (!uploaded?.url) {
    throw new Error('The upload did not finish. Try again.');
  }

  return { fileId: uploaded.id, url: uploaded.url, path: uploaded.path, name: file.name, mimeType: target.contentType, size: file.size };
};
