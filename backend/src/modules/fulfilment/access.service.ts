import crypto from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hashToken } from '../../lib/tokens';
import { signPortalToken, verifyPortalToken } from '../../lib/jwt';
import { enqueueEmail } from '../../lib/jobs';
import { signedDeliveryUrl } from '../../lib/cloudinary';
import { EntitlementModel, type EntitlementDoc } from '../../models/Entitlement';
import { OrderModel, type OrderDoc } from '../../models/Order';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { CustomerLoginCodeModel } from '../../models/CustomerLoginCode';
import { resolveCreatorBranding } from '../../lib/creatorNotifications';

/**
 * Email-gated buyer access to a digital purchase.
 *
 * The opaque accessToken (emailed to the buyer) identifies WHICH purchase, but
 * is no longer sufficient to open it on its own: the visitor must prove they own
 * the buyer's email by entering a one-time code sent to that address. Verifying
 * mints a short-lived buyer session (a portal JWT scoped to email+creator) that
 * is required to list files and mint signed download URLs. So a forwarded or
 * leaked link cannot be opened by anyone other than the purchaser.
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

type FulfillmentAsset = {
  _id?: unknown;
  publicId: string;
  resourceType: string;
  filename: string;
  bytes: number;
  format?: string;
};

async function loadOrderForEntitlement(entitlement: EntitlementDoc): Promise<OrderDoc | null> {
  if (!entitlement.orderId) return null;
  return OrderModel.findById(entitlement.orderId);
}

async function resolveEntitlement(token: string): Promise<{
  entitlement: EntitlementDoc;
  product: ProductDoc;
  order: OrderDoc | null;
}> {
  const entitlement = await EntitlementModel.findOne({ accessToken: token });
  if (!entitlement || entitlement.revokedAt) throw AppError.notFound('Access not found or revoked');
  const product = await ProductModel.findById(entitlement.productId);
  if (!product) throw AppError.notFound('Product no longer available');
  const order = await loadOrderForEntitlement(entitlement);
  return { entitlement, product, order };
}

function isCustomPending(product: ProductDoc, order: OrderDoc | null): boolean {
  return product.productKind === 'custom' && order?.fulfilmentStatus !== 'fulfilled';
}

function deliveryAssets(product: ProductDoc, order: OrderDoc | null): FulfillmentAsset[] {
  if (product.productKind === 'custom' && order?.fulfilmentStatus === 'fulfilled') {
    return (order.get('fulfillmentAssets') as FulfillmentAsset[]) ?? [];
  }
  return product.assets as FulfillmentAsset[];
}

/** "john@gmail.com" -> "j•••@gmail.com" — a hint without revealing the address. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}

/** Public-safe product info (no delivery destination — that's gated). */
function publicProduct(product: ProductDoc, order: OrderDoc | null) {
  return {
    title: product.title,
    shortDescription: product.shortDescription,
    thankYouMessage: product.thankYouMessage,
    coverImageUrl: product.coverImageUrl,
    deliveryMode: product.deliveryMode,
    productKind: product.productKind,
    fulfilmentNote: product.productKind === 'custom' ? product.fulfilmentNote || '' : '',
    fulfillmentPending: isCustomPending(product, order),
  };
}

/** Full product info, only returned once the buyer is verified. */
function unlockedProduct(product: ProductDoc, order: OrderDoc | null) {
  const customFulfilled = product.productKind === 'custom' && order?.fulfilmentStatus === 'fulfilled';
  const customPending = isCustomPending(product, order);
  return {
    ...publicProduct(product, order),
    allowDownload: customFulfilled ? true : Boolean(product.allowDownload),
    fulfillmentMessage: customFulfilled ? (order?.get('fulfillmentMessage') as string) ?? '' : '',
    redirectUrl: customFulfilled
      ? (order?.get('fulfillmentDeliveryUrl') as string) || ''
      : product.deliveryMode === 'url'
        ? product.redirectUrl || product.accessUrl || ''
        : product.productKind === 'membership'
          ? product.accessUrl || ''
          : '',
    fulfillmentPending: customPending,
  };
}

const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];

/**
 * Whether a fulfilment asset can be shown inline in the browser. Non-previewable
 * files (ZIP, .exe, most raw docs) have nothing to render, so they must ALWAYS be
 * downloadable — preview-only only restricts files that can actually be viewed.
 */
function isPreviewable(asset: { resourceType: string; format?: string; filename?: string }): boolean {
  if (asset.resourceType === 'image' || asset.resourceType === 'video') return true;
  const fmt = (asset.format || '').toLowerCase();
  const name = (asset.filename || '').toLowerCase();
  if (fmt === 'pdf' || name.endsWith('.pdf')) return true;
  if (AUDIO_FORMATS.includes(fmt) || AUDIO_FORMATS.some((f) => name.endsWith('.' + f))) return true;
  return false;
}

function listFiles(product: ProductDoc, order: OrderDoc | null) {
  if (isCustomPending(product, order)) return [];
  return deliveryAssets(product, order).map((a) => ({
    id: String(a._id),
    filename: a.filename,
    bytes: a.bytes,
    format: a.format ?? '',
    resourceType: a.resourceType,
    previewable: isPreviewable(a),
  }));
}

/** Step 1: what the access page shows BEFORE the buyer verifies their email. */
export async function getAccessMeta(token: string) {
  const { entitlement, product, order } = await resolveEntitlement(token);
  const pending = isCustomPending(product, order);
  const assets = deliveryAssets(product, order);
  return {
    product: publicProduct(product, order),
    emailHint: maskEmail(entitlement.buyerEmail),
    fileCount: pending ? 0 : assets.length,
    fulfillmentPending: pending,
  };
}

