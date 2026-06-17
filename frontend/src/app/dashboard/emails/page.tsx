'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Alert, Badge, Skeleton } from '@/components/ui';
import { IconMail, IconUsers, IconPlus, IconTrash, IconPencil } from '@/components/icons';
import { cn } from '@/lib/cn';

interface FlowStep { id?: string; dayOffset: number; subject: string; body: string; }
interface Flow { id: string; name: string; trigger: string; enabled: boolean; steps: { id: string; dayOffset: number; subject: string; body: string }[]; }

const TRIGGERS: { value: string; label: string }[] = [
  { value: 'purchase', label: 'After a purchase' },
  { value: 'lead', label: 'After a signup' },
  { value: 'booking', label: 'After a booking' },
];

const CARD = 'rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]';
const INPUT = 'w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-semibold text-[#1a1c3a]">{children}</label>;
}
function PrimaryBtn({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none">
      {loading ? 'Saving…' : children}
    </button>
  );
}
function OutlineBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-[#1a1c3a] transition hover:bg-surface-muted">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Intro hero — "What are Email Flows?"                                */
/* ------------------------------------------------------------------ */

function FlowDiagram() {
  return (
    <div className="relative mx-auto hidden h-[440px] w-full max-w-[600px] lg:block">
      <svg viewBox="0 0 600 440" fill="none" className="absolute inset-0 h-full w-full">
        <path
          d="M70 410 C 60 330 140 350 150 290 C 162 220 235 250 285 215 C 345 173 405 205 450 140 C 478 100 470 90 495 60"
          stroke="#c8caf6" strokeWidth="3" strokeDasharray="7 9" strokeLinecap="round"
        />
        <path d="M495 60 l-11 14 M495 60 l12 12" stroke="#9aa0ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute left-[40px] top-[230px] flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-300"><IconUsers size={24} /></span>
        <div className="w-[150px]"><div className="text-[13px] text-neutral-400">Day 0</div><div className="font-bold leading-snug text-[#1a1c3a]">A customer purchases your product!</div></div>
      </div>
      <div className="absolute left-[250px] top-[120px] flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-400"><IconMail size={24} /></span>
        <div className="w-[120px]"><div className="text-[13px] text-neutral-400">Day 1</div><div className="font-bold leading-snug text-[#1a1c3a]">Automatic email #1</div></div>
      </div>
      <div className="absolute left-[420px] top-[30px] flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-400"><IconMail size={24} /></span>
        <div className="w-[110px]"><div className="text-[13px] text-neutral-400">Day 2</div><div className="font-bold leading-snug text-[#1a1c3a]">Automatic email #2</div></div>
      </div>
    </div>
  );
}

function EmailFlowsHero({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={cn(CARD, 'p-10')}>
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight text-[#1a1c3a]">What are Email Flows?</h1>
          <p className="mt-6 text-[17px] font-bold text-neutral-500">Automatically send your customers drip emails after a purchase!</p>
          <p className="mt-6 text-[15px] text-neutral-500">You can use Email Flows for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-neutral-500">
            <li>Upsells</li>
            <li>Thank You notes</li>
            <li>Follow-up instructions</li>
            <li>… and much more!</li>
          </ul>
          <button onClick={onCreate} className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700">
            <IconPlus size={18} /> Create Email Flow
          </button>
        </div>
        <FlowDiagram />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

function FlowBuilder({ initial, onCancel, onSaved }: { initial?: Flow; onCancel: () => void; onSaved: () => void }) {
  const { authedRequest } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState(initial?.trigger ?? 'purchase');
  const [steps, setSteps] = useState<FlowStep[]>(
    initial?.steps.length ? initial.steps.map((s) => ({ dayOffset: s.dayOffset, subject: s.subject, body: s.body })) : [{ dayOffset: 0, subject: '', body: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true); setError('');
    const payload = { name, trigger, enabled: initial?.enabled ?? true, steps: steps.filter((s) => s.subject && s.body) };
    try {
      if (initial) await authedRequest(`/api/flows/${initial.id}`, { method: 'PATCH', body: payload });
      else await authedRequest('/api/flows', { method: 'POST', body: payload });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save flow');
    } finally { setBusy(false); }
  }

  return (
    <div className={cn(CARD, 'max-w-2xl')}>
      <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">{initial ? 'Edit email flow' : 'New email flow'}</h2>
      <p className="mt-0.5 text-sm text-neutral-500">Automatically email customers after a trigger event.</p>

      <div className="mt-6 space-y-5">
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <FieldLabel>Flow name</FieldLabel>
          <input className={INPUT} placeholder="Post-purchase welcome" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Trigger</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTrigger(t.value)}
                className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', trigger === t.value ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Emails</FieldLabel>
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface-subtle p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#1a1c3a]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                    Send on day
                    <input type="number" min={0} value={s.dayOffset} onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, dayOffset: Number(e.target.value) } : x)))} className="h-9 w-16 rounded-lg border border-line-strong px-2 text-sm outline-none focus:border-brand-500" />
                  </div>
                  {steps.length > 1 && (
                    <button onClick={() => setSteps((st) => st.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white hover:text-danger-600"><IconTrash size={15} /></button>
                  )}
                </div>
                <input className={cn(INPUT, 'mb-2')} placeholder="Subject" value={s.subject} onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))} />
                <textarea className={cn(INPUT, 'resize-y leading-relaxed')} rows={3} placeholder="Email body…" value={s.body} onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              </div>
            ))}
            <button onClick={() => setSteps((st) => [...st, { dayOffset: st.length, subject: '', body: '' }])} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700">
              <IconPlus size={15} /> Add email
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <PrimaryBtn onClick={save} loading={busy} disabled={!name}>{initial ? 'Save changes' : 'Create flow'}</PrimaryBtn>
          <button onClick={onCancel} className="rounded-full px-4 py-3 text-sm font-semibold text-neutral-500 transition hover:text-ink">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flows tab                                                           */
