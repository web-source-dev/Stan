'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { RequireAuth } from '@/components/RequireAuth';
import { Button, Field, Textarea, Alert } from '@/components/ui';
import { Logo, IconBox, IconCalendar, IconMagnet, IconSparkles, IconCheck } from '@/components/icons';
import { cn } from '@/lib/cn';
import type { CreatorProfile } from '@/lib/types';

const CTA_OPTIONS = [
  { value: 'shop', label: 'Sell products', icon: IconBox },
  { value: 'book', label: 'Take bookings', icon: IconCalendar },
  { value: 'lead', label: 'Capture leads', icon: IconMagnet },
  { value: 'none', label: 'Decide later', icon: IconSparkles },
] as const;

function OnboardingForm() {
  const { authedRequest, refreshUser } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [primaryCta, setPrimaryCta] = useState<(typeof CTA_OPTIONS)[number]['value']>('none');

  const [check, setCheck] = useState<{ status: 'idle' | 'checking' | 'available' | 'taken'; msg?: string }>({
    status: 'idle',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Debounced username availability check.
  useEffect(() => {
    if (!username) {
      setCheck({ status: 'idle' });
      return;
    }
    if (!/^[a-z][a-z0-9_]{2,29}$/.test(username)) {
      setCheck({ status: 'taken', msg: '3–30 chars, letters/numbers/underscore, start with a letter' });
      return;
    }
    setCheck({ status: 'checking' });
    const t = setTimeout(async () => {
      try {
        const res = await authedRequest<{ available: boolean }>(
          `/api/creator/username-available?username=${encodeURIComponent(username)}`,
        );
        setCheck(res.available ? { status: 'available' } : { status: 'taken', msg: 'That username is taken' });
      } catch {
        setCheck({ status: 'idle' });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, authedRequest]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authedRequest<{ profile: CreatorProfile }>('/api/creator/onboarding', {
        method: 'POST',
        body: { username, displayName, category, bio, primaryCta },
      });
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  const canSubmit = check.status === 'available' && displayName.trim().length > 0 && !busy;

  return (
    <div className="min-h-screen bg-brand-radial">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-6">
        <Logo />
        <span className="text-sm text-neutral-500">Step 1 of 1</span>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-16">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight">Set up your store</h1>
          <p className="mt-2 text-neutral-600">
            This is your public page — pick a handle and tell people who you are. You can change everything later.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-7 rounded-3xl border border-line bg-white p-7 shadow-card sm:p-9">
          {error && <Alert kind="error">{error}</Alert>}

          {/* Username with live preview */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Your link</span>
            <div
              className={cn(
                'flex items-center overflow-hidden rounded-lg border bg-white shadow-xs transition focus-within:ring-4',
                check.status === 'available'
                  ? 'border-success-500 focus-within:ring-success-500/15'
                  : check.status === 'taken'
                    ? 'border-danger-500 focus-within:ring-danger-500/15'
                    : 'border-line-strong focus-within:border-brand-400 focus-within:ring-brand-500/15',
              )}
            >
              <span className="select-none border-r border-line bg-surface-muted px-3 py-2.5 text-sm text-neutral-500">
                stan.store/
              </span>
              <input
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-neutral-400"
                placeholder="coachjane"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
              <span className="px-3 text-xs">
                {check.status === 'checking' && <span className="text-neutral-400">Checking…</span>}
                {check.status === 'available' && (
                  <span className="flex items-center gap-1 font-medium text-success-600">
                    <IconCheck size={14} /> Available
                  </span>
                )}
              </span>
            </div>
            {check.status === 'taken' && check.msg && (
              <span className="mt-1.5 block text-xs font-medium text-danger-600">{check.msg}</span>
            )}
          </div>

          <Field
            label="Display name"
            placeholder="Coach Jane"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Field
            label="Category"
            optional
            placeholder="Fitness coach"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <Textarea
            label="Short bio"
            optional
            rows={3}
            maxLength={500}
            placeholder="Help your audience get to know you in a sentence or two."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <div>
            <span className="mb-2.5 block text-sm font-medium text-neutral-800">What's your main goal?</span>
            <div className="grid grid-cols-2 gap-2.5">
              {CTA_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = primaryCta === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPrimaryCta(opt.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                      selected
                        ? 'border-brand-300 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                        : 'border-line-strong text-neutral-600 hover:border-line-strong hover:bg-surface-muted',
                    )}
                  >
                    <Icon size={18} className={selected ? 'text-brand-600' : 'text-neutral-400'} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={!canSubmit} loading={busy} fullWidth size="lg">
            {busy ? 'Creating your store…' : 'Create my store'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Changed your mind?{' '}
          <Link href="/dashboard" className="font-medium text-brand-600 hover:text-brand-700">
            Skip to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingForm />
    </RequireAuth>
  );
}
