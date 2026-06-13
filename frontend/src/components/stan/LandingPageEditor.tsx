'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Button, Field, Select, Textarea, Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { IconArrowLeft, IconCheck, IconExternal } from '@/components/icons';
import { formatPrice, type Product } from '@/lib/types';
import { cn } from '@/lib/cn';

export interface LandingEditorState {
  id?: string;
  title: string;
  slug: string;
  headline: string;
  body: string;
  productId: string;
  ctaLabel: string;
  published: boolean;
}

export const EMPTY_LANDING: LandingEditorState = {
  title: 'Exclusive Offer',
  slug: '',
  headline: 'A special link just for you',
  body: 'Get access to this offer before anyone else on my storefront.',
  productId: '',
  ctaLabel: 'Get access',
  published: false,
};

function LandingPreview({
  form,
  creator,
  product,
}: {
  form: LandingEditorState;
  creator: { displayName: string; avatarUrl: string; username: string };
  product: Product | null;
}) {
  const accent = '#5865f2';
  return (
    <div className="min-h-full bg-white px-4 pb-10 pt-10">
      <div className="mb-6 flex items-center gap-2.5">
        {creator.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {(creator.displayName || creator.username).charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-neutral-600">
          {creator.displayName || `@${creator.username}`}
        </span>
      </div>

      <h1 className="text-xl font-bold leading-snug text-ink">{form.title || 'Page title'}</h1>
      {form.headline && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">{form.headline}</p>
      )}
      {form.body && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">{form.body}</p>
      )}

      {product ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {product.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.coverImageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
          )}
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-ink">{product.title}</h2>
              <span className="shrink-0 text-sm font-bold text-brand-600">
                {product.priceCents ? formatPrice(product.priceCents, product.currency) : 'Free'}
              </span>
            </div>
            {product.shortDescription && (
              <p className="mt-1 text-xs text-neutral-500">{product.shortDescription}</p>
            )}
            <button
              type="button"
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {form.ctaLabel || 'Get access'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-8 w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-soft"
          style={{ backgroundColor: accent }}
        >
          {form.ctaLabel || 'Get access'}
        </button>
      )}
    </div>
  );
}

export function LandingPageEditor({
  initial,
  username,
  onSaved,
}: {
  initial: LandingEditorState;
  username: string;
  onSaved: (id: string) => void;
}) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<LandingEditorState>(initial);
  const [products, setProducts] = useState<Product[]>([]);
  const [creator, setCreator] = useState({ displayName: '', avatarUrl: '', username });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadMeta = useCallback(async () => {
    const [prof, prod] = await Promise.all([
      authedRequest<{ profile: { displayName: string; avatarUrl: string; username: string } | null }>(
        '/api/creator/profile',
      ),
      authedRequest<{ products: Product[] }>('/api/products').catch(() => ({ products: [] })),
    ]);
    if (prof.profile) {
      setCreator({
        displayName: prof.profile.displayName,
        avatarUrl: prof.profile.avatarUrl,
        username: prof.profile.username,
      });
    }
    setProducts(prod.products.filter((p) => p.status === 'published' || p.status === 'draft'));
  }, [authedRequest]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const linkedProduct = products.find((p) => p.id === form.productId) ?? null;

  async function save(publish: boolean) {
    setError('');
    setBusy(true);
    const body = {
      title: form.title,
      headline: form.headline,
      body: form.body,
      ctaLabel: form.ctaLabel,
      ...(form.productId ? { productId: form.productId } : { productId: null }),
      published: publish,
    };
    try {
      let id = form.id;
      if (id) {
        const res = await authedRequest<{ page: LandingEditorState & { id: string; slug: string } }>(
          `/api/landing/${id}`,
          { method: 'PATCH', body },
        );
        setForm((f) => ({ ...f, slug: res.page.slug, published: res.page.published }));
      } else {
        const res = await authedRequest<{ page: LandingEditorState & { id: string; slug: string } }>(
          '/api/landing',
          { method: 'POST', body },
        );
        id = res.page.id;
        setForm((f) => ({ ...f, id, slug: res.page.slug, published: res.page.published }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved(id!);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save landing page');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/storefront"
              className="inline-flex items-center gap-1 font-medium text-neutral-500 hover:text-ink"
            >
              <IconArrowLeft size={16} /> My Store
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="font-semibold text-ink">
              {form.id ? 'Edit Landing Page' : 'New Landing Page'}
            </span>
          </div>
          {form.slug && (
            <Link
              href={`/${username}/p/${form.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Preview link <IconExternal size={14} />
            </Link>
          )}
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
          <h2 className="text-sm font-bold text-ink">Page content</h2>
          <p className="mt-1 text-sm text-neutral-500">What visitors see when they open your private link.</p>
          <div className="mt-5 space-y-4">
            <Field
              label="Page title*"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Field
              label="Headline"
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            />
            <Textarea
              label="Body"
              rows={5}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
          <h2 className="text-sm font-bold text-ink">Linked offer</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Optional — attach a product so visitors can buy or download directly.
          </p>
          <div className="mt-4 space-y-4">
            <Select
              label="Product"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            >
              <option value="">No linked product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.priceCents ? `(${formatPrice(p.priceCents, p.currency)})` : '(Free)'}
                </option>
              ))}
            </Select>
            <Field
              label="Button label"
              value={form.ctaLabel}
              onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
            />
          </div>
        </section>

        {form.slug && (
          <div className="rounded-xl bg-[#f5f5f8] px-4 py-3 text-sm text-neutral-600">
            <span className="font-semibold text-ink">URL: </span>
            /{username}/p/{form.slug}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-xl" loading={busy} onClick={() => void save(false)}>
            Save as Draft
          </Button>
          <Button className="rounded-xl" loading={busy} onClick={() => void save(true)}>
            {form.published ? 'Save & Publish' : 'Publish'}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success-600">
              <IconCheck size={15} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push('/dashboard/storefront')}
            className={cn('text-sm font-medium text-neutral-500 hover:text-ink')}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="xl:sticky xl:top-8">
        <PhoneFrame>
          <LandingPreview form={form} creator={creator} product={linkedProduct} />
        </PhoneFrame>
      </div>
    </div>
  );
}
