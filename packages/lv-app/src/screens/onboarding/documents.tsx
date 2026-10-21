import { useState } from 'react';

import { uploadToFilesField } from 'src/api/files';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  formatBytes,
  MAX_DOCUMENT_BYTES,
  registerDocument,
  REQUIRED_DOCUMENT_TYPES,
  type DocumentType,
  type OnboardingDocument,
  type OnboardingRecord,
} from 'src/api/onboarding';
import { LvUploadItem, LvUploadZone } from 'src/design/documents';
import { LvIcon } from 'src/design/icons';
import { EmptyState, Field, InlineNotice, LvButton, LvInput, LvSelect, VisuallyHidden } from 'src/design/kit';
import { LvDocumentCard, LvDocumentPreview } from 'src/design/onboarding';
import { LvModal, LvModalFooter } from 'src/design/overlay';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// 7.4 the collection, 7.5 the upload, 7.7 the preview.

// ---------------------------------------------------------------------------
// 7.5 — Document upload
//
// The bytes go through Twenty's own FILES upload (which sniffs magic bytes
// rather than trusting the extension), then `/onboarding/documents/register`
// applies the La Vivenzia policy and records the document as PENDING. The
// checks below are for fast feedback only; the route runs the same ones and
// it is the route that decides.
// ---------------------------------------------------------------------------
export const DocumentUploadDialog = ({
  theme,
  record,
  replaces,
  onClose,
  onUploaded,
}: {
  theme: LvTheme;
  record: OnboardingRecord;
  /** Set when this upload replaces a document a reviewer sent back. */
  replaces?: OnboardingDocument | null;
  onClose: () => void;
  onUploaded: () => void;
}) => {
  const [documentType, setDocumentType] = useState<DocumentType>(replaces?.documentType ?? 'IDENTITY');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fraction, setFraction] = useState<number | null>(null);
  const [phase, setPhase] = useState<'CHOOSE' | 'UPLOADING' | 'REGISTERING' | 'DONE'>('CHOOSE');
  const [error, setError] = useState<string | null>(null);

  const take = (files: File[]) => {
    const picked = files[0];

    if (!picked) {
      return;
    }

    if (picked.size > MAX_DOCUMENT_BYTES) {
      setError(`That file is ${formatBytes(picked.size)}. A document may be up to ${formatBytes(MAX_DOCUMENT_BYTES)}.`);
      setFile(null);

      return;
    }

    if (picked.size === 0) {
      setError('That file is empty.');
      setFile(null);

      return;
    }

    // The browser reports a type from the extension; the server decides from
    // the bytes. A mismatch is caught there, so this only stops the obvious.
    if (picked.type !== '' && !ALLOWED_DOCUMENT_MIME_TYPES.includes(picked.type)) {
      setError(`${picked.type} is not accepted. Send a ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} file.`);
      setFile(null);

      return;
    }

    setError(null);
    setFile(picked);
  };

  const send = async () => {
    if (!file) {
      return;
    }

    setPhase('UPLOADING');
    setFraction(null);
    setError(null);

    try {
      const uploaded = await uploadToFilesField(file, {
        objectNameSingular: 'lvOnboardingDocument',
        fieldName: 'file',
        onProgress: setFraction,
      });

      setPhase('REGISTERING');

      await registerDocument({
        onboardingId: record.id,
        documentType,
        fileId: uploaded.fileId,
        filePath: uploaded.path,
        originalFilename: file.name,
        mimeType: uploaded.mimeType,
        fileSizeBytes: file.size,
        expiresAt: expiresAt === '' ? null : new Date(expiresAt).toISOString(),
        replacesDocumentId: replaces?.id ?? null,
      });

      setPhase('DONE');
      onUploaded();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That document could not be registered.');
      setPhase('CHOOSE');
    }
  };

  const busy = phase === 'UPLOADING' || phase === 'REGISTERING';

  return (
    <LvModal
      theme={theme}
      title={replaces ? `Replace the ${DOCUMENT_TYPE_LABELS[replaces.documentType ?? ''] ?? 'document'}` : 'Add a document'}
      onClose={busy ? () => undefined : onClose}
      footer={
        <LvModalFooter
          theme={theme}
          onCancel={onClose}
          onConfirm={() => void send()}
          confirmLabel={phase === 'REGISTERING' ? 'Recording it' : 'Add the document'}
          disabled={file === null}
          busy={busy}
        />
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {replaces && (
          <InlineNotice theme={theme}>
            This replaces the file {replaces.originalFilename ?? 'already on record'}
            {replaces.rejectionReason ? `, which was sent back: “${replaces.rejectionReason}”` : ''}. The old one stays on the record as history.
          </InlineNotice>
        )}

        <Field theme={theme} label="What is it" htmlFor="doc-type" required help="Only an identity proof is required; the rest are accepted if the partner has them.">
          <LvSelect theme={theme} id="doc-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
                {REQUIRED_DOCUMENT_TYPES.includes(type.key) ? ' — required' : ''}
              </option>
            ))}
          </LvSelect>
        </Field>

        <Field theme={theme} label="Expires on" htmlFor="doc-expiry" help="Optional. A document past this date stops counting towards approval.">
          <LvInput theme={theme} id="doc-expiry" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </Field>

        {/* A camera is genuinely useful here: a partner's passport is usually
            photographed rather than scanned. */}
        <LvUploadZone
          theme={theme}
          label="Drop the file here, or choose one"
          accept={DOCUMENT_ACCEPT}
          onFiles={take}
          disabled={busy}
          hint={`${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} up to ${formatBytes(MAX_DOCUMENT_BYTES)}.`}
        />

        {file && phase === 'CHOOSE' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
            <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
              <LvIcon name="document" size={18} />
            </span>
            <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {file.name} · {formatBytes(file.size)}
            </span>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setFile(null)}>
              Remove
            </LvButton>
          </div>
        )}

        {/* Real bytes sent while uploading; a named stage while the server
            records it, because that step reports no progress at all. */}
        {phase === 'UPLOADING' && file && <LvUploadItem theme={theme} name={file.name} percentage={fraction === null ? null : Math.round(fraction * 100)} />}
        {phase === 'REGISTERING' && (
          <InlineNotice theme={theme}>
            <span aria-busy="true">Checking the file against the document policy and recording it as pending.</span>
          </InlineNotice>
        )}

        {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}
      </div>
    </LvModal>
  );
};

