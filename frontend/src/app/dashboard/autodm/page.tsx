'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { FeatureGate } from '@/components/FeatureGate';
import { Badge, Skeleton, Alert } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconPlus, IconTrash, IconPencil, IconCheckCircle, IconBolt } from '@/components/icons';
import { cn } from '@/lib/cn';

interface Rule {
  id: string;
  platform: string;
  keyword: string;
  reply: string;
  linkUrl: string;
  enabled: boolean;
  triggeredCount: number;
  mediaId: string;
  mediaPermalink: string;
  mediaThumbnail: string;
  mediaCaption: string;
  dmOnComment: boolean;
  publicReply: string;
}

interface IgMedia {
  id: string;
  caption: string;
  mediaType: string;
  thumbnail: string;
  permalink: string;
}

interface RuleInput {
  platform: string;
  keyword: string;
  reply: string;
  linkUrl?: string;
  mediaId?: string;
  mediaPermalink?: string;
  mediaThumbnail?: string;
  mediaCaption?: string;
  dmOnComment?: boolean;
  publicReply?: string;
}

const CARD = 'rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]';
const INPUT = 'w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-semibold text-[#1a1c3a]">{children}</label>;
}

function IgLogo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id="adm-ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" /><stop offset="0.4" stopColor="#FA7E1E" /><stop offset="0.75" stopColor="#D62976" /><stop offset="1" stopColor="#962FBF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#adm-ig)" />
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.2" cy="7.8" r="1.1" fill="#fff" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit modal                                                 */
/* ------------------------------------------------------------------ */

const PLATFORMS = [{ value: 'instagram', label: 'Instagram' }, { value: 'tiktok', label: 'TikTok' }];

