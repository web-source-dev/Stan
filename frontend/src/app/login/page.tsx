'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
      setBusy(false);
    }
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
