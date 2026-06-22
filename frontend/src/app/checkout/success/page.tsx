import { ButtonLink, Card } from '@/components/ui';
import { IconCheckCircle } from '@/components/icons';

/**
 * Post-checkout landing. With real Stripe, fulfilment is driven by the webhook
 * (not this redirect), so we tell the buyer to check their email for the access
 * link. In dev demo mode the checkout grants access synchronously and passes the
 * access token here, so we surface a direct link to the purchase.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; kind?: string; token?: string }>;
}) {
  const { demo, kind, token } = await searchParams;
  const isDemo = demo === '1';

  const accessHref =
    token && kind === 'course' ? `/learn/${token}` : token && kind === 'product' ? `/access/${token}` : null;
  // Demo and PayPal capture both fulfil synchronously and pass a token, so show
  // the direct access link whenever we have one (Stripe is webhook-driven → email).
  const showAccess = Boolean(accessHref);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-radial px-5">
      <div className="w-full max-w-md text-center">
        <Card className="animate-scale-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success-50 text-success-600">
            <IconCheckCircle size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Payment complete</h1>

          {showAccess ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {kind === 'booking'
                  ? 'Your booking is confirmed — we&apos;ve also emailed you the details.'
                  : 'Your purchase is ready. We&apos;ve also emailed this access link to you.'}
              </p>
              {isDemo && (
                <span className="mt-3 inline-flex rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-semibold text-warn-700">
                  Demo mode · no real charge
                </span>
              )}
              {accessHref && (
                <ButtonLink href={accessHref} variant="primary" className="mt-6">
                  {kind === 'course' ? 'Start the course →' : 'Access your download →'}
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
