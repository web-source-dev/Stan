'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Field, Textarea, Badge, EmptyState, Skeleton, Alert } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconSend, IconPlus, IconTrash } from '@/components/icons';

interface Rule {
  id: string;
  platform: string;
  keyword: string;
  reply: string;
  linkUrl: string;
  enabled: boolean;
  triggeredCount: number;
}

function AutoDMView() {
  const { authedRequest } = useAuth();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [reply, setReply] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ rules: Rule[] }>('/api/autodm');
    setRules(res.rules);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true); setError('');
    try {
      await authedRequest('/api/autodm', {
        method: 'POST',
        body: JSON.stringify({ keyword, reply, linkUrl: linkUrl || undefined }),
      });
      setKeyword(''); setReply(''); setLinkUrl(''); setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not create rule');
    } finally { setBusy(false); }
  }

  async function toggle(r: Rule) {
    await authedRequest(`/api/autodm/${r.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !r.enabled }) });
    await load();
  }
  async function remove(id: string) {
    await authedRequest(`/api/autodm/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <DashboardShell
      title="AutoDM"
      subtitle="Reply to comments and DMs automatically with a keyword."
      maxWidth="max-w-5xl"
      actions={connected && <Button onClick={() => setOpen(true)}><IconPlus size={16} /> New rule</Button>}
    >
      {!connected ? (
        <Card className="overflow-hidden">
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Create an IG Auto-Reply</h2>
              <p className="mt-2 max-w-md text-sm text-neutral-500">
                Set your engagement on autopilot! Pick a keyword, craft your message, and watch as everyone
                who comments your magic word gets a personalized response instantly.
              </p>
              <Button className="mt-5" onClick={() => setConnected(true)}>
                <IconSend size={16} /> Connect Instagram
              </Button>
              <p className="mt-2 text-xs text-neutral-400">Demo mode — connecting enables rule management.</p>
            </div>
            <div className="hidden h-32 w-32 place-items-center rounded-3xl bg-brand-gradient text-white shadow-glow sm:grid">
              <IconSend size={48} />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-5">
            <Badge tone="success" dot>Instagram connected</Badge>
          </div>
          {rules === null ? (
            <Skeleton className="h-40 w-full" />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={<IconSend size={24} />}
              title="No auto-reply rules yet"
              description="Create a keyword rule and we’ll reply automatically when followers use it."
              action={<Button onClick={() => setOpen(true)}><IconPlus size={16} /> New rule</Button>}
            />
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <Card key={r.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">{r.keyword}</Badge>
                      <Badge tone={r.enabled ? 'success' : 'neutral'}>{r.enabled ? 'Active' : 'Paused'}</Badge>
                      <span className="text-xs text-neutral-400">· {r.triggeredCount} sent</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">{r.reply}</p>
                    {r.linkUrl && <a href={r.linkUrl} className="mt-1 inline-block text-xs text-brand-600">{r.linkUrl}</a>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggle(r)}>{r.enabled ? 'Pause' : 'Enable'}</Button>
                    <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-surface-muted hover:text-danger-600"><IconTrash size={16} /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New auto-reply rule" subtitle="Reply instantly when followers use your keyword">
        <div className="space-y-3">
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="Keyword" placeholder="e.g. LINK" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Textarea label="Auto-reply message" rows={3} placeholder="Here's the link you asked for! 👇" value={reply} onChange={(e) => setReply(e.target.value)} />
          <Field label="Link (optional)" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <Button fullWidth onClick={create} loading={busy} disabled={!keyword || !reply}>Create rule</Button>
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AutoDMPage() {
  return <AutoDMView />;
}
