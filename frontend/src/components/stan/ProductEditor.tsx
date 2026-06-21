'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconImage,
  IconLock,
  IconMail,
  IconPencil,
  IconSmile,
  IconTrending,
  IconUsers,
  IconX,
} from '@/components/icons';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { usePlan } from '@/lib/use-plan';
import { FeatureLock } from '@/components/FeatureLock';
import { getProductKindMeta, type ProductKind } from '@/lib/product-types';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  EMPTY_AFFILIATE,
  EMPTY_ORDER_BUMP,
  EMPTY_PAYMENT_PLAN,
  EMPTY_REVIEWS,
  PERSONALIZE_TOKENS,
  defaultEmailFlowSteps,
  generateDescriptionFromTitle,
  type ProductAffiliate,
  type ProductCustomField,
  type ProductDiscountCode,
  type ProductEmailFlowStep,
  type ProductOrderBump,
  type ProductPaymentPlan,
  type ProductReview,
  type ProductReviewsConfig,
} from '@/lib/product-options';
import { cn } from '@/lib/cn';

type ProductAsset = { publicId: string; resourceType: 'raw' | 'image' | 'video'; filename: string; bytes: number; format: string };

/** Human-readable file size. */
function fmtAssetBytes(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(n < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
}

/** Shows the actual files attached to a product, each with a remove control. */
function SelectedFiles({ assets, onRemove }: { assets: ProductAsset[]; onRemove: (index: number) => void }) {
  if (assets.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {assets.map((a, i) => (
        <li
          key={(a.publicId || a.filename) + i}
          className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 shadow-xs"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            {a.resourceType === 'image' ? <IconImage size={16} /> : <IconDownload size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[#1a1a2e]" title={a.filename}>
              {a.filename || 'Untitled file'}
            </span>
            <span className="text-xs text-neutral-400">
              {[a.format?.toUpperCase(), fmtAssetBytes(a.bytes)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${a.filename || 'file'}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <IconX size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Toggle controlling whether buyers can download files or only preview them. */
function DownloadToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="mt-3 flex w-full items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left transition hover:border-brand-300"
    >
      <span className={cn('mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', value ? 'bg-brand-600' : 'bg-neutral-300')}>
        <span className={cn('h-4 w-4 rounded-full bg-white shadow-sm transition', value ? 'translate-x-4' : 'translate-x-0')} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#1a1a2e]">Allow buyers to download files</span>
        <span className="block text-xs text-neutral-500">
          {value
            ? 'Buyers can preview and download these files after purchase.'
            : 'Preview-only — buyers can view the files after purchase but not download them.'}
        </span>
      </span>
    </button>
  );
}

export interface ProductEditorState {
  id?: string;
  title: string;
  priceDollars: string;
  discountPriceDollars: string;
  discountEnabled: boolean;
  type: 'digital' | 'lead_magnet';
  productKind: ProductKind | string;
  thumbnailStyle: 'button' | 'callout' | 'preview';
  shortDescription: string;
  description: string;
  bottomTitle: string;
  ctaLabel: string;
  thumbnailButtonLabel: string;
  thankYouMessage: string;
  coverImageUrl: string;
  coverPublicId: string;
  assets: { publicId: string; resourceType: 'raw' | 'image' | 'video'; filename: string; bytes: number; format: string }[];
  deliveryMode: 'file' | 'url';
  allowDownload: boolean;
  redirectUrl: string;
  billingInterval: 'one_time' | 'month' | 'year';
  cancelSubscriptionEnabled: boolean;
  cancelAfterMonths: string;
  fulfilmentNote: string;
  accessUrl: string;
  confirmSubject: string;
  confirmBody: string;
  reviews: ProductReviewsConfig;
  emailFlows: ProductEmailFlowStep[];
  orderBump: ProductOrderBump;
  affiliate: ProductAffiliate;
  paymentPlan: ProductPaymentPlan;
  discountCodes: ProductDiscountCode[];
  quantityLimit: string;
  customFields: ProductCustomField[];
  showPaymentPlan: boolean;
  showDiscountCodes: boolean;
  showQuantityLimit: boolean;
}

type EditorTab = 'thumbnail' | 'checkout' | 'product' | 'options';

function uid() {
  return `_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  return { next, cursor: start + before.length + selected.length + after.length };
}

/** Toggle switch matching the Stan checkout design. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('pe-toggle-track', on ? 'pe-toggle-track--on' : 'pe-toggle-track--off')}
    >
      <span className="pe-toggle-thumb" />
    </button>
  );
}

/** Single-person glyph for the Name collect-info field. */
function IconUserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/** Box/package glyph for the Product tab (lead magnets). */
function IconBoxGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6.5v11L12 22l8-4.5v-11z" />
      <path d="M12 22V12M12 12 4 6.5M12 12l8-4.5" />
    </svg>
  );
}

/** Shopping-cart glyph for the Checkout Page tab. */
function IconCartGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
      <path d="M2.5 3.5h2.2l2.1 10.4a1.4 1.4 0 0 0 1.4 1.1h8a1.4 1.4 0 0 0 1.4-1.1L20.5 7H6" />
    </svg>
  );
}

/** Sliders/adjustments glyph for the Options tab. */
function IconSlidersGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h7M15 8h5M4 16h5M13 16h7" />
      <circle cx="13" cy="8" r="2" />
      <circle cx="11" cy="16" r="2" />
    </svg>
  );
}

/** Orange folder glyph used as the default product thumbnail. */
function IconFolderGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h3.9a1.7 1.7 0 0 1 1.2.5l1.1 1.1h7.4A1.7 1.7 0 0 1 21 8.8v1.2H3z" fill="#f4a259" />
      <path d="M3 9.2h18a1.5 1.5 0 0 1 1.48 1.77l-1.1 6A1.5 1.5 0 0 1 19.9 18.2H4.1a1.5 1.5 0 0 1-1.48-1.23l-1.1-6A1.5 1.5 0 0 1 3 9.2z" fill="#f7b977" />
    </svg>
  );
}

/** Floppy-disk save glyph for the Save As Draft button. */
function IconSaveGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7V3M8 21v-6h8v6" />
    </svg>
  );
}

/** Small preview glyphs for the three thumbnail styles. */
const STYLE_ICON: Record<ProductEditorState['thumbnailStyle'], React.ReactNode> = {
  button: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" />
    </svg>
  ),
  callout: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  ),
  preview: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M10.5 9.2 15 12l-4.5 2.8z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/** Laptop-style placeholder when no checkout hero image is set. */
function CheckoutHeroPlaceholder() {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e8ecf4] via-[#dfe4ee] to-[#d4dae8]">
      <svg width="88" height="56" viewBox="0 0 88 56" fill="none" aria-hidden>
        <rect x="8" y="6" width="72" height="44" rx="4" fill="#c5cdd9" />
        <rect x="12" y="10" width="64" height="36" rx="2" fill="#eef1f6" />
        <rect x="0" y="48" width="88" height="6" rx="2" fill="#b8c0cc" />
      </svg>
    </div>
  );
}

function DescToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button type="button" title={title} onClick={onClick} className="pe-toolbar-btn">
      {children}
    </button>
  );
}
function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="pe-step-badge">{n}</span>
      <span className="pe-step-label">{label}</span>
    </div>
  );
}

function CharField({
  label,
  required,
  value,
  onChange,
  max,
  placeholder,
  multiline,
  rows = 3,
  variant = 'filled',
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  variant?: 'filled' | 'outline';
}) {
  const fieldClass = variant === 'outline' ? 'pe-input-outline' : multiline ? 'pe-textarea resize-y min-h-[88px]' : 'pe-input';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="pe-field-label">
          {label}
          {required && <span className="pe-field-req">*</span>}
        </label>
        <span className="pe-char-count">
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={variant === 'outline' ? 'pe-input-outline resize-y min-h-[88px]' : 'pe-textarea resize-y min-h-[88px]'}
        />
      ) : (
        <input
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </div>
  );
}

const STYLE_LABELS: Record<ProductEditorState['thumbnailStyle'], string> = {
  button: 'Button',
  callout: 'Callout',
  preview: 'Preview',
};

function thumbnailCardButtonLabel(form: ProductEditorState) {
  return form.thumbnailButtonLabel || form.bottomTitle || form.ctaLabel || 'Get My Guide';
}

function ThumbnailPreviewCard({ form }: { form: ProductEditorState }) {
  const price = form.type === 'lead_magnet' ? 'Free' : `$${form.priceDollars || '9.99'}`;
  const btnLabel = thumbnailCardButtonLabel(form);

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Product title'}</div>
        <button type="button" className="pe-preview-cta mt-3">{btnLabel}</button>
      </div>
    );
  }

  if (form.thumbnailStyle === 'preview') {
    return (
      <div className="pe-preview-card pe-preview-card--preview">
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="pe-preview-hero" />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
            <IconFolderGlyph size={36} />
          </div>
        )}
        <div className="pe-preview-body">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</div>
          {form.shortDescription && (
            <p className="mt-1 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>
          )}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
          <button type="button" className="pe-preview-cta mt-3">{btnLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pe-preview-card">
      <div className="flex gap-3">
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover" />
        ) : (
          <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] bg-[#eaf0ff]">
            <IconFolderGlyph size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">
            {form.title || 'Product title'}
          </div>
          {form.shortDescription && (
            <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>
          )}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
        </div>
      </div>
      <button type="button" className="pe-preview-cta">{btnLabel}</button>
    </div>
  );
}

/** Lead-magnet opt-in form preview (Collect Emails / Applications). */
function LeadMagnetPreview({ form }: { form: ProductEditorState }) {
  return (
    <div className="min-h-full bg-[#f7f8fc] p-3">
      <div className="rounded-[14px] bg-white p-4 shadow-[0_8px_32px_-8px_rgba(15,15,25,0.14),0_2px_8px_rgba(15,15,25,0.06)]">
        <div className="flex gap-3">
          {form.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImageUrl} alt="" className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover" />
          ) : (
            <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] bg-[#eaf0ff]">
              <IconFolderGlyph size={28} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold leading-snug text-[#1a1a2e]">
              {form.title || 'Get My FREE Guide Now!'}
            </div>
            {form.shortDescription && (
              <p className="mt-0.5 text-[12px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          <input readOnly placeholder="Enter your name" className="pe-preview-field" />
          <input readOnly placeholder="Enter your email" className="pe-preview-field" />
          {form.customFields.map((f) => (
            <input key={f.id} readOnly placeholder={f.label} className="pe-preview-field" />
          ))}
        </div>
        <button type="button" className="pe-preview-cta mt-4 uppercase tracking-wide">
          {form.ctaLabel || 'SUBMIT & DOWNLOAD'}
        </button>
      </div>
    </div>
  );
}

/** Empty placeholder shown on the Product tab before files are attached. */
function EmptyProductPreview() {
  return (
    <div className="grid min-h-full place-items-center bg-white px-6">
      <div className="flex items-end justify-center gap-4 text-[#d4d4d8]">
        <div className="h-10 w-10 rounded-full bg-current opacity-50" />
        <div className="h-12 w-12 rounded-md bg-current opacity-35" />
        <div
          className="opacity-40"
          style={{
            width: 0,
            height: 0,
            borderLeft: '18px solid transparent',
            borderRight: '18px solid transparent',
            borderBottom: '32px solid currentColor',
          }}
        />
      </div>
    </div>
  );
}

function formatUsPrice(dollars: number) {
  return `US$${dollars.toFixed(2)}`;
}

function recurringIntervalLabel(interval: ProductEditorState['billingInterval']) {
  if (interval === 'month') return 'Month';
  if (interval === 'year') return 'Year';
  return '';
}

function renderDescriptionLine(line: string, key: number) {
  const bullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
  const text = line.replace(/^[\s•\-]+/, '').trim();
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const content =
    parts.length > 1 ? (
      parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-bold text-[#1a1a2e]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )
    ) : (
      text
    );

  if (bullet) {
    return (
      <p key={key} className="flex gap-2 pl-0.5">
        <span className="shrink-0 font-bold text-[#6355fa]">•</span>
        <span>{content}</span>
      </p>
    );
  }
  return (
    <p key={key} className={text.includes('**') ? '' : undefined}>
      {content}
    </p>
  );
}

function CheckoutPreview({
  form,
  showBack,
  showHeroBack,
  showTotal,
  showFormFields = true,
  showPurchaseCta = true,
  bottomTitleAsFooter = false,
}: {
  form: ProductEditorState;
  showBack?: boolean;
  showHeroBack?: boolean;
  showTotal?: boolean;
  showFormFields?: boolean;
  showPurchaseCta?: boolean;
  /** Show bottom title as centered footer text (custom options preview). */
  bottomTitleAsFooter?: boolean;
}) {
  const baseCents =
    form.type === 'lead_magnet'
      ? 0
      : form.discountEnabled && form.discountPriceDollars
        ? Math.round(parseFloat(form.discountPriceDollars) * 100)
        : Math.round(parseFloat(form.priceDollars || '0') * 100);
  const intervalLabel = recurringIntervalLabel(form.billingInterval);
  const priceDisplay =
    form.type === 'lead_magnet'
      ? 'Free'
      : intervalLabel
        ? `${formatUsPrice(baseCents / 100)}/${intervalLabel}`
        : formatUsPrice(baseCents / 100);
  const priceShort = form.type === 'lead_magnet' ? 'Free' : `$${(baseCents / 100).toFixed(2)}`;
  const lines = (form.description || '').split('\n').filter(Boolean);

  return (
    <div className="min-h-full bg-white px-3.5 pb-8 pt-2">
      {showBack && (
        <button type="button" aria-label="Back" className="pe-preview-back">
          <IconArrowLeft size={18} />
        </button>
      )}
      <div className="relative mb-3.5">
        {showHeroBack && (
          <button
            type="button"
            aria-label="Back"
            className="absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#1a1a2e] shadow-sm"
          >
            <IconArrowLeft size={16} />
          </button>
        )}
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ aspectRatio: '16/10' }} />
        ) : (
          <CheckoutHeroPlaceholder />
        )}
      </div>
      <h1 className="text-[16px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</h1>
      <p className="mt-0.5 text-[15px] font-bold text-[#6355fa]">
        {priceShort}
        {intervalLabel && <span className="text-xs font-semibold text-[#8b8d98]"> /{intervalLabel}</span>}
      </p>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#4b5563]">
          {lines.map((line, i) => renderDescriptionLine(line, i))}
        </div>
      )}
      {form.reviews.items.length > 0 && (
        <div className="mt-4 space-y-2">
          {form.reviews.items.slice(0, 2).map((r) => (
            <div key={r.id} className="rounded-xl bg-[#f7f8fc] p-3">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <svg key={n} width="12" height="12" viewBox="0 0 24 24" fill={n <= r.rating ? '#f5b301' : '#e0e1e6'}>
                    <path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.43 1.2 6.77L12 17.27 6.05 20.5l1.2-6.77L2.5 9.3l6.6-1.04z" />
                  </svg>
                ))}
              </div>
              {r.quote && <p className="mt-1.5 text-[11px] leading-snug text-[#4b5563]">{r.quote}</p>}
              <div className="mt-2 flex items-center gap-2">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef0ff] text-[#a9b0e8]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="9" r="4" />
                      <path d="M4 20a8 8 0 0 1 16 0z" />
                    </svg>
                  </span>
                )}
                {r.author && <span className="text-[11px] font-semibold text-[#1a1a2e]">{r.author}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {form.bottomTitle && !bottomTitleAsFooter && (
        <h2 className="mt-5 text-center text-[15px] font-bold text-[#1a1a2e]">{form.bottomTitle}</h2>
      )}
      {showFormFields && (
        <div className="mt-4 space-y-2.5">
          <input readOnly placeholder="Enter your name" className="pe-preview-field" />
          <input readOnly placeholder="Enter your email" className="pe-preview-field" />
          {form.customFields.map((f) => (
            <input key={f.id} readOnly placeholder={f.label} className="pe-preview-field" />
          ))}
        </div>
      )}
      {form.orderBump.enabled && form.orderBump.title && (
        <label className="mt-3 flex gap-2 rounded-xl border border-[#eef0ff] bg-[#f5f4ff] p-2.5 text-xs">
          <input type="checkbox" readOnly className="mt-0.5 accent-[#6355fa]" />
          <span>
            <span className="font-semibold text-[#1a1a2e]">{form.orderBump.title}</span>
            {form.orderBump.priceCents > 0 && (
              <span className="ml-1 font-bold text-[#6355fa]">+${(form.orderBump.priceCents / 100).toFixed(2)}</span>
            )}
          </span>
        </label>
      )}
      {showTotal && form.type !== 'lead_magnet' && (
        <div className="pe-preview-total mt-4">
          <span className="font-semibold text-[#1a1a2e]">Total :</span>
          <span className="pe-preview-total-dots" aria-hidden />
          <span className="font-bold text-[#6355fa]">{priceDisplay}</span>
        </div>
      )}
      {bottomTitleAsFooter && form.bottomTitle && (
        <p className="mt-6 text-center text-[15px] font-bold text-[#1a1a2e]">{form.bottomTitle}</p>
      )}
      {showPurchaseCta && (
        <button type="button" className="pe-preview-cta mt-4 uppercase tracking-wide">
          {form.ctaLabel || 'PURCHASE'}
        </button>
      )}
    </div>
  );
}

function CollectInfoFields({
  form,
  setForm,
  label,
  step,
}: {
  form: ProductEditorState;
  setForm: React.Dispatch<React.SetStateAction<ProductEditorState>>;
  label: string;
  step: number;
}) {
  return (
    <section className="pe-section">
      <Step n={step} label={label} />
      <div className="pe-section-inner">
        <p className="mb-1 pe-field-label">Fields</p>
        <p className="mb-3 text-xs text-[#8b8d98]">Basic info fields can&apos;t be edited</p>
        <div className="space-y-2.5">
          {(['Name', 'Email'] as const).map((f) => (
            <div key={f} className="pe-readonly-field">
              <span className="text-[#a1a1aa]">{f === 'Name' ? <IconUserGlyph /> : <IconMail size={16} />}</span>
              {f}
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-[#e4e5eb] pt-4">
          <p className="pe-link-muted">Collect additional customer info</p>
          <div className="mt-2 space-y-2">
            {form.customFields.map((field) => (
              <div key={field.id} className="pe-custom-row">
                <input
                  value={field.label}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.map((x) =>
                        x.id === field.id ? { ...x, label: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="Field label"
                  className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.map((x) =>
                        x.id === field.id
                          ? { ...x, type: e.target.value as ProductCustomField['type'] }
                          : x,
                      ),
                    }))
                  }
                  className="rounded-lg border border-[#e4e5eb] px-2 py-1 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="phone">Phone</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customFields: f.customFields.map((x) =>
                          x.id === field.id ? { ...x, required: e.target.checked } : x,
                        ),
                      }))
                    }
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.filter((x) => x.id !== field.id),
                    }))
                  }
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                customFields: [
                  ...f.customFields,
                  { id: uid(), label: 'Custom field', type: 'text', required: false },
                ],
              }))
            }
            className="pe-btn-outline mt-2"
          >
            + Add Field
          </button>
        </div>
      </div>
    </section>
  );
}

function AccordionPanel({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="pe-accordion">
      <button type="button" onClick={onToggle} className="pe-accordion-head">
        <span className="pe-accordion-icon">{icon}</span>
        <span className="pe-accordion-title">{title}</span>
        <IconChevronDown size={18} className={cn('text-[#a1a1aa] transition', !open && 'rotate-180')} />
      </button>
      {open && children && <div className="border-t border-[#e4e5eb] px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

export function ProductEditor({
  initial,
  onSaved,
  initialTab,
}: {
  initial: ProductEditorState;
  onSaved: (id: string) => void;
  initialTab?: EditorTab;
}) {
  const { authedRequest } = useAuth();
  const meta = getProductKindMeta(initial.productKind);
  const resolvedInitialTab =
    initialTab === 'checkout' && meta.editorMiddleTab === 'product'
      ? 'product'
      : initialTab ?? 'thumbnail';
  const normalizedInitial = {
    ...initial,
    thumbnailStyle: meta.thumbnailStyles.includes(initial.thumbnailStyle)
      ? initial.thumbnailStyle
      : meta.thumbnailStyles[0] ?? 'callout',
  };
  const [form, setForm] = useState<ProductEditorState>(normalizedInitial);
  const [tab, setTab] = useState<EditorTab>(resolvedInitialTab);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);
  const { features } = usePlan();
  // Plan-driven feature locks. While the plan is still loading (features null) we
  // optimistically allow, so paying users never see a flash of locked controls.
  const pricingToolsAllowed = features ? features.pricingTools : true;
  const orderBumpsAllowed = features ? features.orderBumps : true;
  const customFieldsAllowed = features ? features.customFields : true;
  const affiliateAllowed = features ? features.affiliate : true;
  const emailFlowsAllowed = features ? features.email : true;
  const [savedNote, setSavedNote] = useState('');
  const [storeHandle, setStoreHandle] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);
  const [confirmRef, setConfirmRef] = useState<HTMLTextAreaElement | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [dragReviewId, setDragReviewId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authedRequest<{ profile: { username?: string } | null }>('/api/creator/profile')
      .then((r) => {
        if (active && r.profile?.username) setStoreHandle(r.profile.username);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authedRequest]);

  function copyStoreUrl() {
    const url = `stan.store/${storeHandle}`;
    void navigator.clipboard?.writeText(`https://${url}`).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 1800);
    });
  }

  function insertConfirmToken(token: string) {
    const ta = confirmRef;
    const cur = form.confirmBody;
    if (!ta) {
      patch('confirmBody', `${cur}${token}`);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = cur.slice(0, start) + token + cur.slice(end);
    patch('confirmBody', next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function wrapConfirm(before: string, after = before) {
    if (!confirmRef) return;
    const { next, cursor } = wrapSelection(confirmRef, before, after);
    patch('confirmBody', next);
    requestAnimationFrame(() => {
      confirmRef.focus();
      confirmRef.setSelectionRange(cursor, cursor);
    });
  }

  const { open: openMediaLibrary } = useMediaLibrary();

  // Open the media library to pick (or upload) the product thumbnail.
  function pickCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'product_cover',
      title: 'Select a thumbnail',
      onSelect: (m) => {
        setForm((f) => ({ ...f, coverImageUrl: m.url, coverPublicId: m.publicId }));
        setUploadNote('');
      },
    });
  }

  // Open the media library to pick (or upload) a fulfilment file.
  function pickFile() {
    openMediaLibrary({
      accept: 'file',
      kind: 'product_file',
      title: 'Select a file',
      onSelect: (m) => {
        setForm((f) => ({
          ...f,
          assets: [
            ...f.assets,
            { publicId: m.publicId, resourceType: 'raw', filename: m.filename, bytes: m.bytes, format: m.format },
          ],
        }));
        setUploadNote('');
      },
    });
  }

  // Remove one attached fulfilment file from the product.
  function removeAsset(index: number) {
    setForm((f) => ({ ...f, assets: f.assets.filter((_, i) => i !== index) }));
  }

  function patch<K extends keyof ProductEditorState>(key: K, value: ProductEditorState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickReviewAvatar(reviewId: string) {
    openMediaLibrary({
      accept: 'image',
      kind: 'product_cover',
      title: 'Select an avatar',
      onSelect: (m) => {
        setForm((f) => ({
          ...f,
          reviews: {
            ...f.reviews,
            items: f.reviews.items.map((x) => (x.id === reviewId ? { ...x, avatarUrl: m.url } : x)),
          },
        }));
        setUploadNote('');
      },
    });
  }

  function reorderReviews(fromId: string, toId: string) {
    if (fromId === toId) return;
    setForm((f) => {
      const items = [...f.reviews.items];
      const from = items.findIndex((x) => x.id === fromId);
      const to = items.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return f;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...f, reviews: { ...f.reviews, items } };
    });
  }

  async function save(publish: boolean) {
    setError('');
    setBusy(true);
    const priceCents = form.type === 'lead_magnet' ? 0 : Math.round(parseFloat(form.priceDollars || '0') * 100);
    const discountPriceCents =
      form.discountEnabled && form.discountPriceDollars
        ? Math.round(parseFloat(form.discountPriceDollars) * 100)
        : 0;
    const body = {
      type: form.type,
      productKind: form.productKind,
      title: form.title,
      priceCents,
      discountPriceCents,
      shortDescription: form.shortDescription,
      description: form.description || form.shortDescription,
      bottomTitle: form.bottomTitle,
      ctaLabel: form.ctaLabel,
      thankYouMessage: form.thankYouMessage,
      coverImageUrl: form.coverImageUrl,
      coverPublicId: form.coverPublicId,
      thumbnailStyle: form.thumbnailStyle,
      thumbnailButtonLabel: form.thumbnailButtonLabel,
      deliveryMode: form.deliveryMode,
      allowDownload: form.allowDownload,
      redirectUrl: form.redirectUrl,
      billingInterval: form.billingInterval,
      cancelSubscriptionEnabled: form.cancelSubscriptionEnabled,
      cancelAfterMonths: parseInt(form.cancelAfterMonths || '0', 10) || 0,
      fulfilmentNote: form.fulfilmentNote,
      accessUrl: form.accessUrl,
      confirmSubject: form.confirmSubject,
      confirmBody: form.confirmBody,
      assets: form.assets,
      reviewsEnabled: form.reviews.enabled || form.reviews.items.length > 0,
      reviews: form.reviews.items.map(({ author, quote, rating, avatarUrl }) => ({
        author,
        quote,
        rating,
        avatarUrl: avatarUrl ?? '',
      })),
      emailFlows: form.emailFlows.map(({ dayOffset, subject, body: stepBody, enabled }) => ({
        dayOffset,
        subject,
        body: stepBody,
        enabled,
      })),
      orderBumpEnabled: form.orderBump.enabled,
      orderBumpTitle: form.orderBump.title,
      orderBumpDescription: form.orderBump.description,
      orderBumpPriceCents: form.orderBump.priceCents,
      affiliateEnabled: form.affiliate.enabled,
      affiliateCommissionPercent: form.affiliate.commissionPercent,
      paymentPlanEnabled: form.paymentPlan.enabled,
      paymentPlanInstallments: form.paymentPlan.installments,
      discountCodes: form.discountCodes.map(({ code, type, value }) => ({ code, type, value })),
      quantityLimit: parseInt(form.quantityLimit || '0', 10) || 0,
      customFields: form.customFields.map(({ label, type, required }) => ({ label, type, required })),
    };
    try {
      let id = form.id;
      if (id) {
        await authedRequest(`/api/products/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ product: { id: string } }>('/api/products', { method: 'POST', body });
        id = res.product.id;
        setForm((f) => ({ ...f, id }));
      }
      if (publish && id) {
        await authedRequest(`/api/products/${id}/publish`, { method: 'POST' });
        onSaved(id!);
      } else {
        setSavedNote('Draft saved');
        setTimeout(() => setSavedNote(''), 3000);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save product');
    } finally {
      setBusy(false);
    }
  }

  function nextTab() {
    const order: EditorTab[] = ['thumbnail', meta.editorMiddleTab, 'options'];
    const i = order.indexOf(tab);
    if (i >= 0 && i < order.length - 1) setTab(order[i + 1]!);
  }

  const middleTabIcon =
    meta.editorMiddleTab === 'product' ? <IconBoxGlyph size={16} /> : <IconCartGlyph size={16} />;

  const tabs: { value: EditorTab; label: string; icon: React.ReactNode }[] = [
    { value: 'thumbnail', label: 'Thumbnail', icon: <IconImage size={16} /> },
    { value: meta.editorMiddleTab, label: meta.editorMiddleTabLabel, icon: middleTabIcon },
    { value: 'options', label: 'Options', icon: <IconSlidersGlyph size={16} /> },
  ];

  const buttonFieldValue =
    meta.thumbnailButtonField === 'ctaLabel'
      ? form.ctaLabel
      : meta.thumbnailButtonField === 'thumbnailButtonLabel'
        ? form.thumbnailButtonLabel
        : form.bottomTitle;

  function patchButtonField(v: string) {
    if (meta.thumbnailButtonField === 'ctaLabel') {
      patch('ctaLabel', v);
      patch('bottomTitle', v);
    } else if (meta.thumbnailButtonField === 'thumbnailButtonLabel') {
      patch('thumbnailButtonLabel', v);
    } else {
      patch('bottomTitle', v);
    }
  }

  const isLeadMagnet = form.type === 'lead_magnet' || form.productKind === 'lead_magnet';
  const showLeadMagnetPreview = isLeadMagnet && tab !== 'product';
  const showEmptyProductPreview = tab === 'product' && meta.editorMiddleTab === 'product';
  const showThumbnailCardPreview = tab === 'thumbnail' && !isLeadMagnet;
  const checkoutPreviewFull =
    meta.showPaidCheckoutPreview && (tab === 'checkout' || (tab === 'options' && !meta.optionsPreviewMinimal));
  const optionsPreviewMinimal = Boolean(meta.optionsPreviewMinimal && tab === 'options');
  const optionsPreviewPartial = Boolean(meta.optionsPreviewPartial && tab === 'options');
  const lockedPriceFeatures =
    meta.lockedPriceFeatures ?? ['Add Payment Plan', 'Add Discount Code', 'Limit Quantity'];

  return (
    <div className={cn('product-editor', tab === 'options' && 'product-editor--options')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/storefront" className="inline-flex items-center gap-1.5 font-medium text-[#8b8d98] transition hover:text-[#1a1a2e]">
            <IconArrowLeft size={16} /> My Store
          </Link>
          <span className="text-[#c7c9d1]">/</span>
          <span className="font-semibold text-[#1a1a2e]">{form.id ? 'Edit Product' : 'Add New Product'}</span>
        </div>
      </div>
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          <div className="mb-8 flex flex-wrap gap-2">
            {tabs.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={cn('pe-tab', active && 'pe-tab--active')}
                >
                  <span className="pe-tab-icon">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {error && <Alert kind="error" className="mb-4">{error}</Alert>}
          {savedNote && <Alert kind="success" className="mb-4">{savedNote}</Alert>}
          {uploadNote && <Alert kind="info" className="mb-4">{uploadNote}</Alert>}

        {/* ---- Thumbnail tab ---- */}
        {tab === 'thumbnail' && (
          <div>
            {meta.showThumbnailStylePicker && (
              <section className="pe-section">
                <Step n={1} label="Pick a style" />
                <div className="pe-section-inner flex flex-wrap gap-3">
                  {meta.thumbnailStyles.map((style) => {
                    const sel = form.thumbnailStyle === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => patch('thumbnailStyle', style)}
                        className={cn('pe-style-card', sel && 'pe-style-card--active')}
                      >
                        <div className="pe-style-card-icon">{STYLE_ICON[style]}</div>
                        <div className="pe-style-card-label">{STYLE_LABELS[style]}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="pe-section">
              <Step n={meta.showThumbnailStylePicker ? 2 : 1} label="Select image" />
              <div className="pe-section-inner pe-upload-row">
                <div className="relative shrink-0">
                  {form.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImageUrl} alt="" className="h-[72px] w-[72px] rounded-[10px] object-cover" />
                  ) : (
                    <div className="grid h-[72px] w-[72px] place-items-center rounded-[10px] bg-[#eaf0ff]">
                      <IconFolderGlyph size={36} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={pickCover}
                    aria-label="Choose image"
                    className="absolute -right-1.5 -top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[#6355fa] text-white shadow-md transition hover:bg-[#5648e8]"
                  >
                    <IconPencil size={12} />
                  </button>
                </div>
                <div className="flex min-w-[140px] flex-1 flex-col items-center justify-center py-1 text-center">
                  <p className="text-sm font-medium text-[#3d3d4a]">Thumbnail</p>
                  <p className="text-xs text-[#8b8d98]">400×400</p>
                  <button type="button" onClick={pickCover} className="pe-btn-outline mt-2.5 cursor-pointer">
                    Choose Image
                  </button>
                </div>
              </div>
            </section>

            <section className="pe-section">
              <Step n={meta.showThumbnailStylePicker ? 3 : 2} label="Add text" />
              <div className="pe-section-inner space-y-4">
                <CharField label="Title" value={form.title} onChange={(v) => patch('title', v)} max={50} />
                <CharField label="Subtitle" value={form.shortDescription} onChange={(v) => patch('shortDescription', v)} max={100} />
                <CharField label="Button" required value={buttonFieldValue} onChange={patchButtonField} max={30} />
              </div>
            </section>

            {meta.collectInfoOnThumbnail && (
              <FeatureLock locked={!customFieldsAllowed} label="Custom checkout fields are a Pro feature">
                <CollectInfoFields form={form} setForm={setForm} label={meta.collectInfoLabel} step={3} />
              </FeatureLock>
            )}
          </div>
        )}

        {/* ---- Product tab (lead magnets) ---- */}
        {tab === 'product' && meta.editorMiddleTab === 'product' && (
          <div>
            <section className="pe-section">
              <div className="pe-delivery-head">
                <h3 className="text-sm font-semibold text-[#1a1a2e]">{meta.productTabTitle ?? 'Upload Attachment & Files'}</h3>
                <div className="pe-segment">
                  <button
                    type="button"
                    onClick={() => patch('deliveryMode', 'file')}
                    className={cn('pe-segment-btn', form.deliveryMode === 'file' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => patch('deliveryMode', 'url')}
                    className={cn('pe-segment-btn', form.deliveryMode === 'url' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                  >
                    Redirect to URL
                  </button>
                </div>
              </div>
              <div className="pe-section-inner">
                {form.deliveryMode === 'file' ? (
                  <div className="mt-2 w-full">
                    <button type="button" onClick={pickFile} className="pe-file-drop pe-file-drop--product w-full">
                      <span className="text-sm font-medium text-[#6b7280]">Choose or Upload File(s)</span>
                      <span className="pe-btn-outline">Browse library</span>
                      {form.assets.length > 0 && (
                        <span className="text-xs font-medium text-emerald-600">
                          {form.assets.length} file{form.assets.length === 1 ? '' : 's'} attached · add more
                        </span>
                      )}
                    </button>
                    <SelectedFiles assets={form.assets} onRemove={removeAsset} />
                    {form.assets.length > 0 && (
                      <DownloadToggle value={form.allowDownload} onChange={(v) => patch('allowDownload', v)} />
                    )}
                  </div>
                ) : (
                  <input
                    className="pe-input-outline mt-2"
                    placeholder="https://"
                    value={form.redirectUrl}
                    onChange={(e) => patch('redirectUrl', e.target.value)}
                  />
                )}
              </div>
            </section>
          </div>
        )}

        {/* ---- Checkout tab (paid products) ---- */}
        {tab === 'checkout' && meta.editorMiddleTab === 'checkout' && (
          <div>
            <section className="pe-section">
              <Step n={1} label="Select Image" />
              <div className="pe-section-inner pe-upload-row">
                <div className="relative shrink-0">
                  {form.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImageUrl} alt="" className="h-[88px] w-[130px] rounded-[10px] object-cover" />
                  ) : (
                    <div className="flex h-[88px] w-[130px] items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
                      <svg width="48" height="32" viewBox="0 0 88 56" fill="none" aria-hidden>
                        <rect x="8" y="6" width="72" height="44" rx="4" fill="#c5cdd9" />
                        <rect x="12" y="10" width="64" height="36" rx="2" fill="#eef1f6" />
                        <rect x="0" y="48" width="88" height="6" rx="2" fill="#b8c0cc" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={pickCover}
                    aria-label="Choose image"
                    className="absolute -right-1.5 -top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[#6355fa] text-white shadow-md"
                  >
                    <IconPencil size={12} />
                  </button>
                </div>
                <div className="pe-upload-drop">
                  <p className="text-sm font-medium text-[#3d3d4a]">Drag Your Image Here</p>
                  <p className="mt-1 text-xs text-[#8b8d98]">1920 × 1080 recommended</p>
                  <button type="button" onClick={pickCover} className="pe-btn-outline mt-3 cursor-pointer">
                    Choose Image
                  </button>
                </div>
              </div>
            </section>

            <section className="pe-section">
              <Step n={2} label="Write Description" />
              <div className="pe-section-inner space-y-4">
                <CharField label="Title" required value={form.title} onChange={(v) => patch('title', v)} max={140} />
                <div>
                  <label className="mb-1.5 block pe-field-label">Description Body<span className="pe-field-req">*</span></label>
                  <div className="pe-desc-box">
                    <div className="pe-toolbar">
                      {[
                        { label: 'B', wrap: '**', title: 'Bold' },
                        { label: 'I', wrap: '_', title: 'Italic' },
                        { label: 'S', wrap: '~~', title: 'Strikethrough' },
                      ].map(({ label, wrap, title }) => (
                        <DescToolbarBtn
                          key={label}
                          title={title}
                          onClick={() => {
                            if (!descRef) return;
                            const { next, cursor } = wrapSelection(descRef, wrap);
                            patch('description', next);
                            requestAnimationFrame(() => {
                              descRef.focus();
                              descRef.setSelectionRange(cursor, cursor);
                            });
                          }}
                        >
                          <span className="text-xs font-bold">{label}</span>
                        </DescToolbarBtn>
                      ))}
                      <span className="mx-0.5 h-4 w-px bg-[#e4e5eb]" />
                      <DescToolbarBtn title="Bullet list" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}• `)}>
                        <span className="text-sm leading-none">≡</span>
                      </DescToolbarBtn>
                      <DescToolbarBtn title="Numbered list" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}1. `)}>
                        <span className="text-[10px] font-bold">1.</span>
                      </DescToolbarBtn>
                      <DescToolbarBtn title="Insert image" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}[image url]`)}>
                        <IconImage size={14} />
                      </DescToolbarBtn>
                      <DescToolbarBtn title="Insert video" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}[video url]`)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>
                      </DescToolbarBtn>
                      <DescToolbarBtn title="Insert link" onClick={() => {
                        if (!descRef) return;
                        const { next, cursor } = wrapSelection(descRef, '[', '](url)');
                        patch('description', next);
                        requestAnimationFrame(() => { descRef.focus(); descRef.setSelectionRange(cursor, cursor); });
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                      </DescToolbarBtn>
                      <button
                        type="button"
                        onClick={() => patch('description', generateDescriptionFromTitle(form.title, form.productKind))}
                        className="pe-toolbar-ai inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white"
                      >
                        ✨ Generate with AI
                      </button>
                    </div>
                    <textarea
                      ref={setDescRef}
                      rows={8}
                      value={form.description}
                      onChange={(e) => patch('description', e.target.value)}
                      className="pe-desc-area"
                      placeholder="Describe your product..."
                    />
                  </div>
                </div>
                <CharField label="Bottom Title" required value={form.bottomTitle} onChange={(v) => patch('bottomTitle', v)} max={80} variant="outline" />
                <CharField label="Call-to-Action Button" required value={form.ctaLabel} onChange={(v) => patch('ctaLabel', v)} max={30} variant="outline" />
              </div>
            </section>

            {meta.showPrice && (
              <section className="pe-section">
                <Step n={3} label="Set price" />
                <div className="pe-section-inner space-y-4">
                  <div className={cn('grid gap-5', meta.showDiscount && 'sm:grid-cols-2')}>
                    <div>
                      <label className="mb-1.5 block pe-field-label">
                        {meta.priceLabel}<span className="pe-field-req">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          value={form.priceDollars}
                          onChange={(e) => patch('priceDollars', e.target.value)}
                          placeholder="0.00"
                          inputMode="decimal"
                          className="pe-input-outline"
                        />
                        {meta.recurring && !meta.membershipScheduling && (
                          <select
                            value={form.billingInterval === 'one_time' ? 'month' : form.billingInterval}
                            onChange={(e) => patch('billingInterval', e.target.value as ProductEditorState['billingInterval'])}
                            className="shrink-0 rounded-lg border border-[#e4e5eb] bg-white px-3 py-2.5 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa] focus:ring-2 focus:ring-[#6355fa]/15"
                          >
                            <option value="month">/ month</option>
                            <option value="year">/ year</option>
                          </select>
                        )}
                      </div>
                    </div>
                    {meta.showDiscount && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <label className="pe-field-label">Discount Price($)</label>
                          <Toggle on={form.discountEnabled} onChange={(v) => patch('discountEnabled', v)} />
                        </div>
                        <input
                          disabled={!form.discountEnabled}
                          value={form.discountPriceDollars}
                          onChange={(e) => patch('discountPriceDollars', e.target.value)}
                          inputMode="decimal"
                          className="pe-input"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                  {meta.membershipScheduling && (
                    <div className="pe-subpanel space-y-4">
                      <p className="text-sm font-semibold text-[#1a1a2e]">Scheduling</p>
                      <div>
                        <label className="mb-1.5 block pe-field-label">
                          Recurring<span className="pe-field-req">*</span>
                        </label>
                        <select
                          value={form.billingInterval === 'one_time' ? 'month' : form.billingInterval}
                          onChange={(e) => patch('billingInterval', e.target.value as ProductEditorState['billingInterval'])}
                          className="w-full rounded-lg border border-[#e4e5eb] bg-white px-3 py-2.5 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa] focus:ring-2 focus:ring-[#6355fa]/15"
                        >
                          <option value="month">Monthly</option>
                          <option value="year">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <label className="pe-field-label">Cancel subscription after</label>
                          <Toggle
                            on={form.cancelSubscriptionEnabled}
                            onChange={(v) => patch('cancelSubscriptionEnabled', v)}
                          />
                        </div>
                        <select
                          disabled={!form.cancelSubscriptionEnabled}
                          value={form.cancelSubscriptionEnabled ? form.cancelAfterMonths || '1' : '0'}
                          onChange={(e) => patch('cancelAfterMonths', e.target.value)}
                          className="w-full rounded-lg border border-[#e4e5eb] bg-white px-3 py-2.5 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa] focus:ring-2 focus:ring-[#6355fa]/15 disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]"
                        >
                          {!form.cancelSubscriptionEnabled && (
                            <option value="0">N/A (ongoing payments)</option>
                          )}
                          {form.cancelSubscriptionEnabled &&
                            [1, 2, 3, 6, 12, 24].map((m) => (
                              <option key={m} value={String(m)}>
                                {m} {m === 1 ? 'month' : 'months'}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {!pricingToolsAllowed && (
                    <div className="pe-locked-box">
                      <div className="pe-locked-blur space-y-3">
                        {lockedPriceFeatures.map((l) => (
                          <div key={l} className="flex items-center gap-3 text-sm text-[#6b7280]">
                            <IconLock size={14} className="shrink-0 text-[#9ca3af]" />
                            {l}
                          </div>
                        ))}
                      </div>
                      <div className="pe-locked-overlay">
                        <Link href="/dashboard/settings?tab=billing" className="pe-btn-outline">
                          <IconLock size={15} /> Upgrade to Unlock
                        </Link>
                      </div>
                    </div>
                  )}
                  {pricingToolsAllowed && (
                  <>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!meta.membershipScheduling && (
                    <button
                      type="button"
                      onClick={() => patch('showPaymentPlan', !form.showPaymentPlan)}
                      className={cn('pe-tag-btn', form.paymentPlan.enabled ? 'pe-tag-btn--on' : 'pe-tag-btn--off')}
                    >
                      {form.paymentPlan.enabled ? '✓ Payment Plan' : 'Add Payment Plan'}
                    </button>
                    )}
                    <button
                      type="button"
                      onClick={() => patch('showDiscountCodes', !form.showDiscountCodes)}
                      className={cn('pe-tag-btn', form.discountCodes.length > 0 ? 'pe-tag-btn--on' : 'pe-tag-btn--off')}
                    >
                      {form.discountCodes.length > 0 ? '✓ Discount Codes' : 'Add Discount Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => patch('showQuantityLimit', !form.showQuantityLimit)}
                      className={cn('pe-tag-btn', form.quantityLimit ? 'pe-tag-btn--on' : 'pe-tag-btn--off')}
                    >
                      {form.quantityLimit ? '✓ Quantity Limit' : 'Limit Quantity'}
                    </button>
                  </div>
                  {(form.showPaymentPlan || form.paymentPlan.enabled) && (
                    <div className="pe-subpanel space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                        <input
                          type="checkbox"
                          checked={form.paymentPlan.enabled}
                          onChange={(e) =>
                            patch('paymentPlan', { ...form.paymentPlan, enabled: e.target.checked })
                          }
                          className="rounded border-[#e4e5eb] accent-[#6355fa]"
                        />
                        Enable payment plan
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#6b7280]">Installments</span>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={form.paymentPlan.installments}
                          onChange={(e) =>
                            patch('paymentPlan', {
                              ...form.paymentPlan,
                              installments: Math.min(12, Math.max(2, parseInt(e.target.value || '3', 10))),
                            })
                          }
                          className="w-20 rounded-lg border border-[#e4e5eb] px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                  {(form.showDiscountCodes || form.discountCodes.length > 0) && (
                    <div className="pe-subpanel space-y-2">
                      {form.discountCodes.map((dc) => (
                        <div key={dc.id} className="flex flex-wrap items-end gap-2">
                          <input
                            value={dc.code}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                discountCodes: f.discountCodes.map((x) =>
                                  x.id === dc.id ? { ...x, code: e.target.value.toUpperCase() } : x,
                                ),
                              }))
                            }
                            placeholder="CODE"
                            className="w-24 rounded-lg border border-[#e4e5eb] px-2 py-1.5 text-sm font-mono uppercase"
                          />
                          <select
                            value={dc.type}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                discountCodes: f.discountCodes.map((x) =>
                                  x.id === dc.id ? { ...x, type: e.target.value as 'percent' | 'fixed' } : x,
                                ),
                              }))
                            }
                            className="rounded-lg border border-[#e4e5eb] px-2 py-1.5 text-sm"
                          >
                            <option value="percent">%</option>
                            <option value="fixed">$</option>
                          </select>
                          <input
                            type="number"
                            value={dc.value}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                discountCodes: f.discountCodes.map((x) =>
                                  x.id === dc.id ? { ...x, value: parseInt(e.target.value || '0', 10) } : x,
                                ),
                              }))
                            }
                            className="w-20 rounded-lg border border-[#e4e5eb] px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                discountCodes: f.discountCodes.filter((x) => x.id !== dc.id),
                              }))
                            }
                            className="text-xs font-semibold text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            discountCodes: [
                              ...f.discountCodes,
                              { id: uid(), code: '', type: 'percent', value: 10 },
                            ],
                          }))
                        }
                        className="pe-add-link"
                      >
                        + Add code
                      </button>
                    </div>
                  )}
                  {(form.showQuantityLimit || form.quantityLimit) && (
                    <div className="pe-subpanel">
                      <label className="text-sm font-semibold text-[#1a1a2e]">Max quantity (0 = unlimited)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.quantityLimit}
                        onChange={(e) => patch('quantityLimit', e.target.value)}
                        className="pe-input-outline mt-2"
                        placeholder="0"
                      />
                    </div>
                  )}
                  </>
                  )}
                </div>
              </section>
            )}

            {meta.showCollectInfo && !meta.collectInfoOnThumbnail && (
              <FeatureLock locked={!customFieldsAllowed} label="Custom checkout fields are a Pro feature">
                <CollectInfoFields
                  form={form}
                  setForm={setForm}
                  label={meta.collectInfoLabel}
                  step={meta.showPrice ? 4 : 3}
                />
              </FeatureLock>
            )}

            {meta.deliveryStep !== 'none' && (
              <section className="pe-section">
                <Step n={meta.showPrice ? 5 : 4} label={meta.deliveryStep === 'file' ? 'Upload your Digital Product' : meta.deliveryLabel} />
                <div className="pe-section-inner">
                  {meta.deliveryStep !== 'file' && (
                    <>
                      <p className="pe-field-label">
                        {meta.deliveryLabel}
                        {meta.deliveryStep !== 'manual' && <span className="pe-field-req">*</span>}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#6355fa]">{meta.deliveryHint}</p>
                    </>
                  )}

                  {/* Digital / lead magnet: file upload or redirect URL */}
                  {meta.deliveryStep === 'file' && (
                    <>
                      <div className="pe-delivery-head">
                        <div className="min-w-0 flex-1">
                          <p className="pe-field-label">
                            Digital Product<span className="pe-field-req">*</span>
                          </p>
                          <p className="mt-1 text-xs font-medium text-[#6355fa]">{meta.deliveryHint}</p>
                        </div>
                        <div className="pe-segment">
                          <button
                            type="button"
                            onClick={() => patch('deliveryMode', 'file')}
                            className={cn('pe-segment-btn', form.deliveryMode === 'file' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                          >
                            Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => patch('deliveryMode', 'url')}
                            className={cn('pe-segment-btn', form.deliveryMode === 'url' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                          >
                            Redirect to URL
                          </button>
                        </div>
                      </div>
                      {form.deliveryMode === 'file' ? (
                        <div className="mt-4 w-full">
                          <button type="button" onClick={pickFile} className="pe-file-drop w-full">
                            <span className="text-sm font-medium text-[#6b7280]">Choose or Upload File(s)</span>
                            <span className="pe-btn-outline">Browse library</span>
                            {form.assets.length > 0 && (
                              <span className="text-xs font-medium text-emerald-600">
                                {form.assets.length} file{form.assets.length === 1 ? '' : 's'} attached · add more
                              </span>
                            )}
                          </button>
                          <SelectedFiles assets={form.assets} onRemove={removeAsset} />
                          {form.assets.length > 0 && (
                            <DownloadToggle value={form.allowDownload} onChange={(v) => patch('allowDownload', v)} />
                          )}
                        </div>
                      ) : (
                        <input
                          className="pe-input-outline mt-4"
                          placeholder="https://"
                          value={form.redirectUrl}
                          onChange={(e) => patch('redirectUrl', e.target.value)}
                        />
                      )}
                    </>
                  )}

                  {/* Community / membership: external access link */}
                  {meta.deliveryStep === 'access' && (
                    <input
                      className="pe-input-outline mt-4"
                      placeholder="https://discord.gg/your-invite"
                      value={form.accessUrl}
                      onChange={(e) => {
                        patch('accessUrl', e.target.value);
                        patch('deliveryMode', 'url');
                      }}
                    />
                  )}

                  {/* Custom: manual fulfilment promise */}
                  {meta.deliveryStep === 'manual' && (
                    <>
                      <textarea
                        rows={3}
                        maxLength={280}
                        value={form.fulfilmentNote}
                        onChange={(e) => patch('fulfilmentNote', e.target.value)}
                        placeholder="e.g. I'll send your personalized response within 3 business days."
                        className="pe-input-outline mt-4 resize-y min-h-[88px]"
                      />
                      <p className="mt-2 rounded-lg bg-[#f0f1f6] px-3 py-2 text-xs text-[#6b7280]">
                        Each order appears in your dashboard — you fulfil it manually using the info the buyer submits above.
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ---- Options tab ---- */}
        {tab === 'options' && (
          <div className="space-y-3">
            {meta.optionPanels.includes('reviews') && (
            <AccordionPanel
              icon={<IconSmile size={18} />}
              title="Add Reviews"
              open={openOption === 'reviews'}
              onToggle={() => setOpenOption(openOption === 'reviews' ? null : 'reviews')}
            >
              <div className="space-y-3">
                {form.reviews.items.map((review) => (
                  <div
                    key={review.id}
                    draggable
                    onDragStart={() => setDragReviewId(review.id ?? null)}
                    onDragOver={(e) => {
                      if (dragReviewId && dragReviewId !== review.id) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragReviewId && review.id) reorderReviews(dragReviewId, review.id);
                      setDragReviewId(null);
                    }}
                    onDragEnd={() => setDragReviewId(null)}
                    className={cn('rounded-2xl border border-[#e4e5eb] bg-white p-4', dragReviewId === review.id && 'opacity-50')}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="cursor-grab text-[#c7c9d1]" title="Drag to reorder">⠿</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  reviews: {
                                    ...f.reviews,
                                    items: f.reviews.items.map((x) =>
                                      x.id === review.id ? { ...x, rating: n } : x,
                                    ),
                                  },
                                }))
                              }
                              aria-label={`${n} star${n > 1 ? 's' : ''}`}
                              className="p-0.5"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={n <= review.rating ? '#f5b301' : '#e0e1e6'}>
                                <path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.43 1.2 6.77L12 17.27 6.05 20.5l1.2-6.77L2.5 9.3l6.6-1.04z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            reviews: {
                              ...f.reviews,
                              items: f.reviews.items.filter((x) => x.id !== review.id),
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e5eb] px-3 py-1.5 text-xs font-semibold text-[#6b7280] transition hover:border-red-200 hover:text-red-500"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                        Delete
                      </button>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        {review.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={review.avatarUrl} alt="" className="h-[92px] w-[92px] rounded-xl object-cover" />
                        ) : (
                          <div className="grid h-[92px] w-[92px] place-items-center rounded-xl bg-[#eef0ff] text-[#a9b0e8]">
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="9" r="4" />
                              <path d="M4 20a8 8 0 0 1 16 0z" />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => pickReviewAvatar(review.id ?? '')}
                          className="pe-btn-outline cursor-pointer text-xs"
                        >
                          Choose Image
                        </button>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                        <input
                          value={review.author}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              reviews: {
                                ...f.reviews,
                                items: f.reviews.items.map((x) =>
                                  x.id === review.id ? { ...x, author: e.target.value } : x,
                                ),
                              },
                            }))
                          }
                          placeholder="Name"
                          className="pe-input"
                        />
                        <textarea
                          value={review.quote}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              reviews: {
                                ...f.reviews,
                                items: f.reviews.items.map((x) =>
                                  x.id === review.id ? { ...x, quote: e.target.value } : x,
                                ),
                              },
                            }))
                          }
                          placeholder="Text"
                          rows={3}
                          className="pe-textarea resize-y min-h-[96px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    reviews: {
                      ...f.reviews,
                      enabled: true,
                      items: [
                        ...f.reviews.items,
                        { id: uid(), author: '', quote: '', rating: 5, avatarUrl: '' },
                      ],
                    },
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[#d9d6ff] py-3 text-sm font-semibold text-[#6355fa] transition hover:bg-[#f5f4ff]"
              >
                + Add customer review
              </button>
            </AccordionPanel>
            )}

            {meta.optionPanels.includes('email-flows') && (
            <AccordionPanel
              icon={<IconMail size={18} />}
              title="Email Flows"
              open={openOption === 'email-flows'}
              onToggle={() => setOpenOption(openOption === 'email-flows' ? null : 'email-flows')}
            >
              <FeatureLock locked={!emailFlowsAllowed} label="Email flows are a Pro feature">
              <div className="space-y-3">
                {form.emailFlows.map((step) => (
                  <div key={step.id} className="pe-subpanel space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs font-semibold text-[#1a1a2e]">
                        <input
                          type="checkbox"
                          checked={step.enabled}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              emailFlows: f.emailFlows.map((x) =>
                                x.id === step.id ? { ...x, enabled: e.target.checked } : x,
                              ),
                            }))
                          }
                          className="accent-[#6355fa]"
                        />
                        Enabled
                      </label>
                      <span className="text-xs text-[#8b8d98]">Send after</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={step.dayOffset}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            emailFlows: f.emailFlows.map((x) =>
                              x.id === step.id
                                ? { ...x, dayOffset: parseInt(e.target.value || '0', 10) }
                                : x,
                            ),
                          }))
                        }
                        className="w-16 rounded-lg border border-[#e4e5eb] px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-[#8b8d98]">days</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            emailFlows: f.emailFlows.filter((x) => x.id !== step.id),
                          }))
                        }
                        className="ml-auto text-xs font-semibold text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={step.subject}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emailFlows: f.emailFlows.map((x) =>
                            x.id === step.id ? { ...x, subject: e.target.value } : x,
                          ),
                        }))
                      }
                      placeholder="Email subject"
                      className="pe-input"
                    />
                    <textarea
                      value={step.body}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emailFlows: f.emailFlows.map((x) =>
                            x.id === step.id ? { ...x, body: e.target.value } : x,
                          ),
                        }))
                      }
                      placeholder="Email body"
                      rows={3}
                      className="pe-textarea resize-y min-h-[80px]"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-[#f3f4f9] p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#6355fa]">
                  <IconMail size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1a1a2e]">Add an Email Flow</p>
                  <p className="mt-0.5 text-xs text-[#8b8d98]">
                    Send an automatic email drip to your customers when this product is purchased.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      emailFlows: [
                        ...f.emailFlows,
                        {
                          id: uid(),
                          dayOffset: f.emailFlows.length + 1,
                          subject: 'Following up',
                          body: 'Thanks again for your purchase!',
                          enabled: true,
                        },
                      ],
                    }))
                  }
                  className="pe-btn-solid shrink-0"
                >
                  + Add Flow
                </button>
              </div>
              </FeatureLock>
            </AccordionPanel>
            )}

            {meta.optionPanels.includes('order-bump') && (
            <AccordionPanel
              icon={<IconTrending size={18} />}
              title="Order Bump"
              open={openOption === 'order-bump'}
              onToggle={() => setOpenOption(openOption === 'order-bump' ? null : 'order-bump')}
            >
              <FeatureLock locked={!orderBumpsAllowed} label="Order bumps are a Pro feature">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                <input
                  type="checkbox"
                  checked={form.orderBump.enabled}
                  onChange={(e) =>
                    patch('orderBump', { ...form.orderBump, enabled: e.target.checked })
                  }
                  className="rounded border-[#e4e5eb] accent-[#6355fa]"
                />
                Show order bump at checkout
              </label>
              <CharField
                label="Title"
                value={form.orderBump.title}
                onChange={(v) => patch('orderBump', { ...form.orderBump, title: v })}
                max={140}
              />
              <div className="mt-3">
                <CharField
                  label="Description"
                  value={form.orderBump.description}
                  onChange={(v) => patch('orderBump', { ...form.orderBump, description: v })}
                  max={500}
                  multiline
                  rows={2}
                />
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block pe-field-label">Bump price ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(form.orderBump.priceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    patch('orderBump', {
                      ...form.orderBump,
                      priceCents: Math.round(parseFloat(e.target.value || '0') * 100),
                    })
                  }
                  className="pe-input"
                />
              </div>
              </FeatureLock>
            </AccordionPanel>
            )}

            {meta.optionPanels.includes('affiliate') && (
            <AccordionPanel
              icon={<IconUsers size={18} />}
              title="Affiliate Share"
              open={openOption === 'affiliate'}
              onToggle={() => setOpenOption(openOption === 'affiliate' ? null : 'affiliate')}
            >
              <FeatureLock locked={!affiliateAllowed} label="Affiliate sharing is a Premium feature">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                <input
                  type="checkbox"
                  checked={form.affiliate.enabled}
                  onChange={(e) =>
                    patch('affiliate', { ...form.affiliate, enabled: e.target.checked })
                  }
                  className="rounded border-[#e4e5eb] accent-[#6355fa]"
                />
                Enable affiliate sharing
              </label>
              <div>
                <label className="mb-1.5 block pe-field-label">Commission (%)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.affiliate.commissionPercent}
                  onChange={(e) =>
                    patch('affiliate', {
                      ...form.affiliate,
                      commissionPercent: Math.min(90, Math.max(1, parseInt(e.target.value || '20', 10))),
                    })
                  }
                  className="w-24 pe-input"
                />
              </div>
              {form.id && form.affiliate.enabled && (
                <p className="mt-3 rounded-lg bg-[#f0f1f6] px-3 py-2 text-xs text-[#6b7280]">
                  Share link:{' '}
                  <code className="text-[#6355fa]">
                    /product/{form.id ? '' : ''}…?aff=partner
                  </code>
                  <br />
                  Affiliates earn {form.affiliate.commissionPercent}% when buyers purchase via their link.
                </p>
              )}
              </FeatureLock>
            </AccordionPanel>
            )}

            {meta.optionPanels.includes('confirmation') && (
            <AccordionPanel
              icon={<IconMail size={18} />}
              title="Confirmation Email"
              open={openOption === 'confirmation'}
              onToggle={() => setOpenOption(openOption === 'confirmation' ? null : 'confirmation')}
            >
              <label className="pe-field-label">Subject</label>
              <input
                value={form.confirmSubject}
                onChange={(e) => patch('confirmSubject', e.target.value)}
                maxLength={200}
                className="pe-input-outline mt-1.5"
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, confirmSubject: DEFAULT_CONFIRM_SUBJECT }))}
                  className="pe-add-link"
                >
                  Restore Default
                </button>
              </div>

              <label className="mt-4 block pe-field-label">Body</label>
              <div className="pe-desc-box mt-1.5">
                <div className="pe-toolbar">
                  <DescToolbarBtn title="Heading" onClick={() => insertConfirmToken('## ')}>
                    <span className="text-xs font-bold">H</span>
                  </DescToolbarBtn>
                  <DescToolbarBtn title="Bold" onClick={() => wrapConfirm('**')}>
                    <span className="text-xs font-bold">B</span>
                  </DescToolbarBtn>
                  <DescToolbarBtn title="Strikethrough" onClick={() => wrapConfirm('~~')}>
                    <span className="text-xs font-bold line-through">S</span>
                  </DescToolbarBtn>
                  <DescToolbarBtn title="Italic" onClick={() => wrapConfirm('_')}>
                    <span className="text-xs font-bold italic">I</span>
                  </DescToolbarBtn>
                  <span className="mx-0.5 h-4 w-px bg-[#e4e5eb]" />
                  <DescToolbarBtn title="Bullet list" onClick={() => insertConfirmToken(`${form.confirmBody ? '\n' : ''}• `)}>
                    <span className="text-sm leading-none">≡</span>
                  </DescToolbarBtn>
                  <DescToolbarBtn title="Insert image" onClick={() => insertConfirmToken('[image url]')}>
                    <IconImage size={14} />
                  </DescToolbarBtn>
                  <DescToolbarBtn title="Insert link" onClick={() => wrapConfirm('[', '](url)')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </DescToolbarBtn>
                  <div className="relative ml-auto">
                    <button
                      type="button"
                      onClick={() => setPersonalizeOpen((o) => !o)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d9d6ff] bg-[#f5f4ff] px-2.5 py-1 text-xs font-semibold text-[#6355fa] transition hover:bg-[#efedff]"
                    >
                      + Personalize
                    </button>
                    {personalizeOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPersonalizeOpen(false)} />
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[#e4e5eb] bg-white p-1.5 shadow-lg">
                          {PERSONALIZE_TOKENS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                insertConfirmToken(t);
                                setPersonalizeOpen(false);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#1a1a2e] hover:bg-[#f5f4ff]"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  ref={setConfirmRef}
                  rows={6}
                  maxLength={5000}
                  value={form.confirmBody}
                  onChange={(e) => patch('confirmBody', e.target.value)}
                  className="pe-desc-area"
                  placeholder="Write your confirmation email…"
                />
              </div>
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      confirmSubject: DEFAULT_CONFIRM_SUBJECT,
                      confirmBody: DEFAULT_CONFIRM_BODY,
                    }))
                  }
                  className="pe-add-link"
                >
                  Restore Default
                </button>
              </div>
            </AccordionPanel>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-12 border-t border-[#e4e5eb] pt-6">
          <div className="pe-footer-actions">
            <button type="button" disabled={busy} onClick={() => void save(false)} className="pe-btn-outline disabled:opacity-50">
              <IconSaveGlyph /> Save As Draft
            </button>
            {tab !== 'options' ? (
              <button type="button" disabled={busy} onClick={nextTab} className="pe-btn-solid disabled:opacity-50">
                Next
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">
                Publish
              </button>
            )}
          </div>
        </div>
        </div>

        <div className="pe-preview-col">
          {showThumbnailCardPreview ? (
            <div className="pe-preview-thumb">
              <ThumbnailPreviewCard form={form} />
            </div>
          ) : (
            <div className="pe-phone-wrap">
              <PhoneFrame>
                {showEmptyProductPreview ? (
                  <EmptyProductPreview />
                ) : showLeadMagnetPreview ? (
                  <LeadMagnetPreview form={form} />
                ) : (
                  <CheckoutPreview
                    form={form}
                    showBack={tab === 'options'}
                    showHeroBack={tab === 'checkout'}
                    showTotal={checkoutPreviewFull && !optionsPreviewPartial}
                    showFormFields={checkoutPreviewFull}
                    showPurchaseCta={checkoutPreviewFull && !optionsPreviewPartial}
                    bottomTitleAsFooter={optionsPreviewMinimal}
                  />
                )}
              </PhoneFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated use buildInitialProduct from @/lib/product-types */
export const EMPTY_PRODUCT: ProductEditorState = {
  title: '',
  priceDollars: '',
  discountPriceDollars: '',
  discountEnabled: false,
  type: 'digital',
  productKind: 'digital',
  thumbnailStyle: 'callout',
  shortDescription: '',
  description: '',
  bottomTitle: '',
  ctaLabel: '',
  thumbnailButtonLabel: '',
  thankYouMessage: '',
  coverImageUrl: '',
  coverPublicId: '',
  assets: [],
  deliveryMode: 'file',
  allowDownload: false,
  redirectUrl: '',
  billingInterval: 'one_time',
  cancelSubscriptionEnabled: false,
  cancelAfterMonths: '0',
  fulfilmentNote: '',
  accessUrl: '',
  confirmSubject: DEFAULT_CONFIRM_SUBJECT,
  confirmBody: DEFAULT_CONFIRM_BODY,
  reviews: EMPTY_REVIEWS,
  emailFlows: defaultEmailFlowSteps().map((s) => ({ ...s, id: uid() })),
  orderBump: EMPTY_ORDER_BUMP,
  affiliate: EMPTY_AFFILIATE,
  paymentPlan: EMPTY_PAYMENT_PLAN,
  discountCodes: [],
  quantityLimit: '',
  customFields: [],
  showPaymentPlan: false,
  showDiscountCodes: false,
  showQuantityLimit: false,
};
