import { z } from 'zod';

const assetSchema = z.object({
  publicId: z.string().min(1),
  resourceType: z.enum(['raw', 'image', 'video']).default('raw'),
  filename: z.string().min(1).max(300),
  bytes: z.number().int().nonnegative().default(0),
  format: z.string().max(20).optional().default(''),
});

const reviewSchema = z.object({
  author: z.string().trim().min(1).max(80),
  quote: z.string().trim().min(1).max(500),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().max(1000).optional().or(z.literal('')).default(''),
});

const emailFlowStepSchema = z.object({
  dayOffset: z.number().int().min(0).max(365),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(5000),
  enabled: z.boolean().default(true),
});

const discountCodeSchema = z.object({
  code: z.string().trim().min(1).max(40).transform((c) => c.toUpperCase()),
  type: z.enum(['percent', 'fixed']).default('percent'),
  value: z.number().int().min(1),
});

const customFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'textarea', 'phone']).default('text'),
  required: z.boolean().default(false),
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
  productKind: z.string().max(40).optional().default('digital'),
  thumbnailStyle: z.enum(['button', 'callout', 'preview', 'embed']).optional().default('callout'),
  thumbnailButtonLabel: z.string().max(80).optional().default(''),
  bottomTitle: z.string().max(140).optional().default(''),
  discountPriceCents: z.number().int().min(0).max(100_000_00).optional().default(0),
  billingInterval: z.enum(['one_time', 'month', 'year']).optional().default('one_time'),
  cancelSubscriptionEnabled: z.boolean().optional().default(false),
  cancelAfterMonths: z.number().int().min(0).max(120).optional().default(0),
  fulfilmentNote: z.string().max(280).optional().default(''),
  accessUrl: z.string().max(1000).optional().or(z.literal('')).default(''),
  deliveryMode: z.enum(['file', 'url']).optional().default('file'),
  redirectUrl: z.string().max(1000).optional().or(z.literal('')).default(''),
  confirmSubject: z.string().max(200).optional().default(''),
  confirmBody: z.string().max(5000).optional().default(''),
  reviewsEnabled: z.boolean().optional().default(false),
  reviews: z.array(reviewSchema).max(20).optional().default([]),
  emailFlows: z.array(emailFlowStepSchema).max(20).optional().default([]),
  orderBumpEnabled: z.boolean().optional().default(false),
  orderBumpTitle: z.string().max(140).optional().default(''),
  orderBumpDescription: z.string().max(500).optional().default(''),
  orderBumpPriceCents: z.number().int().min(0).max(100_000_00).optional().default(0),
  affiliateEnabled: z.boolean().optional().default(false),
  affiliateCommissionPercent: z.number().int().min(1).max(90).optional().default(20),
  paymentPlanEnabled: z.boolean().optional().default(false),
  paymentPlanInstallments: z.number().int().min(2).max(12).optional().default(3),
  discountCodes: z.array(discountCodeSchema).max(20).optional().default([]),
  quantityLimit: z.number().int().min(0).max(1_000_000).optional().default(0),
  customFields: z.array(customFieldSchema).max(15).optional().default([]),
  visibility: z.enum(['public', 'unlisted']).optional().default('public'),
});

export const updateProductSchema = createProductSchema.partial().strict();

export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id') });
