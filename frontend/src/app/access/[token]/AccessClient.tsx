'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, ApiException } from '@/lib/api';
import { Card } from '@/components/ui';
import { IconDownload, IconCheckCircle, IconLock, IconMail, IconExternal, IconEye, IconX, IconPlay, IconImage } from '@/components/icons';

interface ProductMeta {
  title: string;
  shortDescription: string;
  thankYouMessage: string;
  coverImageUrl: string;
  deliveryMode: 'file' | 'url';
  redirectUrl?: string;
  allowDownload?: boolean;
  productKind?: string;
  fulfilmentNote?: string;
  fulfillmentPending?: boolean;
  fulfillmentMessage?: string;
}
interface FileItem {
  id: string;
  filename: string;
  bytes: number;
  format: string;
  resourceType?: 'image' | 'video' | 'raw';
  previewable?: boolean;
}

type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'other';
const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];

function previewKindOf(f: FileItem): PreviewKind {
  const fmt = (f.format || '').toLowerCase();
  const name = (f.filename || '').toLowerCase();
  if (f.resourceType === 'image') return 'image';
  if (AUDIO_FORMATS.includes(fmt) || AUDIO_FORMATS.some((x) => name.endsWith('.' + x))) return 'audio';
  if (f.resourceType === 'video') return 'video';
  if (fmt === 'pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}
interface MetaResponse {
  product: ProductMeta;
  emailHint: string;
  fileCount: number;
  fulfillmentPending?: boolean;
}
interface VerifyResponse {
  session: string;
  product: ProductMeta;
  files: FileItem[];
}

type Step = 'loading' | 'notfound' | 'email' | 'code' | 'unlocked';

const sessionKey = (token: string) => `cs_access_session:${token}`;

function prettyBytes(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(n < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
}

export function AccessClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [product, setProduct] = useState<ProductMeta | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [session, setSession] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: FileItem; url: string } | null>(null);

  const enc = encodeURIComponent(token);
  const bootstrapped = useRef(false);

  // Initial load: fetch the public meta, then try an existing session.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      let m: MetaResponse;
      try {
        m = await apiRequest<MetaResponse>(`/api/fulfilment/${enc}`, { credentials: false });
      } catch (err) {
        if (err instanceof ApiException && (err.status === 404 || err.status === 400)) {
          setStep('notfound');
          return;
        }
        setStep('email');
        setError('Could not load this page. Please try again.');
        return;
      }
      setMeta(m);
      setProduct(m.product);

      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(sessionKey(token)) : null;
      if (stored) {
        try {
          const data = await apiRequest<{ product: ProductMeta; files: FileItem[] }>(`/api/fulfilment/${enc}/files`, {
            token: stored,
            credentials: false,
          });
          setSession(stored);
          setProduct(data.product);
          setFiles(data.files);
          setStep('unlocked');
          return;
        } catch {
          window.localStorage.removeItem(sessionKey(token));
        }
      }
      setStep('email');
    })();
  }, [enc, token]);

  const requestCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email.trim() || busy) return;
      setBusy(true);
      setError('');
      setDevCode('');
      try {
        const res = await apiRequest<{ sent: boolean; devCode?: string }>(`/api/fulfilment/${enc}/request-code`, {
          method: 'POST',
          body: { email: email.trim() },
          credentials: false,
        });
        if (res.devCode) setDevCode(res.devCode);
        setStep('code');
      } catch (err) {
        setError(err instanceof ApiException ? err.message : 'Could not send the code. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [email, busy, enc],
  );

  const verify = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!code.trim() || busy) return;
      setBusy(true);
      setError('');
      try {
        const res = await apiRequest<VerifyResponse>(`/api/fulfilment/${enc}/verify`, {
          method: 'POST',
          body: { email: email.trim(), code: code.trim() },
          credentials: false,
        });
        setSession(res.session);
        setProduct(res.product);
        setFiles(res.files);
        if (typeof window !== 'undefined') window.localStorage.setItem(sessionKey(token), res.session);
        setStep('unlocked');
      } catch (err) {
        setError(err instanceof ApiException ? err.message : 'Could not verify the code. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [code, email, busy, enc, token],
  );

  function handleSessionError(err: unknown): boolean {
    if (err instanceof ApiException && err.status === 401) {
      window.localStorage.removeItem(sessionKey(token));
      setSession(null);
      setStep('email');
      setError('Your session expired. Verify your email again.');
      return true;
    }
    return false;
  }

  async function openPreview(file: FileItem) {
    if (!session || previewBusyId) return;
    setPreviewBusyId(file.id);
    setError('');
    try {
      const { url } = await apiRequest<{ url: string }>(`/api/fulfilment/${enc}/preview/${file.id}`, {
        method: 'POST',
        token: session,
        credentials: false,
      });
      setPreview({ file, url });
    } catch (err) {
      if (handleSessionError(err)) return;
      if (err instanceof ApiException && err.code === 'cloudinary_unconfigured') {
        setError('Previews aren’t configured on this store yet. Contact the creator.');
      } else {
        setError(err instanceof ApiException ? err.message : 'Could not open the preview. Try again.');
      }
    } finally {
      setPreviewBusyId(null);
    }
  }

  async function download(file: FileItem) {
    if (!session || downloadingId) return;
    setDownloadingId(file.id);
    setError('');
    try {
      const { url } = await apiRequest<{ url: string }>(`/api/fulfilment/${enc}/download/${file.id}`, {
        method: 'POST',
        token: session,
        credentials: false,
      });
      window.location.href = url;
    } catch (err) {
      if (handleSessionError(err)) return;
      if (err instanceof ApiException && err.code === 'cloudinary_unconfigured') {
        setError('Downloads aren’t configured on this store yet. Contact the creator.');
      } else {
        setError(err instanceof ApiException ? err.message : 'Download failed. Try again.');
      }
    } finally {
      setDownloadingId(null);
    }
  }

  /* ---------------------------------------------------------------- */

  const cover = product?.coverImageUrl;

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-md px-5 py-12">
        <Card>
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
              <p className="mt-3 text-sm">Loading…</p>
            </div>
          )}

          {step === 'notfound' && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-400">
                <IconLock size={26} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Link not found</h1>
              <p className="mt-2 text-sm text-neutral-500">
                This access link is invalid or has been revoked. Check the link in your purchase email, or contact the
                creator.
              </p>
            </div>
          )}

          {(step === 'email' || step === 'code') && (
            <>
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={product?.title} className="mb-5 h-40 w-full rounded-xl object-cover" />
              )}
              <div className="flex items-center gap-2 text-sm font-medium text-success-700">
                <IconCheckCircle size={18} /> Purchase complete
              </div>
              {product?.title && <h1 className="mt-2 text-2xl font-bold tracking-tight">{product.title}</h1>}

              <div className="mt-6 rounded-2xl border border-line bg-surface-subtle/60 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                  <IconLock size={16} className="text-brand-600" /> Verify it’s you
                </div>

                {step === 'email' ? (
                  <form onSubmit={requestCode}>
                    <p className="mb-3 text-sm text-neutral-600">
                      For your security, enter the email you purchased with
                      {meta?.emailHint ? <> (<span className="font-medium">{meta.emailHint}</span>)</> : ''}. We&apos;ll send a
                      one-time code to unlock your purchase
                      {meta?.fulfillmentPending || meta?.product?.fulfillmentPending
                        ? ' and check delivery status'
                        : meta?.fileCount === 1
                          ? ' and your file'
                          : ' and your files'}.
                    </p>
                    <div className="relative">
                      <IconMail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="email"
                        autoFocus
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                      />
                    </div>
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    <button
                      type="submit"
                      disabled={busy || !email.trim()}
                      className="mt-3 w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Sending…' : 'Send code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={verify}>
                    <p className="mb-3 text-sm text-neutral-600">
                      We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it below to unlock your
                      purchase.
                    </p>
                    {devCode && (
                      <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        Dev mode — your code is <span className="font-bold tracking-widest">{devCode}</span>
                      </p>
                    )}
                    <input
                      inputMode="numeric"
                      autoFocus
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-center text-lg font-semibold tracking-[0.5em] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    <button
                      type="submit"
                      disabled={busy || code.length < 4}
                      className="mt-3 w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Verifying…' : 'Unlock my purchase'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('email'); setCode(''); setError(''); }}
                      className="mt-2 w-full text-center text-xs font-medium text-neutral-500 hover:text-ink"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {step === 'unlocked' && product && (
            <>
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={product.title} className="mb-5 h-44 w-full rounded-xl object-cover" />
              )}
              {product.fulfillmentPending ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                    <IconLock size={18} /> Being prepared
                  </div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight">{product.title}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    Your order is in progress. The creator is preparing your custom delivery — we&apos;ll email you when it&apos;s ready.
                  </p>
                  {product.fulfilmentNote && (
                    <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <span className="font-semibold">What to expect: </span>
                      {product.fulfilmentNote}
                    </p>
                  )}
                  <p className="mt-6 text-xs text-neutral-400">
                    Bookmark this page and check back anytime. You&apos;re verified on this device.
                  </p>
                </>
              ) : (
                <>
              <div className="flex items-center gap-2 text-sm font-medium text-success-700">
                <IconCheckCircle size={18} /> Unlocked
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{product.title}</h1>
              {product.fulfillmentMessage && (
                <p className="mt-2 rounded-xl border border-line bg-surface-subtle/60 px-4 py-3 text-sm leading-relaxed text-neutral-700">
                  {product.fulfillmentMessage}
                </p>
              )}
              {product.thankYouMessage && (
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{product.thankYouMessage}</p>
              )}

              {/* URL-delivery products: a button to the destination */}
              {product.redirectUrl && (
                <a
                  href={product.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
                >
                  <IconExternal size={16} /> Open your content
                </a>
              )}

              {(product.deliveryMode !== 'url' || files.length > 0) && (
                <div className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your files</h2>
                  {files.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-500">No files are attached to this order.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {files.map((f) => {
                        // ZIPs and other non-viewable files have no in-browser preview,
                        // so they're always downloadable even in preview-only mode.
                        const canPreview = f.previewable !== false;
                        const canDownload = Boolean(product.allowDownload) || !canPreview;
                        return (
                          <li
                            key={f.id}
                            className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-xs"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                              {canPreview ? <IconEye size={18} /> : <IconDownload size={18} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{f.filename}</span>
                              <span className="text-xs text-neutral-400">
                                {[f.format?.toUpperCase(), prettyBytes(f.bytes)].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            {canPreview && (
                              <button
                                onClick={() => openPreview(f)}
                                disabled={previewBusyId === f.id}
                                className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-60"
                              >
                                {previewBusyId === f.id ? 'Opening…' : 'Preview'}
                              </button>
                            )}
                            {canDownload && (
                              <button
                                onClick={() => download(f)}
                                disabled={downloadingId === f.id}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                              >
                                <IconDownload size={13} /> {downloadingId === f.id ? 'Preparing…' : 'Download'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <p className="mt-6 text-xs text-neutral-400">
                Bookmark this page — it stays unlocked on this device, and your access links are personal to your email.
              </p>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {preview && (
        <FilePreview file={preview.file} url={preview.url} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* In-page preview (no download / save / print)                        */
/* ------------------------------------------------------------------ */

function FilePreview({ file, url, onClose }: { file: FileItem; url: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const kind = previewKindOf(file);
  const name = file.filename || 'file';
  const noContext = (e: React.MouseEvent) => e.preventDefault();

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-black/95 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>{name}</span>
        <button onClick={onClose} className="rounded-full p-2 text-white/80 transition hover:bg-white/10" title="Close (Esc)">
          <IconX size={20} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} onContextMenu={noContext} className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl" />
        )}
        {kind === 'video' && (
          <video src={url} controls controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={noContext} className="max-h-[82vh] max-w-full rounded-lg shadow-2xl" />
        )}
        {kind === 'audio' && (
          <div className="w-[min(90vw,520px)] rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-brand-50 text-brand-600"><IconPlay size={36} /></div>
            <div className="mb-4 truncate text-sm font-semibold text-[#1a1c3a]">{name}</div>
            <audio src={url} controls controlsList="nodownload" onContextMenu={noContext} className="w-full" />
          </div>
        )}
        {kind === 'pdf' && (
          // #toolbar=0&navpanes=0 hides the browser PDF viewer's save/print/download controls.
          <iframe src={`${url}#toolbar=0&navpanes=0`} title={name} className="h-[82vh] w-[min(92vw,900px)] rounded-lg bg-white shadow-2xl" />
        )}
        {kind === 'other' && (
          <div className="w-[min(90vw,420px)] rounded-2xl bg-white p-10 text-center shadow-2xl">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-surface-subtle text-neutral-400"><IconImage size={40} /></div>
            <div className="truncate text-base font-bold text-[#1a1c3a]">{name}</div>
            <div className="mt-1 text-sm text-neutral-500">{file.format?.toUpperCase() || 'FILE'} · {prettyBytes(file.bytes)}</div>
            <p className="mt-3 text-xs text-neutral-400">This file type can’t be previewed in the browser.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
