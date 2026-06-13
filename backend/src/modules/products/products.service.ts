import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { uniqueSlug } from '../../lib/slug';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';

type ProductInput = {
  type?: 'digital' | 'lead_magnet';
  title: string;
  shortDescription?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  coverImageUrl?: string;
  coverPublicId?: string;
  assets?: { publicId: string; resourceType: 'raw' | 'image' | 'video'; filename: string; bytes: number; format?: string }[];
  ctaLabel?: string;
  thankYouMessage?: string;
  visibility?: 'public' | 'unlisted';
};

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
    status: p.status,
    visibility: p.visibility,
    assetCount: p.assets.length,
    salesCount: p.salesCount,
    grossCents: p.grossCents,
    createdAt: p.get('createdAt'),
  };
}

export async function createProduct(creatorId: string, input: ProductInput) {
  const slug = await uniqueSlug(input.title, async (candidate) =>
    Boolean(await ProductModel.exists({ creatorId, slug: candidate })),
  );
  const product = await ProductModel.create({
    creatorId,
    type: input.type ?? 'digital',
    title: input.title,
    slug,
    shortDescription: input.shortDescription ?? '',
    description: input.description ?? '',
    priceCents: input.type === 'lead_magnet' ? 0 : input.priceCents ?? 0,
    currency: input.currency ?? 'usd',
    coverImageUrl: input.coverImageUrl ?? '',
    coverPublicId: input.coverPublicId ?? '',
    assets: input.assets ?? [],
    ctaLabel: input.ctaLabel ?? '',
    thankYouMessage: input.thankYouMessage ?? '',
    visibility: input.visibility ?? 'public',
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
  return { ...publicProduct(product), assets: product.assets, thankYouMessage: product.thankYouMessage };
}

export async function updateProduct(creatorId: string, id: string, patch: Partial<ProductInput>) {
  const product = await ownedProduct(creatorId, id);
  const fields: (keyof ProductInput)[] = [
    'title', 'shortDescription', 'description', 'priceCents', 'currency',
    'coverImageUrl', 'coverPublicId', 'assets', 'ctaLabel', 'thankYouMessage', 'visibility',
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
  // Only require an uploaded deliverable when Cloudinary uploads are actually
  // available — otherwise (dev/demo) the creator has no way to attach one.
  if (
    env.cloudinaryConfigured &&
    product.type === 'digital' &&
    product.priceCents > 0 &&
    product.assets.length === 0
  ) {
    throw AppError.badRequest('Add at least one fulfilment file before publishing');
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
    visibility: source.visibility,
    status: 'draft', // always a draft; counters reset to defaults
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
    priceCents: product.priceCents,
    currency: product.currency,
    coverImageUrl: product.coverImageUrl,
    ctaLabel: product.ctaLabel,
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
