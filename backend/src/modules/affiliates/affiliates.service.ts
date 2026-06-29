import { Types } from 'mongoose';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { AffiliateCommissionModel } from '../../models/AffiliateCommission';
import { ProductModel, type ProductDoc } from '../../models/Product';
import type { OrderDoc } from '../../models/Order';
import { recordAudit } from '../../lib/audit';
import { logger } from '../../config/logger';

export async function resolveAffiliateUserId(ref: string): Promise<string | null> {
  const normalized = ref.trim().toLowerCase();
  if (!normalized) return null;
  const profile = await CreatorProfileModel.findOne({ username: normalized }).select('userId');
  return profile ? String(profile.userId) : null;
}

export interface AffiliateOrderFields {
  affiliateRef?: string;
  affiliateUserId?: Types.ObjectId;
  affiliateCommissionCents?: number;
}

/** Compute affiliate attribution for a new order (no-op when disabled or self-referral). */
export async function affiliateFieldsForOrder(
  product: ProductDoc,
  amountCents: number,
  affiliateRef?: string,
): Promise<AffiliateOrderFields> {
  const ref = affiliateRef?.trim().toLowerCase();
  if (!ref || !product.affiliateEnabled || amountCents <= 0) return {};

  const affiliateUserId = await resolveAffiliateUserId(ref);
  if (affiliateUserId && affiliateUserId === String(product.creatorId)) return {};

  const commissionCents = Math.round((amountCents * product.affiliateCommissionPercent) / 100);
  if (commissionCents <= 0) return { affiliateRef: ref };

  return {
    affiliateRef: ref,
    affiliateUserId: affiliateUserId ? new Types.ObjectId(affiliateUserId) : undefined,
    affiliateCommissionCents: commissionCents,
  };
}

/** Persist commission ledger row after a paid order (idempotent on orderId). */
export async function recordAffiliateCommission(
  order: OrderDoc,
  product: ProductDoc,
): Promise<void> {
  if (!order.affiliateRef || !order.affiliateCommissionCents || order.affiliateCommissionCents <= 0) {
    return;
  }

  try {
    await AffiliateCommissionModel.create({
      creatorId: order.creatorId,
      affiliateUserId: order.affiliateUserId,
      affiliateRef: order.affiliateRef,
      orderId: order._id,
      productId: product._id,
      productTitle: product.title,
      buyerEmail: order.buyerEmail,
      grossCents: order.amountCents,
      commissionPercent: product.affiliateCommissionPercent,
      commissionCents: order.affiliateCommissionCents,
      currency: order.currency,
      status: 'pending',
    });
    recordAudit({
      action: 'affiliate.commission_recorded',
      actorType: 'system',
      creatorId: String(order.creatorId),
      targetType: 'order',
      targetId: order.id,
      metadata: {
        affiliateRef: order.affiliateRef,
        commissionCents: order.affiliateCommissionCents,
      },
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) return;
    logger.warn({ err, orderId: order.id }, 'Failed to record affiliate commission');
  }
}

export async function listAffiliateEarnings(affiliateUserId: string) {
  const rows = await AffiliateCommissionModel.find({ affiliateUserId })
    .sort({ createdAt: -1 })
    .limit(200);
  const pendingCents = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.commissionCents, 0);
  const paidCents = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.commissionCents, 0);
  return {
    summary: { pendingCents, paidCents, totalCents: pendingCents + paidCents, count: rows.length },
    commissions: rows.map((r) => ({
      id: r.id,
      productTitle: r.productTitle,
      grossCents: r.grossCents,
      commissionCents: r.commissionCents,
      commissionPercent: r.commissionPercent,
      currency: r.currency,
      status: r.status,
      buyerEmail: r.buyerEmail,
      createdAt: r.get('createdAt'),
      paidAt: r.paidAt,
    })),
  };
}

export async function listCreatorAffiliateSales(creatorId: string) {
  const rows = await AffiliateCommissionModel.find({ creatorId })
    .sort({ createdAt: -1 })
    .limit(200);
  const pendingCents = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.commissionCents, 0);
  return {
    summary: { pendingCents, count: rows.length },
    commissions: rows.map((r) => ({
      id: r.id,
      affiliateRef: r.affiliateRef,
      productTitle: r.productTitle,
      grossCents: r.grossCents,
      commissionCents: r.commissionCents,
      commissionPercent: r.commissionPercent,
      status: r.status,
      buyerEmail: r.buyerEmail,
      createdAt: r.get('createdAt'),
    })),
  };
}

export async function markAffiliateCommissionPaid(creatorId: string, commissionId: string) {
  const row = await AffiliateCommissionModel.findOne({ _id: commissionId, creatorId });
  if (!row) return null;
  if (row.status === 'paid') return row;
  row.status = 'paid';
  row.paidAt = new Date();
  await row.save();
  return row;
}

/** Products this creator published with affiliate sharing enabled (for link building). */
export async function listAffiliateProducts(creatorId: string) {
  const products = await ProductModel.find({
    creatorId,
    status: 'published',
    affiliateEnabled: true,
  })
    .select('title slug affiliateCommissionPercent')
    .sort({ title: 1 });
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    commissionPercent: p.affiliateCommissionPercent,
  }));
}