// ---------------------------------------------------------------------------
// 7.7 — Document preview, full screen
// ---------------------------------------------------------------------------
export const DocumentPreviewDialog = ({ theme, document: file, onClose }: { theme: LvTheme; document: OnboardingDocument; onClose: () => void }) => (
  <LvModal
    theme={theme}
    size="full"
    title={file.originalFilename ?? DOCUMENT_TYPE_LABELS[file.documentType ?? ''] ?? 'Document'}
    onClose={onClose}
    footer={<LvModalFooter theme={theme} onCancel={onClose} onConfirm={onClose} confirmLabel="Close" />}
  >
    <LvDocumentPreview theme={theme} document={file} height={undefined} />
  </LvModal>
);

// ---------------------------------------------------------------------------
// 7.4 — The collection
// ---------------------------------------------------------------------------
export const DocumentCollection = ({
  theme,
  record,
  now,
  onReload,
  onReview,
}: {
  theme: LvTheme;
  record: OnboardingRecord;
  now: string;
  onReload: () => void;
  onReview: (documentId: string) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState<OnboardingDocument | null>(null);
  const [previewing, setPreviewing] = useState<OnboardingDocument | null>(null);

  // Required types that nothing has been uploaded for. Only the identity
  // proof is required by ONBOARDING_STEP_SPECS, so only that can be missing.
  const missingTypes = REQUIRED_DOCUMENT_TYPES.filter((type) => !record.documents.some((doc) => doc.documentType === type));

  return (
    <>
      <LvSectionCard
        theme={theme}
        title={`Documents (${record.documents.length})`}
        icon="document"
        action={
          <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setUploading(true)} icon={<LvIcon name="upload" size={15} />}>
            Add a document
          </LvButton>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          {/* Missing first, because a document that was never sent is the one
              thing a list of uploaded files cannot show you. */}
          {missingTypes.map((type) => (
            <div
              key={type}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.space(3),
                padding: theme.space(4),
                borderRadius: theme.radius.lg,
                border: `1px dashed ${theme.color.warning}`,
                background: theme.color.surfaceSunken,
              }}
            >
              <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex' }}>
                <LvIcon name="warning" size={19} />
              </span>
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <span style={{ display: 'block', ...theme.type.subheading, fontSize: 15, color: theme.color.heading }}>{DOCUMENT_TYPE_LABELS[type]}</span>
                <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>Required, and nothing has been uploaded for it.</span>
              </span>
              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setUploading(true)}>
                Upload it
              </LvButton>
            </div>
          ))}

          {record.documents.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="document"
              tint="blue"
              title="No documents yet"
              text="Nothing has been uploaded against this onboarding. A partner cannot be approved until at least one document is uploaded and verified."
              action={
                <LvButton theme={theme} variant="primary" size="sm" onClick={() => setUploading(true)}>
                  Add the first one
                </LvButton>
              }
            />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0 }}>
              {record.documents.map((doc) => (
                <LvDocumentCard
                  key={doc.id}
                  theme={theme}
                  document={doc}
                  now={now}
                  required={doc.documentType !== null && REQUIRED_DOCUMENT_TYPES.includes(doc.documentType)}
                  actions={
                    <>
                      <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onReview(doc.id)}>
                        Review
                      </LvButton>
                      {doc.fileUrl !== null ? (
                        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setPreviewing(doc)}>
                          Open the file
                        </LvButton>
                      ) : (
                        <span style={{ ...theme.type.caption, color: theme.color.textMuted, alignSelf: 'center' }}>No file to open</span>
                      )}
                      {(doc.verificationState === 'REJECTED' || doc.verificationState === 'NEEDS_REPLACEMENT' || doc.verificationState === 'EXPIRED') && (
                        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setReplacing(doc)}>
                          Replace it
                        </LvButton>
                      )}
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </LvSectionCard>

      {(uploading || replacing !== null) && (
        <DocumentUploadDialog
          theme={theme}
          record={record}
          replaces={replacing}
          onClose={() => {
            setUploading(false);
            setReplacing(null);
          }}
          onUploaded={onReload}
        />
      )}

      {previewing !== null && <DocumentPreviewDialog theme={theme} document={previewing} onClose={() => setPreviewing(null)} />}

      <VisuallyHidden>
        {record.documents.length} document{record.documents.length === 1 ? '' : 's'} on this onboarding.
      </VisuallyHidden>
    </>
  );
};
