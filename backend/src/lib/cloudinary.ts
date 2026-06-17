import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

if (env.cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface SignedUploadParams {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * Produce a signature for a direct, signed client upload. The client posts the
 * file to Cloudinary with these params; only signed params are honoured, so the
 * folder/options here are enforced. Keeps the API secret server-side.
 */
export function signUpload(params: Record<string, string | number>): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = { ...params, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, env.CLOUDINARY_API_SECRET);
  return { signature, timestamp };
}

/**
 * Build a signed, time-limited delivery URL for a private/authenticated asset
 * (used for paid digital downloads in the commerce phase).
 */
export function signedDeliveryUrl(publicId: string, resourceType = 'raw', expiresInSec = 300): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSec;
  return cloudinary.utils.private_download_url(publicId, '', {
    resource_type: resourceType,
    expires_at: expiresAt,
  });
}

/**
 * Permanently delete an asset from Cloudinary. No-op when Cloudinary isn't
 * configured (dev). Never throws — deletion of the library row should proceed
 * even if the remote delete fails (e.g. asset already gone).
 */
export async function destroyAsset(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<void> {
  if (!env.cloudinaryConfigured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch {
    /* best-effort */
  }
}

export { cloudinary };
