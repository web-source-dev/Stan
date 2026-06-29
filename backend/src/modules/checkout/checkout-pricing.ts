import type { ProductDoc } from '../../models/Product';
import { AppError } from '../../utils/AppError';

export interface CheckoutPricingInput {
  discountCode?: string;
  orderBump?: boolean;
}

export interface CheckoutPricingResult {
  baseCents: number;
  finalCents: number;
  orderBumpCents: number;
  totalCents: number;
  appliedDiscountCode?: string;
  discountSavingsCents: number;
  paymentPlanNote?: string;
}

function basePriceCents(product: ProductDoc): number {
  if (product.discountPriceCents > 0 && product.discountPriceCents < product.priceCents) {
    return product.discountPriceCents;
  }
  return product.priceCents;
}

function applyDiscountCode(
  product: ProductDoc,
  amountCents: number,
  code?: string,
): { cents: number; applied?: string; savings: number } {
  if (!code?.trim()) return { cents: amountCents, savings: 0 };
  const normalized = code.trim().toUpperCase();
  const match = product.discountCodes.find((d) => d.code.toUpperCase() === normalized);
  if (!match) throw AppError.badRequest('Invalid discount code');
  let discounted = amountCents;
  if (match.type === 'percent') {
    discounted = Math.max(0, Math.round(amountCents * (1 - Math.min(100, match.value) / 100)));
  } else {
    // Fixed codes store a whole-dollar amount (the editor's "$" input), so
    // convert to cents before subtracting — otherwise "$10 off" removes 10¢.
    discounted = Math.max(0, amountCents - match.value * 100);
  }
  return { cents: discounted, applied: match.code, savings: amountCents - discounted };
}

export function assertQuantityAvailable(product: ProductDoc): void {
  if (product.quantityLimit > 0 && product.salesCount >= product.quantityLimit) {
    throw AppError.badRequest('This product is sold out');
  }
}

/** Membership products and any product with month/year billing use Stripe Subscriptions. */
export function isMembershipProduct(product: {
  productKind?: string;
  billingInterval?: string;
}): boolean {
  return (
    product.productKind === 'membership' ||
    product.billingInterval === 'month' ||
    product.billingInterval === 'year'
  );
}

export function membershipBillingInterval(product: { billingInterval?: string }): 'month' | 'year' {
  return product.billingInterval === 'year' ? 'year' : 'month';
}

/** Split-payment plan on a one-time product (not membership). */
export function isPaymentPlanProduct(product: {
  productKind?: string;
  billingInterval?: string;
  paymentPlanEnabled?: boolean;
  paymentPlanInstallments?: number;
}): boolean {
  return Boolean(
    product.paymentPlanEnabled &&
      (product.paymentPlanInstallments ?? 0) > 1 &&
      !isMembershipProduct(product),
  );
}

/** Per-installment amount in cents (may total slightly above price when not evenly divisible). */
export function paymentPlanInstallmentCents(totalCents: number, installments: number): number {
  if (installments < 2) return totalCents;
  return Math.ceil(totalCents / installments);
}

export function computeCheckoutPricing(
  product: ProductDoc,
  input: CheckoutPricingInput = {},
): CheckoutPricingResult {
  assertQuantityAvailable(product);

  const base = basePriceCents(product);
  const { cents: afterCode, applied, savings } = applyDiscountCode(product, base, input.discountCode);
  const orderBumpCents =
    input.orderBump && product.orderBumpEnabled && product.orderBumpPriceCents > 0
      ? product.orderBumpPriceCents
      : 0;
  const totalCents = afterCode + orderBumpCents;

  let paymentPlanNote: string | undefined;
  if (isPaymentPlanProduct(product) && totalCents > 0) {
    const n = product.paymentPlanInstallments;
    const per = paymentPlanInstallmentCents(totalCents, n);
    const perLabel = (per / 100).toFixed(2);
    paymentPlanNote = `Payment plan: ${n} monthly payments of $${perLabel}`;
  }

  return {
    baseCents: product.priceCents,
    finalCents: afterCode,
    orderBumpCents,
    totalCents,
    appliedDiscountCode: applied,
    discountSavingsCents: savings,
    paymentPlanNote,
  };
}
