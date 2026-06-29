import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { uniqueSlug } from '../../lib/slug';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';

type ProductAsset = {
  publicId: string;
  resourceType: 'raw' | 'image' | 'video';
  filename: string;
  bytes: number;
  format?: string;
};

type ProductInput = {
  type?: 'digital' | 'lead_magnet';
  title: string;
  shortDescription?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  coverImageUrl?: string;
  coverPublicId?: string;
  assets?: ProductAsset[];
  ctaLabel?: string;
  thankYouMessage?: string;
  productKind?: string;
  thumbnailStyle?: 'button' | 'callout' | 'preview' | 'embed';
  thumbnailButtonLabel?: string;
  bottomTitle?: string;
  discountPriceCents?: number;
  billingInterval?: 'one_time' | 'month' | 'year';
  cancelSubscriptionEnabled?: boolean;
  cancelAfterMonths?: number;
  fulfilmentNote?: string;
  accessUrl?: string;
  deliveryMode?: 'file' | 'url';
  allowDownload?: boolean;
  redirectUrl?: string;
  confirmSubject?: string;
  confirmBody?: string;
  reviewsEnabled?: boolean;
  reviews?: { author: string; quote: string; rating: number; avatarUrl?: string }[];
  emailFlows?: { dayOffset: number; subject: string; body: string; enabled: boolean }[];
  orderBumpEnabled?: boolean;
  orderBumpTitle?: string;
  orderBumpDescription?: string;
  orderBumpPriceCents?: number;
  affiliateEnabled?: boolean;
  affiliateCommissionPercent?: number;
  paymentPlanEnabled?: boolean;
  paymentPlanInstallments?: number;
  discountCodes?: { code: string; type: 'percent' | 'fixed'; value: number }[];
  quantityLimit?: number;
  customFields?: { label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
  visibility?: 'public' | 'unlisted';
};

function mapReviews(p: ProductDoc) {
  return p.reviews.map((r) => ({
    id: String(r._id),
    author: r.author,
    quote: r.quote,
    rating: r.rating,
    avatarUrl: r.avatarUrl ?? '',
  }));
}

function mapEmailFlows(p: ProductDoc) {
  return p.emailFlows.map((s) => ({
    id: String(s._id),
    dayOffset: s.dayOffset,
    subject: s.subject,
    body: s.body,
    enabled: s.enabled,
  }));
}

function mapDiscountCodes(p: ProductDoc) {
  return p.discountCodes.map((d) => ({
    id: String(d._id),
    code: d.code,
    type: d.type as 'percent' | 'fixed',
    value: d.value,
  }));
}

function mapCustomFields(p: ProductDoc) {
  return p.customFields.map((f) => ({
    id: String(f._id),
    label: f.label,
    type: f.type as 'text' | 'textarea' | 'phone',
    required: f.required,
  }));
}

function publicProduct(p: ProductDoc) {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    priceCents: p.priceCents,
    currency: p.currency,
    coverImageUrl: p.coverImageUrl,
    ctaLabel: p.ctaLabel,
    productKind: p.productKind,
    thumbnailStyle: p.thumbnailStyle,
    thumbnailButtonLabel: p.thumbnailButtonLabel,
    bottomTitle: p.bottomTitle,
    discountPriceCents: p.discountPriceCents,
    billingInterval: p.billingInterval,
    cancelSubscriptionEnabled: p.cancelSubscriptionEnabled,
    cancelAfterMonths: p.cancelAfterMonths,
    fulfilmentNote: p.fulfilmentNote,
    accessUrl: p.accessUrl,
    deliveryMode: p.deliveryMode,
    allowDownload: p.allowDownload,
    redirectUrl: p.redirectUrl,
    confirmSubject: p.confirmSubject,
    reviewsEnabled: p.reviewsEnabled,
    reviews: mapReviews(p),
    emailFlows: mapEmailFlows(p),
    orderBumpEnabled: p.orderBumpEnabled,
    orderBumpTitle: p.orderBumpTitle,
    orderBumpDescription: p.orderBumpDescription,
    orderBumpPriceCents: p.orderBumpPriceCents,
    affiliateEnabled: p.affiliateEnabled,
    affiliateCommissionPercent: p.affiliateCommissionPercent,
    paymentPlanEnabled: p.paymentPlanEnabled,
    paymentPlanInstallments: p.paymentPlanInstallments,
    discountCodes: mapDiscountCodes(p),
    quantityLimit: p.quantityLimit,
    customFields: mapCustomFields(p),
    status: p.status,
    visibility: p.visibility,
    assetCount: p.assets.length,
    salesCount: p.salesCount,
    grossCents: p.grossCents,
    createdAt: p.get('createdAt'),
  };
}

