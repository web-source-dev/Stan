'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, ButtonLink } from '@/components/ui';

export const dynamic = 'force-dynamic';

function PayPalReturnInner() {
  const params = useSearchParams();
  const orderId = params.get('token'); // PayPal appends ?token=<orderId>
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!orderId) {
      setError('Missing PayPal order reference.');
      return;
    }
    (async () => {
      try {
        const res = await apiRequest<{ url: string }>('/api/checkout/paypal/capture', {
          method: 'POST',
          credentials: false,
          body: { orderId },
        });
        window.location.href = res.url;
      } catch (err) {
        setError(err instanceof ApiException ? err.message : 'We could not finalize your PayPal payment.');
      }
    })();
  }, [orderId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-radial px-5">
      <div className="w-full max-w-md text-center">
        <Card className="animate-scale-in">
          {error ? (
            <>
              <h1 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Payment not completed</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{error}</p>
              <ButtonLink href="/" variant="secondary" className="mt-6">Back to store</ButtonLink>
            </>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
              <h1 className="mt-5 text-xl font-bold tracking-tight text-[#1a1c3a]">Finalizing your payment…</h1>
              <p className="mt-2 text-sm text-neutral-500">Please don&apos;t close this window.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PayPalReturnPage() {
  return (
    <Suspense fallback={null}>
      <PayPalReturnInner />
    </Suspense>
  );
}