/* ------------------------------------------------------------------ */

function FlowsTab() {
  const { authedRequest } = useAuth();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);

  const load = useCallback(async () => {
    const res = await authedRequest<{ flows: Flow[] }>('/api/flows');
    setFlows(res.flows);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(f: Flow) {
    await authedRequest(`/api/flows/${f.id}`, { method: 'PATCH', body: { enabled: !f.enabled } });
    await load();
  }
  async function remove(id: string) {
    await authedRequest(`/api/flows/${id}`, { method: 'DELETE' });
    await load();
  }

  if (flows === null) return <div className={CARD}><Skeleton className="h-64 w-full" /></div>;
  if (creating || editing) {
    return <FlowBuilder initial={editing ?? undefined} onCancel={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void load(); }} />;
  }
  if (flows.length === 0) return <EmailFlowsHero onCreate={() => setCreating(true)} />;

  return (
    <div className={CARD}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Email Flows</h2>
          <p className="text-sm text-neutral-500">Automatically send drip emails after a purchase, signup or booking.</p>
        </div>
        <PrimaryBtn onClick={() => setCreating(true)}><IconPlus size={16} /> New flow</PrimaryBtn>
      </div>

      <div className="space-y-3">
        {flows.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1a1c3a]">{f.name}</span>
                <Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'Active' : 'Paused'}</Badge>
                <span className="text-xs text-neutral-400">· {TRIGGERS.find((t) => t.value === f.trigger)?.label}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {f.steps.map((s) => (
                  <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">Day {s.dayOffset}: {s.subject || 'Email'}</span>
                ))}
                {f.steps.length === 0 && <span className="text-xs text-neutral-400">No emails yet</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OutlineBtn onClick={() => setEditing(f)}><IconPencil size={14} /> Edit</OutlineBtn>
              <OutlineBtn onClick={() => toggle(f)}>{f.enabled ? 'Pause' : 'Enable'}</OutlineBtn>
              <button onClick={() => remove(f.id)} className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition hover:bg-surface-muted hover:text-danger-600"><IconTrash size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Broadcasts tab                                                      */
/* ------------------------------------------------------------------ */

type Segment = 'all_leads' | 'customers' | 'subscribers';
interface Broadcast { id: string; subject: string; segment: string; status: string; recipientCount: number; sentAt: string | null; createdAt: string; }
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'all_leads', label: 'All contacts' },
  { value: 'subscribers', label: 'Subscribers' },
  { value: 'customers', label: 'Customers' },
];