const PRODUCT_OPTION_FIELDS: (keyof ProductInput)[] = [
  'reviewsEnabled', 'reviews', 'emailFlows',
  'orderBumpEnabled', 'orderBumpTitle', 'orderBumpDescription', 'orderBumpPriceCents',
  'affiliateEnabled', 'affiliateCommissionPercent',
  'paymentPlanEnabled', 'paymentPlanInstallments',
  'discountCodes', 'quantityLimit', 'customFields',
];

function productCreatePayload(input: ProductInput) {
  return {
    type: input.type ?? 'digital',
    title: input.title,
    shortDescription: input.shortDescription ?? '',
    description: input.description ?? '',
    priceCents: input.type === 'lead_magnet' ? 0 : input.priceCents ?? 0,
    currency: input.currency ?? 'usd',
    coverImageUrl: input.coverImageUrl ?? '',
    coverPublicId: input.coverPublicId ?? '',
    assets: input.assets ?? [],
    ctaLabel: input.ctaLabel ?? '',
    thankYouMessage: input.thankYouMessage ?? '',
    productKind: input.productKind ?? (input.type === 'lead_magnet' ? 'lead_magnet' : 'digital'),
    thumbnailStyle: input.thumbnailStyle ?? 'callout',
    thumbnailButtonLabel: input.thumbnailButtonLabel ?? '',
    bottomTitle: input.bottomTitle ?? '',
    discountPriceCents: input.discountPriceCents ?? 0,
    billingInterval: input.billingInterval ?? 'one_time',
    cancelSubscriptionEnabled: input.cancelSubscriptionEnabled ?? false,
    cancelAfterMonths: input.cancelAfterMonths ?? 0,
    fulfilmentNote: input.fulfilmentNote ?? '',
    accessUrl: input.accessUrl ?? '',
    deliveryMode: input.deliveryMode ?? 'file',
    allowDownload: input.allowDownload ?? false,
    redirectUrl: input.redirectUrl ?? '',
    confirmSubject: input.confirmSubject ?? '',
    confirmBody: input.confirmBody ?? '',
    visibility: input.visibility ?? 'public',
    reviewsEnabled: input.reviewsEnabled ?? false,
    reviews: input.reviews ?? [],
    emailFlows: input.emailFlows ?? [],
    orderBumpEnabled: input.orderBumpEnabled ?? false,
    orderBumpTitle: input.orderBumpTitle ?? '',
    orderBumpDescription: input.orderBumpDescription ?? '',
    orderBumpPriceCents: input.orderBumpPriceCents ?? 0,
    affiliateEnabled: input.affiliateEnabled ?? false,
    affiliateCommissionPercent: input.affiliateCommissionPercent ?? 20,
    paymentPlanEnabled: input.paymentPlanEnabled ?? false,
    paymentPlanInstallments: input.paymentPlanInstallments ?? 3,
    discountCodes: input.discountCodes ?? [],
    quantityLimit: input.quantityLimit ?? 0,
    customFields: input.customFields ?? [],
  };
}

export async function createProduct(creatorId: string, input: ProductInput) {
  const slug = await uniqueSlug(input.title, async (candidate) =>
    Boolean(await ProductModel.exists({ creatorId, slug: candidate })),
  );
  const product = await ProductModel.create({
    creatorId,
    slug,
    ...productCreatePayload(input),
  });
  recordAudit({ action: 'product.created', actorId: creatorId, actorType: 'user', creatorId, targetType: 'product', targetId: product.id });
  return publicProduct(product);
}

export async function listProducts(creatorId: string) {
  const products = await ProductModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return products.map(publicProduct);
}

async function ownedProduct(creatorId: string, id: string): Promise<ProductDoc> {
  const product = await ProductModel.findOne({ _id: id, creatorId });
  if (!product) throw AppError.notFound('Product not found');
  return product;
}

