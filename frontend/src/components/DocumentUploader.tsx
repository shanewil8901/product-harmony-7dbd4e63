import { useRef, useState, type ChangeEvent } from 'react';

export interface DocRow {
  id: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  size: number;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface Props<T extends string> {
  docs: DocRow[];
  docTypes: readonly T[];
  docLabels: Record<T, string>;
  canEdit: boolean;
  onUpload: (
    file: File,
    meta: { doc_type: T; reference_no?: string; issue_date?: string; expiry_date?: string },
  ) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  onDownload: (doc: DocRow) => void;
}

export function DocumentUploader<T extends string>({
  docs,
  docTypes,
  docLabels,
  canEdit,
  onUpload,
  onDelete,
  onDownload,
}: Props<T>) {
  const [docType, setDocType] = useState<T>(docTypes[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await onUpload(file, {
        doc_type: docType,
        reference_no: referenceNo || undefined,
        issue_date: issueDate || undefined,
        expiry_date: expiryDate || undefined,
      });
      setReferenceNo('');
      setIssueDate('');
      setExpiryDate('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.error ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Upload failed');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-xl border border-brown-100 bg-paper-soft p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Document type</label>
              <select
                className="input"
                value={docType}
                onChange={(e) => setDocType(e.target.value as T)}
              >
                {docTypes.map((t) => (
                  <option key={t} value={t}>
                    {docLabels[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Reference / Certificate No.</label>
              <input
                className="input"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Issue date</label>
              <input
                className="input"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Expiry date</label>
              <input
                className="input"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Upload file (PDF, JPG, PNG, WEBP — max 10 MB)</label>
            <input
              ref={inputRef}
              className="input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={handleFile}
              disabled={uploading}
            />
          </div>
          {error && <div className="text-xs text-brown-600">{error}</div>}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const label = (docLabels as Record<string, string>)[d.doc_type] ?? d.doc_type;
              return (
                <tr key={d.id} className="border-t border-brown-100">
                  <td className="px-3 py-2 text-ink">{label}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    <div className="max-w-[220px] truncate" title={d.file_name}>
                      {d.file_name}
                    </div>
                    <div className="text-xs text-brown-500">
                      {(d.size / 1024).toFixed(1)} KB · {d.mime_type}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{d.reference_no ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{d.issue_date ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{d.expiry_date ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {new Date(d.uploaded_at).toLocaleDateString()}
                    {d.uploaded_by && (
                      <div className="text-xs text-brown-500">{d.uploaded_by}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="btn-ghost !py-1 !px-2 text-xs"
                      onClick={() => onDownload(d)}
                    >
                      Download
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-danger !py-1 !px-2 text-xs ml-2"
                        onClick={() => {
                          if (window.confirm(`Delete "${d.file_name}"?`)) {
                            void onDelete(d.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-brown-500">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
