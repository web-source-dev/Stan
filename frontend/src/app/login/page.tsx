'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type TwoFactorMethod } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';
import { cn } from '@/lib/cn';

export default function LoginPage() {
  const { login, verifyTwoFactor, resendTwoFactorEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [methods, setMethods] = useState<TwoFactorMethod[]>(['email']);
  const [method, setMethod] = useState<TwoFactorMethod>('email');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired && res.challengeId) {
        const m = (res.methods?.length ? res.methods : ['email']) as TwoFactorMethod[];
        setChallengeId(res.challengeId);
        setMethods(m);
        setMethod(m.includes('email') ? 'email' : 'authenticator');
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
      await verifyTwoFactor(challengeId, code, method);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not verify the code');
      setBusy(false);
    }
  }

  async function onResend() {
    setResendMsg('');
    setResendBusy(true);
    try {
      await resendTwoFactorEmail(challengeId);
      setResendMsg('A new code has been sent to your email.');
    } catch (err) {
      setResendMsg(err instanceof ApiException ? err.message : 'Could not resend code');
    } finally {
      setResendBusy(false);
    }
  }

  if (challengeId) {
    const emailMethod = methods.includes('email');
    const authMethod = methods.includes('authenticator');
    const subtitle =
      method === 'email'
        ? `Enter the 6-digit code we emailed to ${email}`
        : 'Enter the 6-digit code from your authenticator app';

    return (
      <AuthShell
        title="Verify it's you"
        subtitle={subtitle}
        footer={
          <button
            onClick={() => {
              setChallengeId('');
              setCode('');
              setError('');
              setResendMsg('');
            }}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            ← Back to login
          </button>
        }
      >
        {emailMethod && authMethod && (
          <div className="mb-4 flex gap-2 rounded-xl bg-surface-subtle p-1">
            <button
              type="button"
              onClick={() => { setMethod('email'); setCode(''); setError(''); }}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold transition',
                method === 'email' ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-ink',
              )}
            >
              Email code
            </button>
            <button
              type="button"
              onClick={() => { setMethod('authenticator'); setCode(''); setError(''); }}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold transition',
                method === 'authenticator' ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-ink',
              )}
            >
              Authenticator
            </button>
          </div>
        )}

        <form onSubmit={onVerify} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          {devCode && method === 'email' && (
            <Alert kind="info">
              Dev mode — your code is <span className="font-bold tracking-widest">{devCode}</span>
            </Alert>
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
          <Button type="submit" loading={busy} disabled={code.length < 6} fullWidth size="lg">
            {busy ? 'Verifying…' : 'Verify & log in'}
          </Button>
          {method === 'email' && emailMethod && (
            <div className="text-center">
              <button
                type="button"
                disabled={resendBusy}
                onClick={() => void onResend()}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                {resendBusy ? 'Sending…' : 'Resend code'}
              </button>
              {resendMsg && <p className="mt-2 text-xs text-neutral-500">{resendMsg}</p>}
            </div>
          )}
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
