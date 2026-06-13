'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Button, Field, Tabs, Textarea, Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { IconArrowLeft, IconDownload, IconImage, IconMail, IconUpload } from '@/components/icons';
import { uploadToCloudinary, type SignKind } from '@/lib/upload';
import { cn } from '@/lib/cn';

export interface ProductEditorState {
  id?: string;
  title: string;
  priceDollars: string;
  type: 'digital' | 'lead_magnet';
  shortDescription: string;
  description: string;
  bottomTitle: string;
  ctaLabel: string;
  thankYouMessage: string;
  coverImageUrl: string;
  coverPublicId: string;
  assets: { publicId: string; resourceType: 'raw' | 'image' | 'video'; filename: string; bytes: number; format: string }[];
  deliveryMode: 'file' | 'url';
  redirectUrl: string;
  confirmSubject: string;
  confirmBody: string;
}

export const EMPTY_PRODUCT: ProductEditorState = {
  title: 'Get My FREE Guide Now!',
  priceDollars: '',
  type: 'lead_magnet',
  shortDescription: 'Join my email list and never miss an update from me!',
  description: '',
  bottomTitle: 'Get My FREE Guide',
  ctaLabel: 'Download',
  thankYouMessage: '',
  coverImageUrl: '',
  coverPublicId: '',
  assets: [],
  deliveryMode: 'file',
  redirectUrl: '',
  confirmSubject: '[Product Name] from @[My Username]',
  confirmBody: 'Thanks for signing up! Your download is ready.',
};

function CheckoutPreview({ form }: { form: ProductEditorState }) {
  const accent = '#5865f2';
  return (
    <div className="min-h-full bg-white px-4 pb-8 pt-10">
      {form.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={form.coverImageUrl} alt="" className="mb-4 w-full rounded-2xl object-cover" style={{ aspectRatio: '4/3' }} />
      ) : (
        <div className="mb-4 aspect-[4/3] rounded-2xl bg-surface-muted" />
      )}
      <h1 className="text-center text-lg font-bold leading-snug text-ink">{form.title || 'Product title'}</h1>
      {form.shortDescription && (
        <p className="mt-2 text-center text-sm leading-relaxed text-neutral-500">{form.shortDescription}</p>
      )}
      {form.bottomTitle && (
        <h2 className="mt-5 text-center text-base font-bold text-ink">{form.bottomTitle}</h2>
      )}
      <div className="mt-4 space-y-2.5">
        <input
          readOnly
          placeholder="Enter your name"
          className="w-full rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-neutral-400 outline-none"
        />
        <input
          readOnly
          placeholder="Enter your email"
          className="w-full rounded-xl border-0 bg-[#f4f4fc] px-3.5 py-3 text-sm text-neutral-400 outline-none"
        />
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-soft"
        style={{ backgroundColor: accent }}
      >
        {form.ctaLabel || (form.type === 'lead_magnet' ? 'Download' : 'Buy now')}
      </button>
    </div>
  );
}