export async function getProduct(creatorId: string, id: string) {
  const product = await ownedProduct(creatorId, id);
  return {
    ...publicProduct(product),
    assets: product.assets,
    thankYouMessage: product.thankYouMessage,
    confirmBody: product.confirmBody,
    coverPublicId: product.coverPublicId,
  };
}

export async function updateProduct(creatorId: string, id: string, patch: Partial<ProductInput>) {
  const product = await ownedProduct(creatorId, id);
  const fields: (keyof ProductInput)[] = [
    'title', 'shortDescription', 'description', 'priceCents', 'currency',
    'coverImageUrl', 'coverPublicId', 'assets', 'ctaLabel', 'thankYouMessage', 'visibility',
    'productKind', 'thumbnailStyle', 'thumbnailButtonLabel', 'bottomTitle', 'discountPriceCents', 'deliveryMode',
    'billingInterval', 'cancelSubscriptionEnabled', 'cancelAfterMonths', 'fulfilmentNote', 'accessUrl',
    'allowDownload', 'redirectUrl', 'confirmSubject', 'confirmBody',
    ...PRODUCT_OPTION_FIELDS,
  ];
  for (const f of fields) {
    if (patch[f] !== undefined) (product as unknown as Record<string, unknown>)[f] = patch[f];
  }
  if (product.type === 'lead_magnet') product.priceCents = 0;
  await product.save();
  recordAudit({ action: 'product.updated', actorId: creatorId, actorType: 'user', creatorId, targetType: 'product', targetId: product.id });
  return getProduct(creatorId, id);
}

export async function publishProduct(creatorId: string, id: string) {
  const product = await ownedProduct(creatorId, id);

  if (product.priceCents > 0 && !(await canAcceptPayments(creatorId))) {
    throw new AppError(
      409,
      'payments_not_ready',
      'Connect a payout account before publishing a paid product',
    );
  }
  if (
    env.cloudinaryConfigured &&
    product.type === 'digital' &&
    product.productKind !== 'custom' &&
    product.productKind !== 'membership' &&
    product.productKind !== 'url_media' &&
    product.productKind !== 'stan_affiliate' &&
    product.priceCents > 0 &&
    product.deliveryMode === 'file' &&
    product.assets.length === 0
  ) {
    throw AppError.badRequest('Add at least one fulfilment file before publishing');
  }
  if (product.productKind === 'url_media' && !product.redirectUrl?.trim()) {
    throw AppError.badRequest('Add a link or embed URL before publishing');
  }
  if (product.productKind === 'stan_affiliate' && !product.redirectUrl?.trim()) {
    throw AppError.badRequest('Your affiliate link is not ready — set up your store username first');
  }
  if (product.productKind === 'membership' && !product.accessUrl?.trim()) {
    throw AppError.badRequest('Add a member access link before publishing your membership');
  }
  if (
    product.productKind === 'membership' &&
    product.billingInterval !== 'month' &&
    product.billingInterval !== 'year'
  ) {
    throw AppError.badRequest('Membership products must bill monthly or yearly');
  }

  product.status = 'published';
  await product.save();
  recordAudit({ action: 'product.published', actorId: creatorId, actorType: 'user', creatorId, targetType: 'product', targetId: product.id });
  return publicProduct(product);
}