function BroadcastsTab() {
  const { authedRequest } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<Segment>('all_leads');
  const [count, setCount] = useState<number | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await authedRequest<{ broadcasts: Broadcast[] }>('/api/broadcasts/manage');
    setBroadcasts(res.broadcasts);
  }, [authedRequest]);
  useEffect(() => { void loadList(); }, [loadList]);

  useEffect(() => {
    authedRequest<{ count: number }>(`/api/broadcasts/manage/preview?segment=${segment}`).then((r) => setCount(r.count)).catch(() => setCount(null));
  }, [authedRequest, segment]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSent(''); setBusy(true);
    try {
      await authedRequest('/api/broadcasts/manage/send', { method: 'POST', body: { subject, bodyText: body, segment } });
      setSent(`Broadcast queued to ${count ?? 0} recipient(s).`);
      setSubject(''); setBody('');
      await loadList();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not send');
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className={CARD}>
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">New broadcast</h2>
        <form onSubmit={send} className="mt-5 space-y-5">
          {error && <Alert kind="error">{error}</Alert>}
          {sent && <Alert kind="success">{sent}</Alert>}
          <div>
            <FieldLabel>Send to</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <button key={s.value} type="button" onClick={() => setSegment(s.value)} className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', segment === s.value ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-500">
              <IconUsers size={14} /> {count === null ? 'Counting recipients…' : `${count} recipient(s)`}
            </p>
          </div>
          <div><FieldLabel>Subject</FieldLabel><input className={INPUT} required value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><FieldLabel>Message</FieldLabel><textarea className={cn(INPUT, 'resize-y leading-relaxed')} rows={8} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your update…" /></div>
          <button type="submit" disabled={busy || count === 0} className="w-full rounded-full bg-brand-600 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none">
            {busy ? 'Sending…' : count === 0 ? 'No recipients in this segment' : `Send to ${count ?? 0} recipient(s)`}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">History</h2>
        {broadcasts.length === 0 ? (
          <div className={cn(CARD, 'text-center')}>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><IconMail size={20} /></div>
            <p className="mt-3 text-sm text-neutral-500">No broadcasts sent yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {broadcasts.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#1a1c3a]">{b.subject}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{SEGMENTS.find((s) => s.value === b.segment)?.label ?? b.segment} · {b.recipientCount} sent</div>
                </div>
                <Badge tone={b.status === 'sent' ? 'success' : b.status === 'failed' ? 'danger' : 'warn'}>{b.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function EmailsView() {
  const [tab, setTab] = useState<'flows' | 'broadcasts'>('flows');
  return (
    <>
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings?tab=payments" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      <div className="mt-6 flex gap-3">
        {(['flows', 'broadcasts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl px-4 py-2.5 text-[15px] font-semibold transition',
              tab === t ? 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200' : 'border border-line bg-white text-brand-600 hover:bg-brand-50/50',
            )}
          >
            {t === 'flows' ? 'Flows' : 'Broadcasts'}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'flows' ? <FlowsTab /> : <BroadcastsTab />}</div>
    </>
  );
}

export default function EmailsPage() {
  return (
    <DashboardShell title="My Email Flows" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <EmailsView />
    </DashboardShell>
  );
}
