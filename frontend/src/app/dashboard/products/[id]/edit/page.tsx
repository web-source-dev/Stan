'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { ProductEditor, type ProductEditorState } from '@/components/stan/ProductEditor';
import { LinkMediaEditor } from '@/components/stan/LinkMediaEditor';
import { AffiliateLinkEditor } from '@/components/stan/AffiliateLinkEditor';
import { useAuth } from '@/lib/auth-context';
import { affiliateLinkFromApi, type ApiAffiliateLinkProduct } from '@/lib/affiliate-link-types';
import { linkMediaFromApi, type ApiLinkMediaProduct } from '@/lib/link-media-types';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  EMPTY_AFFILIATE,
  EMPTY_ORDER_BUMP,
  EMPTY_PAYMENT_PLAN,
  EMPTY_REVIEWS,
} from '@/lib/product-options';
import type { Product } from '@/lib/types';

type ExtendedProduct = Product & {
  bottomTitle?: string;
  thumbnailButtonLabel?: string;
  thumbnailStyle?: string;
  productKind?: string;
  discountPriceCents?: number;
  deliveryMode?: string;
  redirectUrl?: string;
  billingInterval?: 'one_time' | 'month' | 'year';
  cancelSubscriptionEnabled?: boolean;
  cancelAfterMonths?: number;
  fulfilmentNote?: string;
  accessUrl?: string;
  confirmSubject?: string;
  confirmBody?: string;
  coverPublicId?: string;
  reviewsEnabled?: boolean;
  reviews?: { id: string; author: string; quote: string; rating: number; avatarUrl?: string }[];
  emailFlows?: { id: string; dayOffset: number; subject: string; body: string; enabled: boolean }[];
  orderBumpEnabled?: boolean;
  orderBumpTitle?: string;
  orderBumpDescription?: string;
  orderBumpPriceCents?: number;
  affiliateEnabled?: boolean;
  affiliateCommissionPercent?: number;
  paymentPlanEnabled?: boolean;
  paymentPlanInstallments?: number;
  discountCodes?: { id: string; code: string; type: 'percent' | 'fixed'; value: number }[];
  quantityLimit?: number;
  customFields?: { id: string; label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<ProductEditorState | null>(null);
  const [linkMediaInitial, setLinkMediaInitial] = useState<ReturnType<typeof linkMediaFromApi> | null>(null);
  const [affiliateInitial, setAffiliateInitial] = useState<ReturnType<typeof affiliateLinkFromApi> | null>(null);
  const [isLinkMedia, setIsLinkMedia] = useState(false);
  const [isAffiliateLink, setIsAffiliateLink] = useState(false);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ product: ExtendedProduct }>(`/api/products/${id}`);
    const p = res.product;
    if (p.productKind === 'url_media') {
      setIsLinkMedia(true);
      setIsAffiliateLink(false);
      setLinkMediaInitial(linkMediaFromApi(p as ApiLinkMediaProduct));
      return;
    }
    if (p.productKind === 'stan_affiliate') {
      setIsAffiliateLink(true);
      setIsLinkMedia(false);
      setAffiliateInitial(affiliateLinkFromApi(p as ApiAffiliateLinkProduct));
      return;
    }
    setIsLinkMedia(false);
    setIsAffiliateLink(false);
    setInitial({
      id: p.id,
      title: p.title,
      type: p.type,
      productKind: p.productKind ?? p.type,
      priceDollars: (p.priceCents / 100).toString(),
      discountPriceDollars: p.discountPriceCents ? (p.discountPriceCents / 100).toString() : '',
      discountEnabled: Boolean(p.discountPriceCents),
      thumbnailStyle: (p.thumbnailStyle as ProductEditorState['thumbnailStyle']) ?? 'callout',
      shortDescription: p.shortDescription,
      description: p.description,
      bottomTitle: p.bottomTitle || p.ctaLabel || p.title,
      ctaLabel: p.ctaLabel || (p.type === 'lead_magnet' ? 'Download' : 'PURCHASE'),
      thumbnailButtonLabel: p.thumbnailButtonLabel ?? p.bottomTitle ?? p.ctaLabel ?? '',
      thankYouMessage: p.thankYouMessage ?? '',
      coverImageUrl: p.coverImageUrl,
      coverPublicId: p.coverPublicId ?? '',
      assets: (p.assets ?? []).map((a) => ({
        publicId: a.publicId,
        resourceType: a.resourceType as 'raw',
        filename: a.filename,
        bytes: a.bytes,
        format: '',
      })),
      deliveryMode: (p.deliveryMode as 'file' | 'url') ?? 'file',
      redirectUrl: p.redirectUrl ?? '',
      billingInterval: p.billingInterval ?? 'one_time',
      cancelSubscriptionEnabled: p.cancelSubscriptionEnabled ?? false,
      cancelAfterMonths: p.cancelAfterMonths ? String(p.cancelAfterMonths) : '0',
      fulfilmentNote: p.fulfilmentNote ?? '',
      accessUrl: p.accessUrl ?? '',
      confirmSubject: p.confirmSubject || DEFAULT_CONFIRM_SUBJECT,
      confirmBody: p.confirmBody || DEFAULT_CONFIRM_BODY,
      reviews: {
        enabled: p.reviewsEnabled ?? false,
        items: (p.reviews ?? []).map((r) => ({
          id: r.id,
          author: r.author,
          quote: r.quote,
          rating: r.rating,
          avatarUrl: r.avatarUrl ?? '',
        })),
      },
      emailFlows: (p.emailFlows ?? []).map((s) => ({
        id: s.id,
        dayOffset: s.dayOffset,
        subject: s.subject,
        body: s.body,
        enabled: s.enabled,
      })),
      orderBump: {
        enabled: p.orderBumpEnabled ?? false,
        title: p.orderBumpTitle ?? '',
        description: p.orderBumpDescription ?? '',
        priceCents: p.orderBumpPriceCents ?? 0,
      },
      affiliate: {
        enabled: p.affiliateEnabled ?? false,
        commissionPercent: p.affiliateCommissionPercent ?? EMPTY_AFFILIATE.commissionPercent,
      },
      paymentPlan: {
        enabled: p.paymentPlanEnabled ?? false,
        installments: p.paymentPlanInstallments ?? EMPTY_PAYMENT_PLAN.installments,
      },
      discountCodes: (p.discountCodes ?? []).map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: d.value,
      })),
      quantityLimit: p.quantityLimit ? String(p.quantityLimit) : '',
      customFields: (p.customFields ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
      })),
      showPaymentPlan: Boolean(p.paymentPlanEnabled),
      showDiscountCodes: (p.discountCodes?.length ?? 0) > 0,
      showQuantityLimit: Boolean(p.quantityLimit),
    });
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isAffiliateLink) {
    if (!affiliateInitial) return null;
    return (
      <DashboardShell
        title=""
        hideSubtitle
        maxWidth="max-w-[1280px]"
        breadcrumb={[{ label: 'Products', href: '/dashboard/products' }, { label: 'Edit Stan Affiliate Link' }]}
      >
        <PaymentBanner />
        <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
          <AffiliateLinkEditor initial={affiliateInitial} onSaved={() => router.push('/dashboard/products')} />
        </div>
      </DashboardShell>
    );
  }

  if (isLinkMedia) {
    if (!linkMediaInitial) return null;
    return (
      <DashboardShell
        title=""
        hideSubtitle
        maxWidth="max-w-[1280px]"
        breadcrumb={[{ label: 'Products', href: '/dashboard/products' }, { label: 'Edit URL / Media' }]}
      >
        <PaymentBanner />
        <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
          <LinkMediaEditor initial={linkMediaInitial} onSaved={() => router.push('/dashboard/products')} />
        </div>
      </DashboardShell>
    );
  }

  if (!initial) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'Products', href: '/dashboard/products' }, { label: 'Edit Product' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <ProductEditor initial={initial} onSaved={() => router.push('/dashboard/products')} />
      </div>
    </DashboardShell>
  );
}