/**
 * Step 2: email a one-time code — but ONLY if the address matches the buyer on
 * record. The response is identical either way so the endpoint can't be used to
 * discover the purchaser's email from a leaked link.
 */
export async function requestAccessCode(token: string, emailRaw: string) {
  const { entitlement } = await resolveEntitlement(token);
  const email = emailRaw.toLowerCase().trim();
  if (email !== entitlement.buyerEmail) {
    return { sent: true };
  }

  const creatorId = String(entitlement.creatorId);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  await CustomerLoginCodeModel.deleteMany({ creatorId, email });
  await CustomerLoginCodeModel.create({
    creatorId,
    email,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const branding = await resolveCreatorBranding(creatorId).catch(() => ({
    displayName: 'the creator',
    username: '',
    replyTo: undefined as string | undefined,
  }));
  await enqueueEmail(
    email,
    'customer_login_code',
    { code, creatorName: branding.displayName },
    { fromName: branding.displayName, replyTo: branding.replyTo },
  ).catch(() => {});

  // Dev convenience only: surface the code in non-production so the flow is
  // testable without an inbox (mirrors the portal + app email bypass).
  return { sent: true, ...(env.isProd ? {} : { devCode: code }) };
}

/** Step 3: verify the code and mint a buyer session bound to (email, creator). */
export async function verifyAccessCode(token: string, emailRaw: string, codeRaw: string) {
  const { entitlement, product, order } = await resolveEntitlement(token);
  const email = emailRaw.toLowerCase().trim();
  const generic = 'That code is invalid or has expired. Request a new one.';

  // Mismatched email never has a code on file — fail the same as a bad code.
  if (email !== entitlement.buyerEmail) throw AppError.badRequest(generic);

  const creatorId = String(entitlement.creatorId);
  const record = await CustomerLoginCodeModel.findOne({ creatorId, email });
  if (!record || record.expiresAt.getTime() < Date.now()) throw AppError.badRequest(generic);
  if (record.attempts >= MAX_ATTEMPTS) {
    await CustomerLoginCodeModel.deleteOne({ _id: record._id });
    throw AppError.badRequest('Too many attempts. Request a new code.');
  }
  if (record.codeHash !== hashToken(codeRaw.trim())) {
    record.attempts += 1;
    await record.save();
    throw AppError.badRequest('Incorrect code. Please try again.');
  }

  await CustomerLoginCodeModel.deleteMany({ creatorId, email });
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();

  return {
    session: signPortalToken({ sub: email, creatorId }),
    product: unlockedProduct(product, order),
    files: listFiles(product, order),
  };
}

/** Authorize a buyer session against this entitlement's token. */
async function authorize(token: string, authHeader: string | undefined) {
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!bearer) throw AppError.unauthorized('Verify your email to access this purchase');
  let payload;
  try {
    payload = verifyPortalToken(bearer);
  } catch {
    throw AppError.unauthorized('Your session expired — verify your email again.');
  }
  const { entitlement, product, order } = await resolveEntitlement(token);
  if (payload.sub !== entitlement.buyerEmail || payload.creatorId !== String(entitlement.creatorId)) {
    throw AppError.forbidden('This link belongs to a different purchase.');
  }
  return { entitlement, product, order };
}

/** Re-list files for a returning buyer who still holds a valid session. */
export async function getAccessFiles(token: string, authHeader: string | undefined) {
  const { entitlement, product, order } = await authorize(token, authHeader);
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();
  return { product: unlockedProduct(product, order), files: listFiles(product, order) };
}

function findAsset(product: ProductDoc, order: OrderDoc | null, fileId: string): FulfillmentAsset | undefined {
  return deliveryAssets(product, order).find((a) => String(a._id) === fileId);
}

/**
 * Mint a short-lived signed URL to PREVIEW one file inline (verified buyers).
 * Always allowed — previewing is the baseline access for any purchase.
 */
export async function mintPreviewUrl(token: string, authHeader: string | undefined, fileId: string) {
  if (!env.cloudinaryConfigured) {
    throw new AppError(503, 'cloudinary_unconfigured', 'Previews are not configured');
  }
  const { entitlement, product, order } = await authorize(token, authHeader);
  if (isCustomPending(product, order)) throw AppError.badRequest('Your order is still being prepared.');
  const asset = findAsset(product, order, fileId);
  if (!asset) throw AppError.notFound('File not found');

  const url = signedDeliveryUrl(asset.publicId, asset.resourceType, 600);
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();
  return { url };
}

/**
 * Mint a short-lived signed download URL for one file — only when the creator
 * enabled downloads for this product. Otherwise the file is preview-only.
 */
export async function mintDownloadUrl(token: string, authHeader: string | undefined, fileId: string) {
  if (!env.cloudinaryConfigured) {
    throw new AppError(503, 'cloudinary_unconfigured', 'Downloads are not configured');
  }
  const { entitlement, product, order } = await authorize(token, authHeader);
  if (isCustomPending(product, order)) throw AppError.badRequest('Your order is still being prepared.');
  const asset = findAsset(product, order, fileId);
  if (!asset) throw AppError.notFound('File not found');
  const customFulfilled = product.productKind === 'custom' && order?.fulfilmentStatus === 'fulfilled';
  // Preview-only blocks downloads of *previewable* files. Non-previewable files
  // (ZIP, etc.) have no in-browser view, so they're always downloadable.
  if (!customFulfilled && !product.allowDownload && isPreviewable(asset)) {
    throw AppError.forbidden('This file is preview-only — downloads are disabled by the creator.');
  }

  const url = signedDeliveryUrl(asset.publicId, asset.resourceType, 300);
  entitlement.downloadCount += 1;
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();
  return { url };
}
