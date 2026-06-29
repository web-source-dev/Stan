'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { formatPrice } from '@/lib/types';
import { track } from '@/lib/track';
import { cn } from '@/lib/cn';
import { IconArrowLeft } from '@/components/icons';

export interface PublicCheckoutProduct {
  id: string;
  username: string;
  creatorName: string;
  type: 'digital' | 'lead_magnet';
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  bottomTitle: string;
  priceCents: number;
  discountPriceCents: number;
  currency: string;
  coverImageUrl: string;
  ctaLabel: string;
  reviewsEnabled: boolean;
  reviews: { id: string; author: string; quote: string; rating: number }[];
  orderBumpEnabled: boolean;
  orderBumpTitle: string;
  orderBumpDescription: string;
  orderBumpPriceCents: number;
  affiliateEnabled: boolean;
  affiliateCommissionPercent: number;
  paymentPlanEnabled: boolean;
  paymentPlanInstallments: number;
  quantityLimit: number;
  quantityRemaining: number | null;
  salesCount: number;
  customFields: { id: string; label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
  hasDiscountCodes: boolean;
  billingInterval?: 'one_time' | 'month' | 'year';
  fulfilmentNote?: string;
}

const ACCENT = '#5865f2';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400" aria-label={`${rating} stars`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export function ProductCheckoutClient({
  product,
  username,
}: {
  product: PublicCheckoutProduct;
  username: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [discountCode, setDiscountCode] = useState('');
  const [orderBump, setOrderBump] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<{ card: boolean; paypal: boolean }>({ card: false, paypal: false });
  const formRef = useRef<HTMLFormElement>(null);
  const [pricing, setPricing] = useState<{
    finalCents: number;
    totalCents: number;
    orderBumpCents: number;
    appliedDiscountCode?: string;
    paymentPlanNote?: string;
    soldOut?: boolean;
  } | null>(null);

  const isFree = product.priceCents <= 0;
  const isRecurring =
    product.billingInterval === 'month' ||
    product.billingInterval === 'year' ||
    (product.paymentPlanEnabled && product.paymentPlanInstallments > 1);
  const paypalAllowed = !isRecurring && methods.paypal;
  const cardAllowed = methods.card;
  const canCheckout = isFree || cardAllowed || paypalAllowed;
  const soldOut = pricing?.soldOut ?? (product.quantityRemaining === 0);

  const refreshPricing = useCallback(async () => {
    if (isFree) return;
    try {
      const res = await apiRequest<{
        finalCents: number;
        totalCents: number;
        orderBumpCents: number;
        appliedDiscountCode?: string;
        paymentPlanNote?: string;
        soldOut: boolean;
      }>('/api/checkout/preview', {
        method: 'POST',
        credentials: false,
        body: {
          username,
          slug: product.slug,
          discountCode: discountCode.trim() || undefined,
          orderBump,
        },
      });
      setPricing(res);
      setError('');
    } catch (err) {
      if (err instanceof ApiException) setError(err.message);
    }
  }, [discountCode, isFree, orderBump, product.slug, username]);

  useEffect(() => {
    const t = setTimeout(() => void refreshPricing(), 300);
    return () => clearTimeout(t);
  }, [refreshPricing]);

  useEffect(() => {
    if (isFree) return;
    apiRequest<{ card: boolean; paypal: boolean }>(`/api/checkout/payment-methods/${encodeURIComponent(username)}`, {
      credentials: false,
    })
      .then(setMethods)
      .catch(() => {});
  }, [username, isFree]);

  useEffect(() => {
    if (searchParams.get('aff')) {
      try {
        sessionStorage.setItem(`aff_${product.slug}`, searchParams.get('aff')!);
      } catch {
        /* ignore */
      }
    }
  }, [product.slug, searchParams]);

  const displayCents = pricing?.totalCents ?? (
    product.discountPriceCents > 0 && product.discountPriceCents < product.priceCents
      ? product.discountPriceCents
      : product.priceCents
  );

  async function startCheckout(provider: 'card' | 'paypal') {
    if (soldOut || busy) return;
    setBusy(true);
    setError('');
    track(username, 'checkout_start');

    const affiliateRef = (() => {
      try {
        return sessionStorage.getItem(`aff_${product.slug}`) ?? undefined;
      } catch {
        return undefined;
      }
    })();

    const body = {
      username,
      slug: product.slug,
      email,
      name: name.trim() || undefined,
      source: 'checkout_page',
      discountCode: discountCode.trim() || undefined,
      orderBump: orderBump || undefined,
      affiliateRef,
      customFieldValues: customValues,
    };

    try {
      if (isFree) {
        const res = await apiRequest<{ url: string }>('/api/checkout/claim', { method: 'POST', credentials: false, body });
        window.location.href = res.url;
        return;
      }
      const path = provider === 'paypal' ? '/api/checkout/paypal/session' : '/api/checkout/session';
      const res = await apiRequest<{ url: string }>(path, { method: 'POST', credentials: false, body });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not complete checkout');
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFree && !cardAllowed && paypalAllowed) {
      void startCheckout('paypal');
      return;
    }
    void startCheckout('card');
  }

  // PayPal button is outside native submit, so trigger HTML validation manually.
  function payWithPayPal() {
    if (formRef.current && !formRef.current.reportValidity()) return;
    void startCheckout('paypal');
  }

  const lines = (product.description || '').split('\n').filter(Boolean);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-5 pb-12 pt-6">
        <Link
          href={`/${username}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink"
        >
          <IconArrowLeft size={16} /> Back to store
        </Link>

        {product.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.coverImageUrl} alt={product.title} className="mb-4 w-full rounded-2xl object-cover" style={{ aspectRatio: '16/10' }} />
        ) : (
          <div className="mb-4 aspect-[16/10] rounded-2xl bg-surface-muted" />
        )}

        <h1 className="text-xl font-bold leading-snug text-ink">{product.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold" style={{ color: ACCENT }}>
            {isFree ? 'Free' : formatPrice(displayCents, product.currency)}
            {!isFree && product.billingInterval === 'month' && <span className="text-sm font-semibold text-neutral-400"> / month</span>}
            {!isFree && product.billingInterval === 'year' && <span className="text-sm font-semibold text-neutral-400"> / year</span>}
          </span>
          {!isFree && product.discountPriceCents > 0 && product.discountPriceCents < product.priceCents && (
            <span className="text-sm text-neutral-400 line-through">
              {formatPrice(product.priceCents, product.currency)}
            </span>
          )}
          {product.quantityRemaining != null && product.quantityRemaining > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {product.quantityRemaining} left
            </span>
          )}
        </div>
        {product.fulfilmentNote && (
          <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs font-medium text-neutral-600">
            {product.fulfilmentNote}
          </p>
        )}

        {pricing?.paymentPlanNote && (
          <p className="mt-2 text-xs font-medium text-brand-600">{pricing.paymentPlanNote}</p>
        )}

        {lines.length > 0 && (
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-neutral-600">
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {product.reviewsEnabled && product.reviews.length > 0 && (
          <div className="mt-6 space-y-3">
            {product.reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-[#fafafa] p-3">
                <Stars rating={r.rating} />
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">&ldquo;{r.quote}&rdquo;</p>
                <p className="mt-1 text-xs font-semibold text-neutral-500">— {r.author}</p>
              </div>
            ))}
          </div>
        )}

        {product.bottomTitle && (
          <h2 className="mt-6 text-base font-bold text-ink">{product.bottomTitle}</h2>
        )}

        {soldOut ? (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            This product is sold out.
          </div>
        ) : (
          <form ref={formRef} onSubmit={submit} className="mt-6 space-y-3">
            <input
              required
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-200"
            />
            <input
              required
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-200"
            />

            {product.customFields.map((field) => (
              field.type === 'textarea' ? (
                <textarea
                  key={field.id}
                  required={field.required}
                  placeholder={field.label}
                  rows={3}
                  value={customValues[field.id] ?? ''}
                  onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full resize-y rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-200"
                />
              ) : (
                <input
                  key={field.id}
                  required={field.required}
                  type={field.type === 'phone' ? 'tel' : 'text'}
                  placeholder={field.label}
                  value={customValues[field.id] ?? ''}
                  onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-200"
                />
              )
            ))}

            {!isFree && product.hasDiscountCodes && (
              <div className="flex gap-2">
                <input
                  placeholder="Discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => void refreshPricing()}
                  className="shrink-0 rounded-xl border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                >
                  Apply
                </button>
              </div>
            )}
            {pricing?.appliedDiscountCode && (
              <p className="text-xs font-semibold text-emerald-600">
                Code {pricing.appliedDiscountCode} applied
              </p>
            )}

            {!isFree && product.orderBumpEnabled && product.orderBumpPriceCents > 0 && (
              <label className="flex cursor-pointer gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                <input
                  type="checkbox"
                  checked={orderBump}
                  onChange={(e) => setOrderBump(e.target.checked)}
                  className="mt-1 rounded border-line text-brand-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {product.orderBumpTitle || 'Add order bump'}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-brand-600">
                      +{formatPrice(product.orderBumpPriceCents, product.currency)}
                    </span>
                  </div>
                  {product.orderBumpDescription && (
                    <p className="mt-0.5 text-xs text-neutral-600">{product.orderBumpDescription}</p>
                  )}
                </div>
              </label>
            )}

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            {!isFree && !canCheckout && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                This creator hasn&apos;t finished payment setup yet. Check back soon or contact them directly.
              </p>
            )}

            {(isFree || cardAllowed || (!cardAllowed && paypalAllowed)) && (
            <button
              type="submit"
              disabled={busy || (!isFree && !canCheckout)}
              className="w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {busy
                ? 'Processing…'
                : !isFree && !cardAllowed && paypalAllowed
                  ? 'Pay with PayPal'
                  : product.ctaLabel || (isFree ? 'Download' : 'Purchase')}
            </button>
            )}

            {!isFree && cardAllowed && paypalAllowed && (
              <>
                <div className="flex items-center gap-3 py-0.5 text-xs font-medium text-neutral-400">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <button
                  type="button"
                  onClick={payWithPayPal}
                  disabled={busy}
                  aria-label="Pay with PayPal"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ffc439] py-3.5 text-[15px] font-bold text-[#003087] transition hover:brightness-[1.03] disabled:opacity-60"
                >
                  <span>Pay with</span>
                  <span className="font-extrabold italic"><span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span></span>
                </button>
              </>
            )}
          </form>
        )}

        {product.affiliateEnabled && (
          <p className="mt-6 text-center text-xs text-neutral-400">
            Earn {product.affiliateCommissionPercent}% commission when you share this product.
          </p>
        )}
      </div>
    </main>
  );
}
