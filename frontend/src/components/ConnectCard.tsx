'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Card, Button, Alert, Badge } from '@/components/ui';
import { IconCard, IconShield } from '@/components/icons';
import type { ConnectStatus } from '@/lib/types';

export function ConnectCard() {
  const { authedRequest } = useAuth();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      try {
        const res = await authedRequest<{ account: ConnectStatus }>(
          `/api/payments/connect/status${refresh ? '?refresh=1' : ''}`,
        );
        setStatus(res.account);
      } catch {
        /* ignore */
      }
    },
    [authedRequest],
  );

  useEffect(() => {
    // If we're returning from Stripe onboarding, pull live status.
    const fromConnect =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('connect');
    void load(fromConnect);
  }, [load]);

  async function startOnboarding() {
    setBusy(true);
    setError('');
    try {
      const res = await authedRequest<{ url: string }>('/api/payments/connect/onboard', {
        method: 'POST',
      });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not start onboarding');
      setBusy(false);
    }
  }

  const ready = status?.chargesEnabled;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <IconCard size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold">Payouts</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Powered by Stripe</p>
          </div>
        </div>
        <Badge tone={ready ? 'success' : status?.onboardingStatus === 'pending' ? 'warn' : 'neutral'} dot>
          {ready ? 'Connected' : status?.onboardingStatus === 'pending' ? 'In progress' : 'Not connected'}
        </Badge>
      </div>

      <p className="mt-4 text-sm text-neutral-600">
        {ready
          ? 'You can accept payments. Funds settle directly to your connected account.'
          : 'Connect a payout account to start selling paid products and bookings.'}
      </p>

      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}

      {!ready && (
        <div className="mt-4">
          <Button onClick={startOnboarding} loading={busy} fullWidth>
            {status?.connected ? 'Finish payout setup' : 'Connect payouts'}
          </Button>
        </div>
      )}
      {ready && status && !status.payoutsEnabled && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-warn-700">
          <IconShield size={14} /> Charges enabled, but payouts are pending verification.
        </p>
      )}
    </Card>
  );
}