function RuleModal({ open, initial, media, mediaLoading, onClose, onSave }: {
  open: boolean;
  initial: Rule | null;
  media: IgMedia[];
  mediaLoading: boolean;
  onClose: () => void;
  onSave: (data: RuleInput) => Promise<void>;
}) {
  const [platform, setPlatform] = useState('instagram');
  const [keyword, setKeyword] = useState('');
  const [reply, setReply] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scope, setScope] = useState<'all' | 'post'>('all');
  const [selectedMedia, setSelectedMedia] = useState<IgMedia | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [dmOnComment, setDmOnComment] = useState(true);
  const [publicReply, setPublicReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPlatform(initial?.platform ?? 'instagram');
    setKeyword(initial?.keyword ?? '');
    setReply(initial?.reply ?? '');
    setLinkUrl(initial?.linkUrl ?? '');
    setScope(initial?.mediaId ? 'post' : 'all');
    setSelectedMedia(
      initial?.mediaId
        ? { id: initial.mediaId, caption: initial.mediaCaption, mediaType: '', thumbnail: initial.mediaThumbnail, permalink: initial.mediaPermalink }
        : null,
    );
    setUrlInput('');
    setUrlError('');
    setDmOnComment(initial ? initial.dmOnComment : true);
    setPublicReply(initial?.publicReply ?? '');
    setError('');
  }, [open, initial]);

  // Resolve a pasted post URL against the fetched media list (by permalink).
  function resolveUrl() {
    setUrlError('');
    const raw = urlInput.trim();
    if (!raw) return;
    const norm = (s: string) => s.replace(/\/+$/, '').split('?')[0].toLowerCase();
    const match = media.find((m) => m.permalink && norm(m.permalink) === norm(raw));
    if (match) {
      setSelectedMedia(match);
      setUrlInput('');
    } else {
      setUrlError("Couldn't match that URL to one of your recent posts. Pick it from the grid instead.");
    }
  }

  async function submit() {
    setError(''); setBusy(true);
    try {
      const usePost = scope === 'post' && selectedMedia;
      await onSave({
        platform,
        keyword,
        reply,
        linkUrl: linkUrl || undefined,
        mediaId: usePost ? selectedMedia!.id : '',
        mediaPermalink: usePost ? selectedMedia!.permalink : '',
        mediaThumbnail: usePost ? selectedMedia!.thumbnail : '',
        mediaCaption: usePost ? selectedMedia!.caption : '',
        dmOnComment,
        publicReply: dmOnComment ? publicReply : '',
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not save rule');
    } finally { setBusy(false); }
  }

  const isInstagram = platform === 'instagram';

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">{initial ? 'Edit auto-reply rule' : 'New auto-reply rule'}</h2>
        <p className="mt-1.5 text-sm text-neutral-500">Reply instantly when followers use your keyword.</p>
      </div>
      <div className="mt-6 space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <FieldLabel>Platform</FieldLabel>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.value} onClick={() => setPlatform(p.value)} className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', platform === p.value ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}>{p.label}</button>
            ))}
          </div>
        </div>
        <div><FieldLabel>Keyword</FieldLabel><input className={INPUT} placeholder="e.g. LINK" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
        <div><FieldLabel>Auto-reply message</FieldLabel><textarea className={cn(INPUT, 'resize-y leading-relaxed')} rows={3} placeholder="Here's the link you asked for! 👇" value={reply} onChange={(e) => setReply(e.target.value)} /></div>
        <div><FieldLabel>Link <span className="font-normal text-neutral-400">(optional)</span></FieldLabel><input className={INPUT} placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></div>

        {isInstagram && (
          <>
            {/* Post scope */}
            <div>
              <FieldLabel>Apply comment replies to</FieldLabel>
              <div className="flex gap-2">
                <button onClick={() => setScope('all')} className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', scope === 'all' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}>All posts</button>
                <button onClick={() => setScope('post')} className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', scope === 'post' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}>A specific post</button>
              </div>
            </div>

            {scope === 'post' && (
              <div className="rounded-2xl border border-line bg-surface-subtle p-4">
                {mediaLoading ? (
                  <Skeleton className="h-28 w-full" />
                ) : media.length === 0 ? (
                  <p className="py-4 text-center text-sm text-neutral-500">No posts found. Connect Instagram (and make sure the app can read your media) to pick a post.</p>
                ) : (
                  <>
                    <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                      {media.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMedia(m)}
                          className={cn('relative aspect-square overflow-hidden rounded-lg border-2 transition', selectedMedia?.id === m.id ? 'border-brand-600 ring-2 ring-brand-200' : 'border-transparent hover:border-line-strong')}
                          title={m.caption || m.permalink}
                        >
                          {m.thumbnail
                            ? // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.thumbnail} alt={m.caption || 'post'} className="h-full w-full object-cover" />
                            : <span className="grid h-full w-full place-items-center bg-brand-50 text-[10px] text-brand-600">No preview</span>}
                          {selectedMedia?.id === m.id && (
                            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white"><IconCheckCircle size={12} /></span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <input className={cn(INPUT, 'flex-1')} placeholder="…or paste a post URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveUrl(); } }} />
                        <button onClick={resolveUrl} className="rounded-xl bg-brand-50 px-4 text-sm font-semibold text-brand-600 transition hover:bg-brand-100">Use URL</button>
                      </div>
                      {urlError && <p className="mt-1.5 text-xs font-medium text-amber-700">{urlError}</p>}
                      {selectedMedia && <p className="mt-2 truncate text-xs text-neutral-500">Selected: {selectedMedia.caption || selectedMedia.permalink || selectedMedia.id}</p>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Comment → DM */}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4">
              <input type="checkbox" checked={dmOnComment} onChange={(e) => setDmOnComment(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>
                <span className="block text-sm font-semibold text-[#1a1c3a]">Also send a DM when someone comments</span>
                <span className="mt-0.5 block text-xs text-neutral-500">The commenter gets your auto-reply message as a private DM. (Comments without this just get a public reply.)</span>
              </span>
            </label>
            {dmOnComment && (
              <div><FieldLabel>Public comment reply <span className="font-normal text-neutral-400">(optional)</span></FieldLabel><input className={INPUT} placeholder="Just sent you a DM! 📩" value={publicReply} onChange={(e) => setPublicReply(e.target.value)} /></div>
            )}
          </>
        )}

        <button onClick={submit} disabled={busy || !keyword || !reply || (scope === 'post' && !selectedMedia)} className="h-[52px] w-full rounded-full bg-brand-600 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none">
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AutoDMView({ initialRules, initialConnected }: { initialRules?: Rule[]; initialConnected?: boolean } = {}) {
  const { authedRequest } = useAuth();
  const searchParams = useSearchParams();
  const [rules, setRules] = useState<Rule[] | null>(initialRules ?? null);
  const [connected, setConnected] = useState(initialConnected ?? false);
  const [liveMode, setLiveMode] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [oauthNotice, setOauthNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await authedRequest<{ rules: Rule[] }>('/api/autodm');
    setRules(res.rules);
  }, [authedRequest]);
  const loadConnection = useCallback(async () => {
    try {
      const res = await authedRequest<{
        integrations: { provider: string; connected: boolean; liveMode?: boolean; accountName?: string }[];
      }>('/api/integrations');
      const ig = res.integrations.find((i) => i.provider === 'instagram');
      setConnected(ig?.connected ?? false);
      setLiveMode(Boolean(ig?.liveMode));
      setAccountName(ig?.accountName ?? '');
    } catch { /* ignore */ }
  }, [authedRequest]);
  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await authedRequest<{ media: IgMedia[] }>('/api/autodm/instagram/media');
      setMedia(res.media);
    } catch { setMedia([]); }
    finally { setMediaLoading(false); }
  }, [authedRequest]);
  useEffect(() => {
    if (initialRules !== undefined) return;
    void load();
    void loadConnection();
  }, [load, loadConnection, initialRules]);

  useEffect(() => {
    const status = searchParams.get('instagram');
    if (!status) return;
    if (status === 'connected') {
      setOauthNotice({ tone: 'success', text: 'Instagram connected — your auto-replies will deliver live when someone DMs or comments your keyword.' });
      void loadConnection();
    } else if (status === 'error') {
      setOauthNotice({ tone: 'error', text: 'Instagram connection failed. Check your Meta app redirect URI and try again.' });
    }
    window.history.replaceState({}, '', '/dashboard/autodm');
  }, [searchParams, loadConnection]);

  async function connectInstagram() {
    const res = await authedRequest<{ authorizeUrl: string }>('/api/integrations/instagram/connect', { method: 'POST' });
    window.location.href = res.authorizeUrl;
  }
  async function disconnectInstagram() {
    await authedRequest('/api/integrations/instagram/disconnect', { method: 'POST' });
    setConnected(false);
  }

  async function saveRule(data: RuleInput) {
    if (editing) await authedRequest(`/api/autodm/${editing.id}`, { method: 'PATCH', body: data });
    else await authedRequest('/api/autodm', { method: 'POST', body: data });
    await load();
  }
  async function toggle(r: Rule) {
    await authedRequest(`/api/autodm/${r.id}`, { method: 'PATCH', body: { enabled: !r.enabled } });
    await load();
  }
  async function remove(id: string) {
    await authedRequest(`/api/autodm/${id}`, { method: 'DELETE' });
    await load();
  }
  async function test(r: Rule) {
    setTestingId(r.id);
    setTestResult(null);
    try {
      const res = await authedRequest<{ result: { matched: boolean; reply?: string; delivery: string } }>(
        '/api/autodm/simulate',
        { method: 'POST', body: { platform: r.platform, text: r.keyword } },
      );
      const { matched, reply, delivery } = res.result;
      setTestResult({
        id: r.id,
        ok: matched,
        text: matched
          ? `Matched “${r.keyword}” → would reply: “${reply}” (${delivery})`
          : 'No enabled rule matched — is this rule paused?',
      });
      await load();
    } catch (e) {
      setTestResult({ id: r.id, ok: false, text: e instanceof ApiException ? e.message : 'Test failed' });
    } finally {
      setTestingId(null);
    }
  }

  function openNew() { setEditing(null); setModalOpen(true); if (connected) void loadMedia(); }
  function openEdit(r: Rule) { setEditing(r); setModalOpen(true); if (connected) void loadMedia(); }

  return (
    <>
      {/* Direct-deposit reminder */}
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings?tab=payments" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      {/* Hero */}
      <div className={cn(CARD, 'mt-5 p-9')}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-[36px] font-bold leading-[1.1] tracking-tight text-[#1a1c3a]">Set your engagement on autopilot 🚀</h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-500">
              Pick a keyword, craft your message, and everyone who comments your magic word gets a personalized reply — instantly, around the clock.
            </p>
            <button onClick={openNew} className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700">
              <IconPlus size={18} /> New Auto-Reply
            </button>
          </div>

          {/* Chat illustration */}
          <div className="relative rounded-2xl bg-surface-subtle p-6">
            <div className="flex items-center gap-2.5">
              <IgLogo size={32} />
              <span className="text-sm font-bold text-[#1a1c3a]">your.handle</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white"><IconBolt size={12} /> Auto-reply</span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-[#1a1c3a] shadow-sm">Drop the <b>LINK</b> 🔥</div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">Here&apos;s the link you asked for! 👇 stan.store/you</div>
            </div>
          </div>
        </div>
      </div>

      {/* Instagram connection */}
      {oauthNotice && (
        <Alert kind={oauthNotice.tone === 'success' ? 'success' : 'error'} className="mt-5">
          {oauthNotice.text}
        </Alert>
      )}
      <div className={cn(CARD, 'mt-5 flex flex-wrap items-center justify-between gap-4')}>
        <div className="flex items-center gap-3">
          <IgLogo size={40} />
          <div>
            <div className="font-bold text-[#1a1c3a]">
              Instagram{accountName ? ` · @${accountName}` : ''}
            </div>
            <div className="text-sm text-neutral-500">
              {connected && liveMode
                ? 'Live — auto-replies deliver via Instagram when followers use your keywords.'
                : connected
                  ? 'Demo connected — add Meta app keys to your server env for live delivery.'
                  : 'Connect your account to activate auto-replies.'}
            </div>
          </div>
        </div>
        {connected ? (
          <div className="flex items-center gap-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold',
              liveMode ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-800',
            )}>
              <IconCheckCircle size={16} /> {liveMode ? 'Live' : 'Demo'}
            </span>
            <button onClick={disconnectInstagram} className="text-sm font-semibold text-neutral-500 transition hover:text-danger-600">Disconnect</button>
          </div>
        ) : (
          <button onClick={connectInstagram} className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">Connect Instagram</button>
        )}
      </div>

      {/* Rules */}
      <div className={cn(CARD, 'mt-5')}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Auto-reply rules</h2>
            <p className="text-sm text-neutral-500">Reply automatically when followers comment or DM your keyword.</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700">
            <IconPlus size={16} /> New rule
          </button>
        </div>

        {rules === null ? (
          <Skeleton className="h-40 w-full" />
        ) : rules.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50"><IgLogo size={30} /></div>
            <h3 className="text-lg font-bold text-[#1a1c3a]">No auto-reply rules yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">Create a keyword rule and we&apos;ll reply automatically when followers use it.</p>
            <button onClick={openNew} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700"><IconPlus size={16} /> New rule</button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-600">{r.keyword}</span>
                    <Badge tone={r.enabled ? 'success' : 'neutral'}>{r.enabled ? 'Active' : 'Paused'}</Badge>
                    {r.dmOnComment && <Badge tone="brand">Comment → DM</Badge>}
                    <span className="text-xs capitalize text-neutral-400">· {r.platform} · {r.triggeredCount} sent</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {r.mediaThumbnail
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.mediaThumbnail} alt="post" className="h-7 w-7 shrink-0 rounded object-cover" />
                      : null}
                    <span className="text-xs font-medium text-neutral-500">
                      {r.mediaId
                        ? <>Scoped to <a href={r.mediaPermalink || undefined} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">a specific post</a></>
                        : 'All posts & DMs'}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm text-neutral-600">{r.reply}</p>
                  {r.linkUrl && <a href={r.linkUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-xs font-medium text-brand-600">{r.linkUrl}</a>}
                  {testResult?.id === r.id && (
                    <p className={cn('mt-2 rounded-lg px-3 py-2 text-xs font-medium', testResult.ok ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700')}>
                      {testResult.text}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => test(r)} disabled={testingId === r.id} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-[#1a1c3a] transition hover:bg-surface-muted disabled:opacity-50"><IconBolt size={14} /> {testingId === r.id ? 'Testing…' : 'Test'}</button>
                  <button onClick={() => openEdit(r)} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-[#1a1c3a] transition hover:bg-surface-muted"><IconPencil size={14} /> Edit</button>
                  <button onClick={() => toggle(r)} className="rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-[#1a1c3a] transition hover:bg-surface-muted">{r.enabled ? 'Pause' : 'Enable'}</button>
                  <button onClick={() => remove(r.id)} className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition hover:bg-surface-muted hover:text-danger-600"><IconTrash size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RuleModal open={modalOpen} initial={editing} media={media} mediaLoading={mediaLoading} onClose={() => setModalOpen(false)} onSave={saveRule} />
    </>
  );
}

export default function AutoDMPage() {
  return (
    <DashboardShell title="AutoDM" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <FeatureGate feature="autodm" name="AutoDM" tier="Premium">
        <AutoDMView />
      </FeatureGate>
    </DashboardShell>
  );
}
