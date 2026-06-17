'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Alert } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconUsers, IconDots, IconChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

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
  purchases?: number;
  spentCents?: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const COUNTRIES = [
  { code: '+1', iso: 'us' },
  { code: '+44', iso: 'gb' },
  { code: '+91', iso: 'in' },
  { code: '+92', iso: 'pk' },
  { code: '+61', iso: 'au' },
  { code: '+49', iso: 'de' },
  { code: '+33', iso: 'fr' },
  { code: '+971', iso: 'ae' },
];

const MODAL_INPUT =
  'w-full rounded-xl border border-line-strong bg-white px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

/* ------------------------------------------------------------------ */
/* Add-contact modal (manual + CSV import)                             */
/* ------------------------------------------------------------------ */

/**
 * RFC-4180-aware CSV parser: handles quoted fields, commas inside quotes,
 * escaped quotes (""), and quoted newlines. Returns an array of rows, each a
 * list of cell strings.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // Finish the row on a newline; swallow the \n of a \r\n pair.
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  // Flush the trailing cell/row if the file doesn't end with a newline.
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function parseCsv(text: string): { email: string; firstName?: string; lastName?: string; phone?: string }[] {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const ei = idx(['email', 'email address', 'e-mail']);
  const fi = idx(['first name', 'firstname', 'first']);
  const li = idx(['last name', 'lastname', 'last']);
  const pi = idx(['phone', 'phone number', 'mobile']);
  const start = ei === -1 ? 0 : 1;
  const emailCol = ei === -1 ? 0 : ei;
  const out: { email: string; firstName?: string; lastName?: string; phone?: string }[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim());
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

  const iso = COUNTRIES.find((c) => c.code === code)?.iso ?? 'us';

  function reset() {
    setName(''); setEmail(''); setPhone(''); setCode('+1'); setError(''); setNotice('');
  }

  async function addManual() {
    setBusy(true); setError(''); setNotice('');
    try {
      const [firstName, ...rest] = name.trim().split(' ');
      await authedRequest('/api/leads/manage', {
        method: 'POST',
        body: {
          email,
          firstName: firstName || undefined,
          lastName: rest.join(' ') || undefined,
          phone: phone ? `${code} ${phone}`.trim() : undefined,
        },
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
        { method: 'POST', body: { rows } },
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
    <Modal open={open} onClose={onClose} size="md">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Add a contact…</h2>
        <p className="mt-1.5 text-sm text-neutral-500">Manually enter customer details</p>
      </div>

      {/* Manual entry */}
      <div className="mt-6 space-y-3">
        <input className={MODAL_INPUT} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={MODAL_INPUT} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-white pl-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://flagcdn.com/24x18/${iso}.png`} alt="" width={22} height={16} className="rounded-sm" />
            <div className="relative flex items-center">
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="cursor-pointer appearance-none bg-transparent py-3.5 pr-6 text-[15px] text-ink outline-none"
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <IconChevronDown size={16} className="pointer-events-none absolute right-1 text-neutral-400" />
            </div>
          </div>
          <input
            className={cn(MODAL_INPUT, 'flex-1')}
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}

        <button
          onClick={addManual}
          disabled={!email || busy}
          className="h-[52px] w-full rounded-full bg-brand-600 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add Contact'}
        </button>
      </div>

      {/* Import */}
      <div className="mt-7 text-center">
        <h3 className="text-base font-bold text-[#1a1c3a]">…or import a list</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
          Please upload a CSV file with the following columns: Email Address, First Name, Last Name, and Phone Number.
        </p>
        <p className="mt-2 text-xs text-neutral-400">Maximum of 5,000 contacts per account.</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-4 h-[52px] w-full rounded-full bg-brand-50 text-[15px] font-bold text-brand-600 transition hover:bg-brand-100 disabled:opacity-50"
        >
          Upload
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Customers CRM                                                       */
/* ------------------------------------------------------------------ */

type ChipKey = 'name' | 'email' | 'since' | 'purchases' | 'spent' | 'product' | 'subscription' | 'tag';
const CHIPS: { value: ChipKey; label: string; filterable?: boolean }[] = [
  { value: 'name', label: 'Name', filterable: true },
  { value: 'email', label: 'Email', filterable: true },
  { value: 'since', label: 'Since' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'spent', label: 'Spent' },
  { value: 'product', label: 'Product' },
  { value: 'subscription', label: 'Active Subscription' },
  { value: 'tag', label: 'Tag' },
];

