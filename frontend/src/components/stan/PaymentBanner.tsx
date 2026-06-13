'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import type { ConnectStatus } from '@/lib/types';

/** Stan-style yellow alert when payouts are not connected. */
export function PaymentBanner() {
  const { authedRequest } = useAuth();
  const [status, setStatus] = useState<ConnectStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedRequest<ConnectStatus>('/api/payments/connect/status');
      setStatus(res);
    } catch {
      setStatus(null);
    }
  }, [authedRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!status || status.chargesEnabled) return null;

  return (
    <div className="mb-6 rounded-xl bg-[#fffbeb] px-4 py-3 text-center text-sm text-[#92400e] ring-1 ring-inset ring-[#fde68a]/80">
      Heads up, customers can&apos;t purchase from you yet! Please{' '}
      <Link href="/dashboard/settings?tab=payments" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
        set up your Direct Deposit
      </Link>{' '}
      to start selling.
    </div>
  );
}
