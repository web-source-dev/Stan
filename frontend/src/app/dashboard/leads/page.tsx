'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Badge, EmptyState, Skeleton, FilterChips, Field, Select, Alert } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconUsers, IconDownload, IconPlus, IconUpload } from '@/components/icons';

interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  source: string;
  isCustomer: boolean;
  unsubscribed: boolean;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const COUNTRY_CODES = ['+1', '+44', '+91', '+92', '+61', '+49', '+33', '+971'];

/* ------------------------------------------------------------------ */
/* Add-contact modal (manual + CSV import)                             */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): { email: string; firstName?: string; lastName?: string; phone?: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const ei = idx(['email', 'email address', 'e-mail']);
  const fi = idx(['first name', 'firstname', 'first']);
  const li = idx(['last name', 'lastname', 'last']);
  const pi = idx(['phone', 'phone number', 'mobile']);
  // No header row with an email column → treat every line's first cell as email.
  const start = ei === -1 ? 0 : 1;
  const emailCol = ei === -1 ? 0 : ei;
  const out: { email: string; firstName?: string; lastName?: string; phone?: string }[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cells[emailCol];
    if (!email) continue;
    out.push({
      email,
      firstName: fi >= 0 ? cells[fi] : undefined,
      lastName: li >= 0 ? cells[li] : undefined,
      phone: pi >= 0 ? cells[pi] : undefined,
    });
  }
  return out;
}

function AddContactModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { authedRequest } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('+1');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName(''); setEmail(''); setPhone(''); setCode('+1'); setError(''); setNotice('');
  }

  async function addManual() {
    setBusy(true); setError(''); setNotice('');
    try {
      const [firstName, ...rest] = name.trim().split(' ');
      await authedRequest('/api/leads/manage', {
        method: 'POST',
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: rest.join(' ') || undefined,
          phone: phone ? `${code} ${phone}`.trim() : undefined,
        }),
      });
      reset();
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not add contact');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const rows = parseCsv(await file.text()).slice(0, 5000);
      if (!rows.length) { setError('No rows with an email column were found.'); return; }
      const res = await authedRequest<{ created: number; updated: number; skipped: number }>(
        '/api/leads/manage/import',
        { method: 'POST', body: JSON.stringify({ rows }) },
      );
      setNotice(`Imported ${res.created} new, updated ${res.updated}${res.skipped ? `, skipped ${res.skipped}` : ''}.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Import failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a contact…" subtitle="Manually enter customer details">
      <div className="space-y-3">
        <Field placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <Select value={code} onChange={(e) => setCode(e.target.value)} className="w-28">
            {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Field className="flex-1" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <Button fullWidth onClick={addManual} loading={busy} disabled={!email}>Add Contact</Button>
      </div>

      <div className="mt-6 border-t border-line pt-5 text-center">
        <h3 className="font-semibold">…or import a list</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-xs text-neutral-500">
          Upload a CSV with columns: Email Address, First Name, Last Name, and Phone Number.
          Maximum of 5,000 contacts per account.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <Button variant="secondary" fullWidth className="mt-3" onClick={() => fileRef.current?.click()} loading={busy}>
          <IconUpload size={16} /> Upload CSV
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Customers CRM                                                       */
/* ------------------------------------------------------------------ */

type ChipKey = 'name' | 'email' | 'phone' | 'source' | 'status';
const CHIPS: { value: ChipKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Source' },
  { value: 'status', label: 'Status' },
];

function statusOf(l: Lead): 'Customer' | 'Unsubscribed' | 'Subscriber' {
  if (l.isCustomer) return 'Customer';
  if (l.unsubscribed) return 'Unsubscribed';
  return 'Subscriber';
}

function CustomersView() {
  const { authedRequest } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [stats, setStats] = useState<{ total: number; customers: number; subscribers: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<ChipKey[]>([]);
  const [q, setQ] = useState({ name: '', email: '', phone: '', source: '', status: '' });

  const load = useCallback(async () => {
    const res = await authedRequest<{ leads: Lead[] }>('/api/leads/manage');
    setLeads(res.leads);
    authedRequest<{ total: number; customers: number; subscribers: number }>('/api/leads/manage/stats')
      .then(setStats).catch(() => {});
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  const sources = useMemo(() => Array.from(new Set((leads ?? []).map((l) => l.source))), [leads]);

  const filtered = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      const fullName = `${l.firstName} ${l.lastName}`.toLowerCase();
      if (active.includes('name') && q.name && !fullName.includes(q.name.toLowerCase())) return false;
      if (active.includes('email') && q.email && !l.email.toLowerCase().includes(q.email.toLowerCase())) return false;
      if (active.includes('phone') && q.phone && !l.phone.includes(q.phone)) return false;
      if (active.includes('source') && q.source && l.source !== q.source) return false;
      if (active.includes('status') && q.status && statusOf(l) !== q.status) return false;
      return true;
    });
  }, [leads, active, q]);

  function exportCsv() {
    const rows = [['email', 'firstName', 'lastName', 'phone', 'source', 'status', 'createdAt'],
      ...filtered.map((l) => [l.email, l.firstName, l.lastName, l.phone, l.source, statusOf(l), l.createdAt])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleChip(k: ChipKey) {
    setActive((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  return (
    <DashboardShell
      title="My Customers"
      subtitle="Everyone who subscribed or bought from your store."
      maxWidth="max-w-6xl"
      actions={
        <div className="flex items-center gap-2">
          {leads && leads.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCsv}><IconDownload size={15} /> Export</Button>
          )}
          <Button size="sm" onClick={() => setModalOpen(true)}><IconPlus size={15} /> Add Contacts</Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Card><div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Contacts</div><div className="mt-1 text-2xl font-bold">{stats ? stats.total : '—'}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Customers</div><div className="mt-1 text-2xl font-bold">{stats ? stats.customers : '—'}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Subscribed</div><div className="mt-1 text-2xl font-bold">{stats ? stats.subscribers : '—'}</div></Card>
      </div>

      <div className="mt-6">
        <FilterChips chips={CHIPS} active={active} onToggle={toggleChip} />
      </div>

      {active.length > 0 && (
        <Card className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.includes('name') && <Field label="Name contains" value={q.name} onChange={(e) => setQ({ ...q, name: e.target.value })} />}
            {active.includes('email') && <Field label="Email contains" value={q.email} onChange={(e) => setQ({ ...q, email: e.target.value })} />}
            {active.includes('phone') && <Field label="Phone contains" value={q.phone} onChange={(e) => setQ({ ...q, phone: e.target.value })} />}
            {active.includes('source') && (
              <Select label="Source" value={q.source} onChange={(e) => setQ({ ...q, source: e.target.value })}>
                <option value="">Any source</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}
            {active.includes('status') && (
              <Select label="Status" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })}>
                <option value="">Any status</option>
                <option value="Customer">Customer</option>
                <option value="Subscriber">Subscriber</option>
                <option value="Unsubscribed">Unsubscribed</option>
              </Select>
            )}
          </div>
        </Card>
      )}

      <div className="mt-4">
        {leads === null ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={24} />}
            title={leads.length === 0 ? 'Get your first customer' : 'No contacts matching filters'}
            description={
              leads.length === 0
                ? 'Contacts appear automatically as people subscribe or buy — or add them manually.'
                : 'Update or clear your filters to find what you’re looking for.'
            }
            action={leads.length === 0 && <Button onClick={() => setModalOpen(true)}><IconPlus size={16} /> Add Contacts</Button>}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-surface-subtle text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Since</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b border-line transition last:border-0 hover:bg-surface-subtle">
                      <td className="px-5 py-3 font-medium">{[l.firstName, l.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-5 py-3 text-neutral-600">{l.email}</td>
                      <td className="px-5 py-3 text-neutral-500">{l.phone || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{fmtDate(l.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Badge tone={l.isCustomer ? 'success' : l.unsubscribed ? 'neutral' : 'brand'}>{statusOf(l)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <AddContactModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={load} />
    </DashboardShell>
  );
}

export default function CustomersPage() {
  return <CustomersView />;
}
