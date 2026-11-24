'use client';

import { Button, type ButtonProps } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api, ApiError } from './client-api';

/**
 * A button that calls the API, then refreshes the page. Asks first when `confirm` is set (for rare or risky actions).
 * Shows the server's message in plain words when it fails.
 */
export function ActionButton({ path, method = 'POST', body, confirm, onDone, children, testId, ...rest }: Omit<ButtonProps, 'onClick'> & { path: string; method?: string; body?: unknown; confirm?: string; onDone?: (out: any) => void; children: ReactNode; testId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        {...rest}
        data-testid={testId}
        disabled={busy || rest.disabled}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setErr(null);
          try {
            const out = await api(path, { method, body: body ?? (method === 'GET' ? undefined : {}) });
            onDone?.(out);
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Working…' : children}
      </Button>
      {err ? <span role="alert" className="mt-1 max-w-xs text-sm text-danger-ink">{err}</span> : null}
    </span>
  );
}

/** Shows a link to share: copy it, open it, or text it from your own phone. */
export function ShareLink({ url, smsHref, note }: { url: string; smsHref?: string | null; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-control border border-info-line bg-info-tint p-3 text-sm" data-testid="share-link">
      {note ? <p className="mb-1">{note}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-link underline" data-testid="share-url">{url}</a>
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</Button>
        {smsHref ? <a className="text-sm font-semibold text-link underline" href={smsHref}>Text it from my phone</a> : null}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return children ? <p role="alert" data-testid="error" className="mt-2 rounded-control border border-danger-tint bg-danger-tint px-3 py-2 text-sm text-danger-ink">{children}</p> : null;
}
