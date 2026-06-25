'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, ApiException } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | undefined>();

const REF_STORAGE_KEY = 'stan_ref_code';

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase();
    const stored = sessionStorage.getItem(REF_STORAGE_KEY) ?? undefined;
    const code = fromUrl || stored;
    if (!code) return;
    setRef(code);
    sessionStorage.setItem(REF_STORAGE_KEY, code);
    apiRequest('/api/referrals/track', { method: 'POST', body: { code } }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup(email, password, ref);
      sessionStorage.removeItem(REF_STORAGE_KEY);
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start your 14-day free trial — no card required"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
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
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={busy} fullWidth size="lg">
          {busy ? 'Creating…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-neutral-400">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
