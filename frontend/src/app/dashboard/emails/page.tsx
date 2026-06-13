'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, Button, Field, Textarea, Alert, Badge, Segmented, SectionHeading, Tabs, EmptyState, Skeleton, Select } from '@/components/ui';
import { IconMail, IconUsers, IconPlus, IconTrash } from '@/components/icons';

/* ================= Email Flows ================= */

interface FlowStep { id: string; dayOffset: number; subject: string; body: string; }
interface Flow { id: string; name: string; trigger: string; enabled: boolean; steps: FlowStep[]; }

const TRIGGERS: { value: string; label: string }[] = [
  { value: 'purchase', label: 'After a purchase' },
  { value: 'lead', label: 'After a signup' },
  { value: 'booking', label: 'After a booking' },
];

function FlowsTab() {
  const { authedRequest } = useAuth();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('purchase');
  const [steps, setSteps] = useState<{ dayOffset: number; subject: string; body: string }[]>([
    { dayOffset: 0, subject: '', body: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ flows: Flow[] }>('/api/flows');
    setFlows(res.flows);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  function reset() {
    setName(''); setTrigger('purchase'); setSteps([{ dayOffset: 0, subject: '', body: '' }]); setCreating(false); setError('');
  }

  async function create() {
    setBusy(true); setError('');
    try {
      await authedRequest('/api/flows', {
        method: 'POST',
        body: { name, trigger, enabled: true, steps: steps.filter((s) => s.subject && s.body) },
      });
      reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not create flow');
    } finally { setBusy(false); }
  }

  async function toggle(f: Flow) {
    await authedRequest(`/api/flows/${f.id}`, { method: 'PATCH', body: { enabled: !f.enabled } });
    await load();
  }
  async function remove(id: string) {
    await authedRequest(`/api/flows/${id}`, { method: 'DELETE' });
    await load();
  }

  if (creating) {
    return (
      <Card className="max-w-2xl">
        <SectionHeading title="New email flow" subtitle="Automatically email customers after a trigger event." />
        <div className="mt-5 space-y-5">
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="Flow name" placeholder="Post-purchase welcome" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>

          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-800">Emails</span>
            <div className="space-y-4">
              {steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface-subtle p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                      Send on day
                      <input
                        type="number" min={0} value={s.dayOffset}
                        onChange={(e) => setSteps((st) => st.map((x, j) => j === i ? { ...x, dayOffset: Number(e.target.value) } : x))}
                        className="h-8 w-16 rounded-lg border border-line-strong px-2 text-sm"
                      />
                    </div>
                    {steps.length > 1 && (
                      <button onClick={() => setSteps((st) => st.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600"><IconTrash size={15} /></button>
                    )}
                  </div>
                  <Field placeholder="Subject" value={s.subject} onChange={(e) => setSteps((st) => st.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} className="mb-2" />
                  <Textarea placeholder="Email body…" rows={3} value={s.body} onChange={(e) => setSteps((st) => st.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setSteps((st) => [...st, { dayOffset: st.length, subject: '', body: '' }])}>
                <IconPlus size={15} /> Add email
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={create} loading={busy} disabled={!name}>Create flow</Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Email Flows</div>
          <p className="text-sm text-neutral-500">Automatically send drip emails after a purchase, signup or booking.</p>
        </div>
        {flows && flows.length > 0 && <Button onClick={() => setCreating(true)}><IconPlus size={16} /> New flow</Button>}
      </div>

      {flows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<IconMail size={24} />}
          title="What are Email Flows?"
          description="Automatically send your customers drip emails after a purchase — upsells, thank-you notes, follow-up instructions, and much more!"
          action={<Button onClick={() => setCreating(true)}><IconPlus size={16} /> Create your first flow</Button>}
        />
      ) : (
        <div className="space-y-3">
          {flows.map((f) => (
            <Card key={f.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{f.name}</span>
                  <Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'Active' : 'Paused'}</Badge>
                  <span className="text-xs text-neutral-400">· {TRIGGERS.find((t) => t.value === f.trigger)?.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.steps.map((s) => (
                    <span key={s.id} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-neutral-600">Day {s.dayOffset}: {s.subject || 'Email'}</span>
                  ))}
                  {f.steps.length === 0 && <span className="text-xs text-neutral-400">No emails yet</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggle(f)}>{f.enabled ? 'Pause' : 'Enable'}</Button>
                <button onClick={() => remove(f.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-surface-muted hover:text-danger-600"><IconTrash size={16} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Broadcasts ================= */

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
    authedRequest<{ count: number }>(`/api/broadcasts/manage/preview?segment=${segment}`)
      .then((r) => setCount(r.count)).catch(() => setCount(null));
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
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <SectionHeading title="New broadcast" />
        <form onSubmit={send} className="mt-5 space-y-5">
          {error && <Alert kind="error">{error}</Alert>}
          {sent && <Alert kind="success">{sent}</Alert>}
          <div>
            <span className="mb-2 block text-sm font-medium text-neutral-800">Send to</span>
            <Segmented value={segment} onChange={setSegment} options={SEGMENTS} size="sm" />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
              <IconUsers size={14} /> {count === null ? 'Counting recipients…' : `${count} recipient(s)`}
            </p>
          </div>
          <Field label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea label="Message" rows={8} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your update…" />
          <Button type="submit" loading={busy} disabled={count === 0} fullWidth>
            {count === 0 ? 'No recipients in this segment' : `Send to ${count ?? 0} recipient(s)`}
          </Button>
        </form>
      </Card>

      <div>
        <SectionHeading title="History" subtitle="Your previous broadcasts." />
        {broadcasts.length === 0 ? (
          <Card className="mt-4 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><IconMail size={20} /></div>
            <p className="mt-3 text-sm text-neutral-500">No broadcasts sent yet.</p>
          </Card>
        ) : (
          <div className="mt-4 space-y-2.5">
            {broadcasts.map((b) => (
              <Card key={b.id} padded={false} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.subject}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{SEGMENTS.find((s) => s.value === b.segment)?.label ?? b.segment} · {b.recipientCount} sent</div>
                </div>
                <Badge tone={b.status === 'sent' ? 'success' : b.status === 'failed' ? 'danger' : 'warn'}>{b.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const [tab, setTab] = useState<'flows' | 'broadcasts'>('flows');
  return (
    <DashboardShell title="Email Flows" subtitle="Automations and one-off broadcasts to your audience." maxWidth="max-w-6xl">
      <Tabs
        className="mb-7"
        value={tab}
        onChange={setTab}
        tabs={[{ value: 'flows', label: 'Flows' }, { value: 'broadcasts', label: 'Broadcasts' }]}
      />
      {tab === 'flows' ? <FlowsTab /> : <BroadcastsTab />}
    </DashboardShell>
  );
}