export async function duplicateProduct(creatorId: string, id: string) {
  const source = await ownedProduct(creatorId, id);
  const slug = await uniqueSlug(`${source.title}-copy`, async (candidate) =>
    Boolean(await ProductModel.exists({ creatorId, slug: candidate })),
  );
  const copy = await ProductModel.create({
    creatorId,
    type: source.type,
    title: `${source.title} (copy)`,
    slug,
    shortDescription: source.shortDescription,
    description: source.description,
    priceCents: source.priceCents,
    currency: source.currency,
    coverImageUrl: source.coverImageUrl,
    coverPublicId: source.coverPublicId,
    assets: source.assets,
    ctaLabel: source.ctaLabel,
    thankYouMessage: source.thankYouMessage,
    productKind: source.productKind,
    thumbnailStyle: source.thumbnailStyle,
    thumbnailButtonLabel: source.thumbnailButtonLabel,
    bottomTitle: source.bottomTitle,
    discountPriceCents: source.discountPriceCents,
    billingInterval: source.billingInterval,
    cancelSubscriptionEnabled: source.cancelSubscriptionEnabled,
    cancelAfterMonths: source.cancelAfterMonths,
    fulfilmentNote: source.fulfilmentNote,
    accessUrl: source.accessUrl,
    deliveryMode: source.deliveryMode,
    redirectUrl: source.redirectUrl,
    confirmSubject: source.confirmSubject,
    confirmBody: source.confirmBody,
    visibility: source.visibility,
    reviewsEnabled: source.reviewsEnabled,
    reviews: source.reviews,
    emailFlows: source.emailFlows,
    orderBumpEnabled: source.orderBumpEnabled,
    orderBumpTitle: source.orderBumpTitle,
    orderBumpDescription: source.orderBumpDescription,
    orderBumpPriceCents: source.orderBumpPriceCents,
    affiliateEnabled: source.affiliateEnabled,
    affiliateCommissionPercent: source.affiliateCommissionPercent,
    paymentPlanEnabled: source.paymentPlanEnabled,
    paymentPlanInstallments: source.paymentPlanInstallments,
    discountCodes: source.discountCodes,
    quantityLimit: source.quantityLimit,
    customFields: source.customFields,
    status: 'draft',
  });
  recordAudit({ action: 'product.duplicated', actorId: creatorId, actorType: 'user', creatorId, targetType: 'product', targetId: copy.id, metadata: { from: id } });
  return publicProduct(copy);
}

export async function setProductStatus(creatorId: string, id: string, status: 'draft' | 'archived') {
  const product = await ownedProduct(creatorId, id);
  product.status = status;
  await product.save();
  recordAudit({ action: `product.${status}`, actorId: creatorId, actorType: 'user', creatorId, targetType: 'product', targetId: product.id });
  return publicProduct(product);
}

/** Public product lookup for storefront/checkout: by creator username + slug. */
export async function getPublicProductByUsername(username: string, slug: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Product not found');
  const product = await ProductModel.findOne({ creatorId: profile.userId, slug, status: 'published' });
  if (!product) throw AppError.notFound('Product not found');

  const quantityRemaining =
    product.quantityLimit > 0 ? Math.max(0, product.quantityLimit - product.salesCount) : null;

  return {
    id: product.id,
    creatorId: String(product.creatorId),
    username: profile.username,
    creatorName: profile.displayName,
    type: product.type,
    title: product.title,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    bottomTitle: product.bottomTitle,
    priceCents: product.priceCents,
    discountPriceCents: product.discountPriceCents,
    billingInterval: product.billingInterval,
    fulfilmentNote: product.fulfilmentNote,
    accessUrl: product.accessUrl,
    currency: product.currency,
    coverImageUrl: product.coverImageUrl,
    ctaLabel: product.ctaLabel,
    reviewsEnabled: product.reviewsEnabled,
    reviews: product.reviewsEnabled ? mapReviews(product) : [],
    orderBumpEnabled: product.orderBumpEnabled,
    orderBumpTitle: product.orderBumpTitle,
    orderBumpDescription: product.orderBumpDescription,
    orderBumpPriceCents: product.orderBumpPriceCents,
    affiliateEnabled: product.affiliateEnabled,
    affiliateCommissionPercent: product.affiliateCommissionPercent,
    paymentPlanEnabled: product.paymentPlanEnabled,
    paymentPlanInstallments: product.paymentPlanInstallments,
    quantityLimit: product.quantityLimit,
    quantityRemaining,
    salesCount: product.salesCount,
    customFields: mapCustomFields(product),
    hasDiscountCodes: product.discountCodes.length > 0,
  };
}

/** List published, public products for a creator's storefront. */
export async function listPublicProducts(creatorId: string) {
  const products = await ProductModel.find({
    creatorId,
    status: 'published',
    visibility: 'public',
  }).sort({ createdAt: -1 });
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    shortDescription: p.shortDescription,
    priceCents: p.priceCents,
    currency: p.currency,
    coverImageUrl: p.coverImageUrl,
    ctaLabel: p.ctaLabel,
    type: p.type,
  }));
}
