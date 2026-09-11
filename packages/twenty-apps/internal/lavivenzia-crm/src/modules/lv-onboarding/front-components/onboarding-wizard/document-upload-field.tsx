import { useCallback, useMemo, useRef, useState } from 'react';
import { uploadFile } from 'twenty-sdk/front-component';

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  formatBytes,
  MAX_DOCUMENT_BYTES,
} from 'src/modules/lv-onboarding/constants/document-policy';
import { validateUpload } from 'src/modules/lv-onboarding/utils/validate-upload';
import { type LvTheme, layout } from 'src/modules/lv-core/ui/theme';

// A real file picker for the Documents and Images steps.
//
// What this replaces was a text box asking the partner to type "uploaded file
// paths, comma separated" — which uploaded nothing and produced a record no
// reviewer could open.
//
// The flow is: pick → validate here → upload the bytes through Twenty's own
// FILES upload → register the result server-side. The validation below is for
// fast feedback only. The registration route runs the identical check, and
// that is the one that decides, because a client-side check is a courtesy
// rather than a control.

export type UploadedDocument = {
  fileId: string;
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; name: string }
  | { status: 'error'; message: string; retryable: boolean };

const ACCEPT = [...ALLOWED_DOCUMENT_EXTENSIONS, ...ALLOWED_DOCUMENT_MIME_TYPES].join(
  ',',
);

export const DocumentUploadField = ({
  theme,
  fieldMetadataId,
  value,
  disabled = false,
  maxFiles,
  onChange,
}: {
  theme: LvTheme;
  // Resolved at runtime: the FILES field's metadata id is workspace-specific,
  // so it cannot be baked into the application manifest.
  fieldMetadataId: string | null;
  value: UploadedDocument[];
  disabled?: boolean;
  maxFiles?: number;
  onChange: (next: UploadedDocument[]) => void;
}) => {
  const s = useMemo(() => layout(theme), [theme]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const atCapacity =
    typeof maxFiles === 'number' && value.length >= maxFiles;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (files === null || files.length === 0) {
        return;
      }

      if (fieldMetadataId === null) {
        setState({
          status: 'error',
          message: 'Uploads are not ready yet. Please try again in a moment.',
          retryable: true,
        });

        return;
      }

      const file = files[0];

      // The browser reports the type it inferred from the extension. The
      // server re-derives it from the bytes, so a rename is caught there even
      // though it may pass here.
      const check = validateUpload({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!check.ok) {
        setState({ status: 'error', message: check.message, retryable: true });

        return;
      }

      setState({ status: 'uploading', name: file.name });

      try {
        const result = await uploadFile(file, {
          fieldMetadataId,
          fileName: file.name,
        });

        if (result.status !== 'uploaded') {
          setState({
            status: 'error',
            message:
              result.reason === 'invalid-params'
                ? 'That file could not be accepted.'
                : 'The upload did not complete.',
            retryable: true,
          });

          return;
        }

        onChange([
          ...value,
          {
            fileId: result.file.fileId,
            path: result.file.path,
            name: file.name,
            mimeType: file.type,
            size: file.size,
          },
        ]);

        setState({ status: 'idle' });
      } catch (caught) {
        setState({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'The upload failed. Please try again.',
          retryable: true,
        });
      } finally {
        // Clearing the input lets the same file be chosen again after a
        // failure, which otherwise silently does nothing.
        if (inputRef.current !== null) {
          inputRef.current.value = '';
        }
      }
    },
    [fieldMetadataId, onChange, value],
  );

  const remove = (fileId: string) =>
    onChange(value.filter((item) => item.fileId !== fileId));

  return (
    <div style={s.stack(2)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        disabled={disabled || state.status === 'uploading' || atCapacity}
        onChange={(event) => void handleFiles(event.target.files)}
        style={{
          ...s.input,
          padding: theme.space(2),
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />

      <span
        style={{ color: theme.color.textMuted, fontSize: theme.font.size.xs }}
      >
        {ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} · up to{' '}
        {formatBytes(MAX_DOCUMENT_BYTES)}
        {typeof maxFiles === 'number' ? ' · ' + value.length + '/' + maxFiles : ''}
      </span>

      {state.status === 'uploading' && (
        <div
          role="status"
          aria-live="polite"
          style={{ color: theme.color.info, fontSize: theme.font.size.sm }}
        >
          Uploading {state.name}…
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}
        >
          {state.message}
          {state.retryable && (
            <button
              type="button"
              style={{
                ...s.button('secondary'),
                marginLeft: theme.space(2),
                minHeight: 32,
                padding: '4px 10px',
              }}
              onClick={() => {
                setState({ status: 'idle' });
                inputRef.current?.click();
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {value.map((item) => (
        <div
          key={item.fileId}
          style={{
            ...s.row,
            justifyContent: 'space-between',
            background: theme.color.surfaceRaised,
            border: '1px solid ' + theme.color.border,
            borderRadius: theme.radius.md,
            padding: theme.space(2),
          }}
        >
          <span style={{ fontSize: theme.font.size.sm, wordBreak: 'break-all' }}>
            {item.name}{' '}
            <span style={{ color: theme.color.textMuted }}>
              ({formatBytes(item.size)})
            </span>
          </span>
          <button
            type="button"
            disabled={disabled}
            style={{
              ...s.button('secondary'),
              minHeight: 32,
              padding: '4px 10px',
            }}
            onClick={() => remove(item.fileId)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

// The FILES field's metadata id is per-workspace, so it is looked up once at
// runtime rather than hard-coded. Returns null while unresolved, which the
// picker surfaces as "not ready" instead of failing an upload.
export const resolveFilesFieldMetadataId = async (
  objectNameSingular: string,
  fieldName: string,
): Promise<string | null> => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    return null;
  }

  try {
    const response = await fetch(apiBaseUrl + '/metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        query:
          'query { objects(paging: { first: 200 }) { edges { node { nameSingular fields(paging: { first: 200 }) { edges { node { id name type } } } } } } }',
      }),
    });

    const payload = (await response.json()) as {
      data?: {
        objects?: {
          edges?: {
            node?: {
              nameSingular?: string;
              fields?: { edges?: { node?: { id?: string; name?: string } }[] };
            };
          }[];
        };
      };
    };

    const object = (payload.data?.objects?.edges ?? [])
      .map((edge) => edge?.node)
      .find((node) => node?.nameSingular === objectNameSingular);

    const field = (object?.fields?.edges ?? [])
      .map((edge) => edge?.node)
      .find((node) => node?.name === fieldName);

    return field?.id ?? null;
  } catch {
    return null;
  }
};
