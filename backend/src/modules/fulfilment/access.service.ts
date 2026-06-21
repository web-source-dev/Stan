import crypto from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hashToken } from '../../lib/tokens';
import { signPortalToken, verifyPortalToken } from '../../lib/jwt';
import { enqueueEmail } from '../../lib/jobs';
import { signedDeliveryUrl } from '../../lib/cloudinary';
import { EntitlementModel, type EntitlementDoc } from '../../models/Entitlement';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { CustomerLoginCodeModel } from '../../models/CustomerLoginCode';
import { CreatorProfileModel } from '../../models/CreatorProfile';

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

async function resolveEntitlement(token: string): Promise<{ entitlement: EntitlementDoc; product: ProductDoc }> {
  const entitlement = await EntitlementModel.findOne({ accessToken: token });
  if (!entitlement || entitlement.revokedAt) throw AppError.notFound('Access not found or revoked');
  const product = await ProductModel.findById(entitlement.productId);
  if (!product) throw AppError.notFound('Product no longer available');
  return { entitlement, product };
}

/** "john@gmail.com" -> "j•••@gmail.com" — a hint without revealing the address. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}

/** Public-safe product info (no delivery destination — that's gated). */
function publicProduct(product: ProductDoc) {
  return {
    title: product.title,
    shortDescription: product.shortDescription,
    thankYouMessage: product.thankYouMessage,
    coverImageUrl: product.coverImageUrl,
    deliveryMode: product.deliveryMode,
  };
}

/** Full product info, only returned once the buyer is verified. */
function unlockedProduct(product: ProductDoc) {
  return {
    ...publicProduct(product),
    // Buyers preview by default; downloading is opt-in per product.
    allowDownload: Boolean(product.allowDownload),
    redirectUrl: product.deliveryMode === 'url' ? product.redirectUrl || product.accessUrl || '' : '',
  };
}

function listFiles(product: ProductDoc) {
  return product.assets.map((a) => ({
    id: String(a._id),
    filename: a.filename,
    bytes: a.bytes,
    format: a.format,
    resourceType: a.resourceType,
  }));
}

/** Step 1: what the access page shows BEFORE the buyer verifies their email. */
export async function getAccessMeta(token: string) {
  const { entitlement, product } = await resolveEntitlement(token);
  return {
    product: publicProduct(product),
    emailHint: maskEmail(entitlement.buyerEmail),
    fileCount: product.assets.length,
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

  const profile = await CreatorProfileModel.findOne({ userId: creatorId });
  await enqueueEmail(email, 'customer_login_code', {
    code,
    creatorName: profile?.displayName || profile?.username || 'the creator',
  }).catch(() => {});

  // Dev convenience only: surface the code in non-production so the flow is
  // testable without an inbox (mirrors the portal + app email bypass).
  return { sent: true, ...(env.isProd ? {} : { devCode: code }) };
}

/** Step 3: verify the code and mint a buyer session bound to (email, creator). */
export async function verifyAccessCode(token: string, emailRaw: string, codeRaw: string) {
  const { entitlement, product } = await resolveEntitlement(token);
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
    product: unlockedProduct(product),
    files: listFiles(product),
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
  const { entitlement, product } = await resolveEntitlement(token);
  if (payload.sub !== entitlement.buyerEmail || payload.creatorId !== String(entitlement.creatorId)) {
    throw AppError.forbidden('This link belongs to a different purchase.');
  }
  return { entitlement, product };
}

/** Re-list files for a returning buyer who still holds a valid session. */
export async function getAccessFiles(token: string, authHeader: string | undefined) {
  const { entitlement, product } = await authorize(token, authHeader);
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();
  return { product: unlockedProduct(product), files: listFiles(product) };
}

/**
 * Mint a short-lived signed URL to PREVIEW one file inline (verified buyers).
 * Always allowed — previewing is the baseline access for any purchase.
 */
export async function mintPreviewUrl(token: string, authHeader: string | undefined, fileId: string) {
  if (!env.cloudinaryConfigured) {
    throw new AppError(503, 'cloudinary_unconfigured', 'Previews are not configured');
  }
  const { entitlement, product } = await authorize(token, authHeader);
  const asset = product.assets.find((a) => String(a._id) === fileId);
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
  const { entitlement, product } = await authorize(token, authHeader);
  if (!product.allowDownload) {
    throw AppError.forbidden('This product is preview-only — downloads are disabled by the creator.');
  }
  const asset = product.assets.find((a) => String(a._id) === fileId);
  if (!asset) throw AppError.notFound('File not found');

  const url = signedDeliveryUrl(asset.publicId, asset.resourceType, 300);
  entitlement.downloadCount += 1;
  entitlement.lastAccessedAt = new Date();
  await entitlement.save();
  return { url };
}
