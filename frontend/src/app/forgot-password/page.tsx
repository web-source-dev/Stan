'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { AuthShell, Button, Field, Alert } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always succeeds from the UI's perspective — the API never reveals
    // whether an email is registered.
    await apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email } }).catch(() => {});
    setSent(true);
    setBusy(false);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a reset link"
      footer={
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {sent ? (
        <Alert kind="success">
          If an account exists for {email}, a reset link is on its way. Check your inbox.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={busy} fullWidth size="lg">
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