export function ProductEditor({
  initial,
  onSaved,
}: {
  initial: ProductEditorState;
  onSaved: (id: string) => void;
}) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<ProductEditorState>(initial);
  const [tab, setTab] = useState<'checkout' | 'product' | 'options'>('checkout');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState('');

  const sign = useCallback(
    (kind: SignKind) =>
      authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        '/api/cloudinary/sign-upload',
        { method: 'POST', body: { kind } },
      ),
    [authedRequest],
  );

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadToCloudinary(file, 'product_cover', sign);
      setForm((f) => ({ ...f, coverImageUrl: res.url, coverPublicId: res.publicId }));
      setUploadNote('');
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadToCloudinary(file, 'product_file', sign);
      setForm((f) => ({
        ...f,
        assets: [...f.assets, { publicId: res.publicId, resourceType: 'raw', filename: res.filename, bytes: res.bytes, format: res.format }],
      }));
      setUploadNote('');
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function save(publish: boolean) {
    setError('');
    setBusy(true);
    const priceCents = form.type === 'lead_magnet' ? 0 : Math.round(parseFloat(form.priceDollars || '0') * 100);
    const body = {
      type: form.type,
      title: form.title,
      priceCents,
      shortDescription: form.shortDescription,
      description: form.description || form.shortDescription,
      ctaLabel: form.ctaLabel,
      thankYouMessage: form.thankYouMessage,
      coverImageUrl: form.coverImageUrl,
      coverPublicId: form.coverPublicId,
      assets: form.assets,
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
      }
      onSaved(id!);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save product');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/storefront" className="inline-flex items-center gap-1 font-medium text-neutral-500 hover:text-ink">
            <IconArrowLeft size={16} /> My Store
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="font-semibold text-ink">{form.id ? 'Edit Product' : 'Add New Product'}</span>
        </div>

        <Tabs
          variant="stan"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'checkout', label: 'Checkout Page', icon: <IconDownload size={16} /> },
            { value: 'product', label: 'Product', icon: <IconUpload size={16} /> },
            { value: 'options', label: 'Options', icon: <IconMail size={16} /> },
          ]}
        />

        {error && <Alert kind="error">{error}</Alert>}
        {uploadNote && <Alert kind="info">{uploadNote}</Alert>}

        {tab === 'checkout' && (
          <div className="space-y-6 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Select Image</div>
              <div className="flex flex-wrap items-start gap-4">
                {form.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImageUrl} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-line" />
                ) : (
                  <div className="grid h-24 w-24 place-items-center rounded-xl bg-surface-muted text-neutral-400">
                    <IconImage size={24} />
                  </div>
                )}
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/20">
                  <span className="text-sm font-semibold text-brand-600">Choose Image</span>
                  <input type="file" accept="image/*" onChange={handleCover} className="hidden" />
                </label>
              </div>
            </div>

            <Field
              label="Title*"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Textarea
              label="Description"
              rows={4}
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
            />
            <Field
              label="Bottom Title*"
              value={form.bottomTitle}
              onChange={(e) => setForm((f) => ({ ...f, bottomTitle: e.target.value }))}
            />
            {form.type === 'digital' && (
              <Field
                label="Price (USD)*"
                type="number"
                min="0"
                step="0.01"
                value={form.priceDollars}
                onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
              />
            )}
            <Field
              label="Button label"
              value={form.ctaLabel}
              onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
            />
          </div>
        )}

        {tab === 'product' && (
          <div className="space-y-5 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
            <div className="text-sm font-bold text-ink">Upload Attachment &amp; Files</div>
            <div className="inline-flex rounded-xl bg-surface-muted p-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, deliveryMode: 'file' }))}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition',
                  form.deliveryMode === 'file' ? 'bg-brand-600 text-white shadow-soft' : 'text-brand-600',
                )}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, deliveryMode: 'url' }))}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition',
                  form.deliveryMode === 'url' ? 'bg-brand-600 text-white shadow-soft' : 'text-brand-600',
                )}
              >
                Redirect to URL
              </button>
            </div>

            {form.deliveryMode === 'file' ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-[#f5f5f8] px-6 py-12 text-center">
                <span className="text-sm font-medium text-neutral-600">Drag Your File(s) Here</span>
                <span className="inline-flex rounded-xl border border-brand-500 bg-white px-4 py-2 text-sm font-semibold text-brand-600">
                  Upload
                </span>
                {form.assets.length > 0 && (
                  <span className="text-xs font-medium text-success-600">{form.assets.length} file(s) attached</span>
                )}
                <input type="file" onChange={handleFile} className="hidden" />
              </label>
            ) : (
              <Field
                label="Redirect URL"
                placeholder="https://"
                value={form.redirectUrl}
                onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value }))}
              />
            )}

            <Textarea
              label="Full description"
              optional
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        )}

        {tab === 'options' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
              <div className="mb-4 flex items-center gap-2 font-semibold text-ink">
                <IconMail size={18} className="text-brand-600" />
                Confirmation Email
              </div>
              <Field
                label="Subject"
                value={form.confirmSubject}
                onChange={(e) => setForm((f) => ({ ...f, confirmSubject: e.target.value }))}
              />
              <Textarea
                label="Body"
                rows={5}
                className="mt-4"
                value={form.confirmBody}
                onChange={(e) => setForm((f) => ({ ...f, confirmBody: e.target.value }))}
              />
              <button type="button" className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
                Restore Default
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="outline" className="rounded-xl" loading={busy} onClick={() => void save(false)}>
            Save As Draft
          </Button>
          <Button className="rounded-xl" loading={busy} onClick={() => void save(true)}>
            Publish
          </Button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/storefront')}
            className="text-sm font-medium text-neutral-500 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="xl:sticky xl:top-8">
        <PhoneFrame>
          <CheckoutPreview form={form} />
        </PhoneFrame>
      </div>
    </div>
  );
}
