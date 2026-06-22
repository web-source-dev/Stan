'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';

export default function LoginPage() {
  const { login, verifyTwoFactor } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 2FA second step.
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired && res.challengeId) {
        setChallengeId(res.challengeId);
        setDevCode(res.devCode ?? '');
        setBusy(false);
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyTwoFactor(challengeId, code);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not verify the code');
      setBusy(false);
    }
  }

  if (challengeId) {
    return (
      <AuthShell
        title="Verify it's you"
        subtitle={`Enter the 6-digit code we emailed to ${email}`}
        footer={
          <button onClick={() => { setChallengeId(''); setCode(''); setError(''); }} className="font-semibold text-brand-600 hover:text-brand-700">
            ← Back to login
          </button>
        }
      >
        <form onSubmit={onVerify} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          {devCode && (
            <Alert kind="info">Dev mode — your code is <span className="font-bold tracking-widest">{devCode}</span></Alert>
          )}
          <input
            inputMode="numeric"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="w-full rounded-xl border border-line-strong bg-white px-3 py-3 text-center text-lg font-semibold tracking-[0.5em] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
          <Button type="submit" loading={busy} disabled={code.length < 4} fullWidth size="lg">
            {busy ? 'Verifying…' : 'Verify & log in'}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your creator dashboard"
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-neutral-500 hover:text-brand-600">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} fullWidth size="lg">
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  );
}