function CustomersContent({ initialLeads }: { initialLeads?: Lead[] }) {
  const { authedRequest } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(initialLeads ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<ChipKey[]>([]);
  const [q, setQ] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await authedRequest<{ leads: Lead[] }>('/api/leads/manage');
    setLeads(res.leads);
  }, [authedRequest]);

  useEffect(() => {
    if (initialLeads !== undefined) return;
    void load();
  }, [load, initialLeads]);

  const filtered = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      const fullName = `${l.firstName} ${l.lastName}`.toLowerCase();
      if (active.includes('name') && q.name && !fullName.includes(q.name.toLowerCase())) return false;
      if (active.includes('email') && q.email && !l.email.toLowerCase().includes(q.email.toLowerCase())) return false;
      return true;
    });
  }, [leads, active, q]);

  function exportCsv() {
    setMenuOpen(false);
    const rows = [['email', 'firstName', 'lastName', 'phone', 'source', 'createdAt'],
      ...filtered.map((l) => [l.email, l.firstName, l.lastName, l.phone, l.source, l.createdAt])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleChip(k: ChipKey) {
    setActive((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  const customerCount = filtered.length;

  return (
    <>
      {/* Add Contacts */}
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center rounded-full border border-brand-400 bg-white px-5 py-2 text-sm font-bold text-brand-600 transition hover:bg-brand-50"
        >
          Add Contacts
        </button>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)] sm:p-7">
        {/* Filter chips */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {CHIPS.map((c) => {
              const on = active.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => toggleChip(c.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                    on ? 'bg-brand-100 text-brand-700' : 'bg-brand-50 text-brand-600 hover:bg-brand-100',
                  )}
                >
                  <span className="text-base leading-none">{on ? '×' : '+'}</span>
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Overflow menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
              aria-label="More options"
            >
              <IconDots size={20} className="rotate-90" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lift">
                  <button onClick={exportCsv} className="w-full px-4 py-2 text-left text-sm font-medium text-ink hover:bg-surface-muted">
                    Export CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active text filters */}
        {(active.includes('name') || active.includes('email')) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {active.includes('name') && (
              <input
                className="w-56 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Name contains…"
                value={q.name}
                onChange={(e) => setQ({ ...q, name: e.target.value })}
              />
            )}
            {active.includes('email') && (
              <input
                className="w-56 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Email contains…"
                value={q.email}
                onChange={(e) => setQ({ ...q, email: e.target.value })}
              />
            )}
          </div>
        )}

        {/* Table */}
        <div className="mt-6">
          {leads === null ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-left text-[15px] font-bold text-[#1a1c3a]">
                      <th className="px-2 pb-3 font-bold">Name</th>
                      <th className="px-2 pb-3 font-bold">Email</th>
                      <th className="px-2 pb-3 font-bold">Since</th>
                      <th className="px-2 pb-3 font-bold">Purchases</th>
                      <th className="px-2 pb-3 font-bold">Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id} className="border-b border-line/70 text-[15px] transition last:border-0 hover:bg-surface-subtle/60">
                        <td className="px-2 py-4 font-bold text-[#1a1c3a]">
                          {[l.firstName, l.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-2 py-4 text-neutral-400">{l.email}</td>
                        <td className="whitespace-nowrap px-2 py-4 text-neutral-400">{fmtDate(l.createdAt)}</td>
                        <td className="px-2 py-4 text-[#1a1c3a]">{l.purchases ?? 0}</td>
                        <td className="px-2 py-4 font-bold text-emerald-600">{fmtMoney(l.spentCents ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <IconUsers size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-[#1a1c3a]">
                    {leads.length === 0 ? 'Get your first customer' : 'No contacts matching filters'}
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">
                    {leads.length === 0
                      ? 'Contacts appear automatically as people subscribe or buy — or add them manually.'
                      : 'Update or clear your filters to find what you’re looking for.'}
                  </p>
                </div>
              ) : (
                <div className="mt-4 text-[13px] font-bold text-[#1a1c3a]">
                  {customerCount} {customerCount === 1 ? 'Customer' : 'Customers'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AddContactModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={load} />
    </>
  );
}

export default function CustomersPage() {
  return (
    <DashboardShell title="Customers" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <CustomersContent />
    </DashboardShell>
  );
}
