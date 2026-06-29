'use client';

import { useEffect, useState } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { ButtonLink } from '@/components/ui';

type FulfilResult = {
  kind: 'product' | 'course' | 'booking' | 'webinar' | 'membership' | 'payment_plan';
  token?: string;
  fulfilled: boolean;
};

export function CheckoutSuccessClient({
  sessionId,
  username,
  kind,
}: {
  sessionId: string;
  username: string;
  kind?: string;
}) {
  const [result, setResult] = useState<FulfilResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest<FulfilResult>('/api/checkout/complete', {
          method: 'POST',
          credentials: false,
          body: { sessionId, username },
        });
        if (!cancelled) setResult(res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiException ? err.message : 'Could not confirm your purchase');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, username]);

  if (loading) {
    return (
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Confirming your payment…
      </p>
    );
  }

  if (error) {
    return (
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Thanks for your purchase! {error} We&apos;ve also emailed you a link when fulfilment completes.
      </p>
    );
  }

  const resolvedKind = result?.kind ?? kind;
  const token = result?.token;

  const accessHref =
    token && resolvedKind === 'course'
      ? `/learn/${token}`
      : token && (resolvedKind === 'product' || resolvedKind === 'membership' || resolvedKind === 'payment_plan')
        ? `/access/${token}`
        : token && resolvedKind === 'booking'
          ? `/booking/${token}`
          : token && resolvedKind === 'webinar'
            ? `/webinar/${token}`
            : null;

  if (accessHref) {
    return (
      <>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {resolvedKind === 'booking'
            ? 'Your booking is confirmed — we&apos;ve also emailed you the details.'
            : resolvedKind === 'webinar'
              ? 'You&apos;re registered — we&apos;ve also emailed you the details.'
              : resolvedKind === 'membership'
              ? 'Your membership is active — we&apos;ve also emailed you access details.'
              : resolvedKind === 'payment_plan'
                ? 'Your payment plan has started — we&apos;ve emailed you access details.'
                : 'Your purchase is ready. We&apos;ve also emailed this access link to you.'}
        </p>
        <ButtonLink href={accessHref} variant="primary" className="mt-6">
          {resolvedKind === 'course'
            ? 'Start the course →'
            : resolvedKind === 'booking'
              ? 'View your booking →'
              : resolvedKind === 'webinar'
                ? 'View your registration →'
                : resolvedKind === 'membership'
                ? 'Access your membership →'
                : resolvedKind === 'payment_plan'
                  ? 'Access your purchase →'
                  : 'Access your download →'}
        </ButtonLink>
      </>
    );
  }

  return (
    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
      Thanks for your purchase! We&apos;ve emailed you a link to access your product. It can take a
      moment to arrive.
    </p>
  );
}
