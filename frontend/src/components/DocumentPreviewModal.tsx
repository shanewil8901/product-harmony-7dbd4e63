import { useEffect, useRef, useState } from 'react';
import { Modal } from './Dialog';
import { toast } from '../lib/toast';

/**
 * Embedded document viewer — renders the printable HTML inside the app so no
 * browser pop-up or native print dialog is ever needed. Accepts either inline
 * HTML or a URL; the action button saves the document straight to the device.
 */
export function DocumentPreviewModal({
  title,
  subtitle,
  html,
  url,
  fileName,
  onClose,
}: {
  title: string;
  subtitle?: string;
  html?: string;
  url?: string;
  /** Base name (without extension) used for the saved file. */
  fileName?: string;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(!html);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (html) setLoading(false);
  }, [html]);

  const slug = (fileName ?? title).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';

  const download = async () => {
    setSaving(true);
    try {
      let markup = html;
      if (!markup) {
        // Prefer the already-rendered frame content; fall back to re-fetching.
        markup = frame.current?.contentDocument?.documentElement?.outerHTML;
        if (!markup && url) {
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error('Could not download this document');
          markup = await res.text();
        }
      }
      if (!markup) throw new Error('Nothing to download yet');
      const blob = new Blob([markup], { type: 'text/html;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${slug}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
      toast('success', `${slug}.html downloaded`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Download failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-gold" onClick={download} disabled={loading || saving}>
            {saving ? 'Preparing…' : 'Download'}
          </button>
        </>
      }
    >
      <div className="h-[70vh] w-full overflow-hidden rounded-md border border-brown-100 bg-white">
        {loading && <div className="p-6 text-sm text-brown-500">Loading document…</div>}
        <iframe
          ref={frame}
          title={title}
          className={`h-full w-full ${loading ? 'hidden' : ''}`}
          {...(html ? { srcDoc: html } : { src: url })}
          onLoad={() => setLoading(false)}
        />
      </div>
    </Modal>
  );
}
