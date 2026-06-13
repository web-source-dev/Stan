'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { AuthShell, Alert, ButtonLink } from '@/components/ui';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    apiRequest('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiException ? err.message : 'Verification failed');
      });
  }, [token]);

  if (state === 'pending') return <p className="text-sm text-neutral-500">Verifying…</p>;
  if (state === 'ok')
    return (
      <div className="space-y-4">
        <Alert kind="success">Your email is verified. You can now publish your storefront.</Alert>
        <ButtonLink href="/dashboard" fullWidth size="lg">Go to dashboard</ButtonLink>
      </div>
    );
  return <Alert kind="error">{message}</Alert>;
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <VerifyInner />
      </Suspense>
    </AuthShell>
  );
}
