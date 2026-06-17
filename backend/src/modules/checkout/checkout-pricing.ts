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
  if (product.paymentPlanEnabled && product.paymentPlanInstallments > 1 && totalCents > 0) {
    const per = (totalCents / product.paymentPlanInstallments / 100).toFixed(2);
    paymentPlanNote = `Payment plan: ${product.paymentPlanInstallments} installments of $${per} (charged in full today)`;
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
