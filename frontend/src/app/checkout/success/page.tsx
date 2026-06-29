import { ButtonLink, Card } from '@/components/ui';
import { IconCheckCircle } from '@/components/icons';
import { CheckoutSuccessClient } from '@/components/CheckoutSuccessClient';

/**
 * Post-checkout landing. Real Stripe Connect checkouts pass session_id + username;
 * the client calls /api/checkout/complete to fulfil when webhooks aren't running
 * locally. Demo mode passes token directly in the URL.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    demo?: string;
    kind?: string;
    token?: string;
    session_id?: string;
    username?: string;
  }>;
}) {
  const { demo, kind, token, session_id: sessionId, username } = await searchParams;
  const isDemo = demo === '1';
  const useStripeFulfil = Boolean(sessionId && username && !isDemo);

  const accessHref =
    token && kind === 'course' ? `/learn/${token}` : token && (kind === 'product' || kind === 'membership' || kind === 'payment_plan') ? `/access/${token}` : token && kind === 'booking' ? `/booking/${token}` : token && kind === 'webinar' ? `/webinar/${token}` : null;
  const showAccess = Boolean(accessHref);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-radial px-5">
      <div className="w-full max-w-md text-center">
        <Card className="animate-scale-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success-50 text-success-600">
            <IconCheckCircle size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Payment complete</h1>

          {useStripeFulfil ? (
            <CheckoutSuccessClient sessionId={sessionId!} username={username!} kind={kind} />
          ) : showAccess ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {kind === 'booking'
                  ? 'Your booking is confirmed — we&apos;ve also emailed you the details.'
                  : kind === 'webinar'
                    ? 'You&apos;re registered — we&apos;ve also emailed you the details.'
                    : kind === 'membership'
                    ? 'Your membership is active — we&apos;ve emailed you access details.'
                    : kind === 'payment_plan'
                      ? 'Your payment plan has started — we&apos;ve emailed you access details.'
                      : 'Your purchase is ready. We&apos;ve also emailed this access link to you.'}
              </p>
              {isDemo && (
                <span className="mt-3 inline-flex rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-semibold text-warn-700">
                  Demo mode · no real charge
                </span>
              )}
              {accessHref && (
                <ButtonLink href={accessHref} variant="primary" className="mt-6">
                  {kind === 'course' ? 'Start the course →' : kind === 'booking' ? 'View your booking →' : kind === 'webinar' ? 'View your registration →' : kind === 'membership' ? 'Access your membership →' : kind === 'payment_plan' ? 'Access your purchase →' : 'Access your download →'}
                </ButtonLink>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Thanks for your purchase! We&apos;ve emailed you a link to access your product. It can take a
              moment to arrive.
            </p>
          )}

          <ButtonLink href="/" variant="secondary" className="mt-6">
            Back to Stan
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}
