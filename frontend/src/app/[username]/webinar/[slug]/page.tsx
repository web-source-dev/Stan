'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, Field, Alert, PageLoader } from '@/components/ui';
import { IconArrowLeft, IconClock, IconCalendar, IconCheckCircle, IconGlobe, IconExternal, IconUsers } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'phone';
  required: boolean;
}

interface WebinarMeta {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: string;
  durationMin: number;
  timezone: string;
  customFields: CustomField[];
  slots: { id: string; startsAt: string; seatsLeft: number }[];
}

function formatWhen(iso: string, tz: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
}

export default function WebinarRegisterPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = use(params);
  const [meta, setMeta] = useState<WebinarMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ status: string; manageToken?: string } | null>(null);
  const [paypal, setPaypal] = useState(false);
  const [creator, setCreator] = useState({ name: '', avatarUrl: '' });

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest<WebinarMeta>(
          `/api/webinar-registrations/availability?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}`,
          { credentials: false },
        );
        setMeta(data);
        const sf = await apiRequest<{ profile?: { displayName?: string; username?: string; avatarUrl?: string } }>(
          `/api/storefront/${encodeURIComponent(username)}`,
          { credentials: false },
        );
        if (sf.profile) {
          setCreator({ name: sf.profile.displayName || sf.profile.username || '', avatarUrl: sf.profile.avatarUrl || '' });
        }
      } catch (err) {
        if (err instanceof ApiException && err.status === 404) setMissing(true);
      }
    })();
  }, [username, slug]);

  useEffect(() => {
    apiRequest<{ paypal: boolean }>(`/api/checkout/payment-methods/${encodeURIComponent(username)}`, { credentials: false })
      .then((m) => setPaypal(m.paypal))
      .catch(() => {});
  }, [username]);

  async function register(provider: 'stripe' | 'paypal') {
    if (busy || !selectedSlot || !meta) return;
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ status: string; manageToken?: string; checkoutUrl?: string }>('/api/webinar-registrations', {
        method: 'POST',
        credentials: false,
        body: {
          username,
          slug,
          slotId: selectedSlot,
          email,
          name,
          customFieldValues: answers,
          provider,
        },
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setDone({ status: res.status, manageToken: res.manageToken });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not register');
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-sm text-neutral-500">
        This webinar page was not found.
      </div>
    );
  }
  if (!meta) return <PageLoader />;

  const selected = meta.slots.find((s) => s.id === selectedSlot);
  const priceText = meta.priceCents ? formatPrice(meta.priceCents, meta.currency) : 'Free';
  const initials = (creator.name || username).slice(0, 2).toUpperCase();

  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-radial px-5">
        <Card className="w-full max-w-md text-center animate-scale-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success-50 text-success-600">
            <IconCheckCircle size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            {done.status === 'confirmed' ? "You're registered 🎉" : 'Almost there'}
          </h1>
          {selected && (
            <p className="mt-2 text-sm font-semibold text-[#1a1c3a]">
              {meta.title} · {formatWhen(selected.startsAt, meta.timezone)}
            </p>
          )}
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
            {done.status === 'confirmed'
              ? "We've emailed your confirmation — and we'll remind you before it starts."
              : 'Complete payment to secure your spot.'}
          </p>
          {done.manageToken && (
            <Link
              href={`/webinar/${done.manageToken}`}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              View registration <IconExternal size={15} />
            </Link>
          )}
          <Link href={`/${username}`} className="mt-3 block text-sm font-medium text-neutral-500 hover:text-ink">
            Back to store
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-radial px-4 py-8 sm:px-6">
      <div className="w-full max-w-2xl">
        <Link href={`/${username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-ink">
          <IconArrowLeft size={16} /> Back to store
        </Link>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-lift lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border-b border-line bg-[#fafafe] p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              {creator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt={creator.name} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials}</div>
              )}
              <div className="min-w-0">
                {creator.name && <div className="truncate text-sm font-semibold text-neutral-500">{creator.name}</div>}
                <div className="inline-flex items-center gap-1 text-xs font-bold text-brand-600">
                  <IconCalendar size={12} /> Webinar
                </div>
              </div>
            </div>
            <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-[#1a1c3a]">{meta.title}</h1>
            {meta.shortDescription && <p className="mt-2 text-sm text-neutral-600">{meta.shortDescription}</p>}
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2.5 ring-1 ring-line">
                <IconClock size={18} className="shrink-0 text-brand-600" />
                <span className="text-neutral-700">{meta.durationMin} min</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2.5 ring-1 ring-line">
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-sm font-bold text-brand-600">$</span>
                <span className="font-semibold text-[#1a1c3a]">{priceText}</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2.5 ring-1 ring-line">
                <IconGlobe size={18} className="shrink-0 text-brand-600" />
                <span className="text-neutral-700">{meta.timezone.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void register('stripe');
            }}
            className="p-6 sm:p-7"
          >
            {error && (
              <div className="mb-4">
                <Alert kind="error">{error}</Alert>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">Step 1</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[#1a1c3a]">Pick a session</h2>
            </div>

            {meta.slots.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-surface-subtle px-4 py-6 text-center text-sm text-neutral-500">
                No upcoming sessions are open for registration right now.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {meta.slots.map((slot) => {
                  const on = selectedSlot === slot.id;
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(slot.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition',
                          on
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-transparent bg-surface-subtle hover:border-brand-200',
                        )}
                      >
                        <span className="font-semibold text-[#1a1c3a]">{formatWhen(slot.startsAt, meta.timezone)}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                          <IconUsers size={14} /> {slot.seatsLeft} left
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedSlot && (
              <div className="mt-8 animate-fade rounded-2xl border border-line bg-[#fafafe] p-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">Step 2</p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-[#1a1c3a]">Your details</h2>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  {meta.customFields.map((f) => (
                    <Field
                      key={f.id}
                      label={f.label}
                      required={f.required}
                      value={answers[f.id] ?? answers[f.label] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                    />
                  ))}

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? 'Processing…' : meta.priceCents ? `Continue · ${priceText}` : 'Register free'}
                  </button>

                  {meta.priceCents > 0 && paypal && (
                    <button
                      type="button"
                      onClick={() => void register('paypal')}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ffc439] py-3 text-sm font-bold text-[#003087] transition hover:brightness-[1.03] disabled:opacity-60"
                    >
                      <span>Pay with</span>
                      <span className="font-extrabold italic">
                        <span className="text-[#003087]">Pay</span>
                        <span className="text-[#009cde]">Pal</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {meta.description && (
          <div className="mt-6 rounded-2xl bg-white/80 p-5 text-sm leading-relaxed text-neutral-600 shadow-soft">
            {meta.description.split('\n').map((line, i) => (
              <p key={i} className={i > 0 ? 'mt-2' : ''}>
                {line.replace(/\*\*(.*?)\*\*/g, '$1')}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
