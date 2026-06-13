export interface UploadResult {
  publicId: string;
  url: string;
  resourceType: 'raw' | 'image' | 'video';
  filename: string;
  bytes: number;
  format: string;
}

export type SignKind =
  | 'avatar'
  | 'product_cover'
  | 'product_file'
  | 'course_cover'
  | 'course_video'
  | 'og_image';

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/** Obtains a backend signature for `kind` (auth + refresh handled by caller). */
export type Signer = (kind: SignKind) => Promise<SignResponse>;

/**
 * Upload a file directly to Cloudinary using a backend-signed request. The
 * backend binds the folder to the creator's tenant, so the signature can't be
 * used to write elsewhere. Throws if media isn't configured (signing returns 503).
 */
export async function uploadToCloudinary(
  file: File,
  kind: SignKind,
  sign: Signer,
): Promise<UploadResult> {
  const { cloudName, apiKey, timestamp, signature, folder } = await sign(kind);

  const resourceType = kind === 'product_file' ? 'raw' : kind === 'course_video' ? 'video' : 'image';
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: 'POST', body: form },
  );
  if (!uploadRes.ok) throw new Error('Upload failed');
  const data = await uploadRes.json();
  return {
    publicId: data.public_id,
    url: data.secure_url,
    resourceType: data.resource_type,
    filename: file.name,
    bytes: data.bytes ?? file.size,
    format: data.format ?? '',
  };
}
