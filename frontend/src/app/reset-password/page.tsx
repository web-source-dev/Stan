'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiRequest('/api/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  if (!token) return <Alert kind="error">This reset link is missing its token.</Alert>;
  if (done) return <Alert kind="success">Password updated. Redirecting to login…</Alert>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" loading={busy} fullWidth size="lg">
        {busy ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      footer={
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
