import { z } from 'zod';

const assetSchema = z.object({
  publicId: z.string().min(1),
  resourceType: z.enum(['raw', 'image', 'video']).default('raw'),
  filename: z.string().min(1).max(300),
  bytes: z.number().int().nonnegative().default(0),
  format: z.string().max(20).optional().default(''),
});

export const createProductSchema = z.object({
  type: z.enum(['digital', 'lead_magnet']).default('digital'),
  title: z.string().trim().min(1).max(140),
  shortDescription: z.string().max(300).optional().default(''),
  description: z.string().max(5000).optional().default(''),
  priceCents: z.number().int().min(0).max(100_000_00).default(0),
  currency: z.string().length(3).toLowerCase().default('usd'),
  coverImageUrl: z.string().url().max(1000).optional().or(z.literal('')).default(''),
  coverPublicId: z.string().max(300).optional().default(''),
  assets: z.array(assetSchema).max(20).optional().default([]),
  ctaLabel: z.string().max(40).optional().default(''),
  thankYouMessage: z.string().max(1000).optional().default(''),
  visibility: z.enum(['public', 'unlisted']).optional().default('public'),
});

export const updateProductSchema = createProductSchema.partial().strict();

export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id') });
