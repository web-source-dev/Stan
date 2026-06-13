'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Field, Textarea, Alert, Badge, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { IconPlus, IconBox, IconImage, IconDownload, IconCheck, IconX } from '@/components/icons';
import { uploadToCloudinary, type SignKind } from '@/lib/upload';
import { formatPrice, type Product } from '@/lib/types';
import { cn } from '@/lib/cn';

interface FormState {
  id?: string;
  title: string;
  priceDollars: string;
  type: 'digital' | 'lead_magnet';
  shortDescription: string;
  description: string;
  ctaLabel: string;
  thankYouMessage: string;
  coverImageUrl: string;
  coverPublicId: string;
  assets: { publicId: string; resourceType: 'raw' | 'image' | 'video'; filename: string; bytes: number; format: string }[];
}

const EMPTY: FormState = {
  title: '', priceDollars: '', type: 'digital', shortDescription: '', description: '',
  ctaLabel: '', thankYouMessage: '', coverImageUrl: '', coverPublicId: '', assets: [],
};

function UploadTile({
  icon, label, hint, done, onChange, accept,
}: {
  icon: React.ReactNode; label: string; hint: string; done?: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; accept?: string;
}) {
  return (
    <label className={cn(
      'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition',
      done ? 'border-success-500 bg-success-50/40' : 'border-line-strong hover:border-brand-300 hover:bg-brand-50/30',
    )}>
      <span className={done ? 'text-success-600' : 'text-neutral-400'}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {done ? <span className="text-xs font-medium text-success-600">{done}</span> : <span className="text-xs text-neutral-500">{hint}</span>}
      <input type="file" accept={accept} onChange={onChange} className="hidden" />
    </label>
  );
}

function ProductForm({ initial, onClose, onSaved }: {
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState('');

  const sign = useCallback(
    (kind: SignKind) => authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
      '/api/cloudinary/sign-upload', { method: 'POST', body: { kind } },
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const priceCents = form.type === 'lead_magnet' ? 0 : Math.round(parseFloat(form.priceDollars || '0') * 100);
    const body = {
      type: form.type,
      title: form.title,
      priceCents,
      shortDescription: form.shortDescription,
      description: form.description,
      ctaLabel: form.ctaLabel,
      thankYouMessage: form.thankYouMessage,
      coverImageUrl: form.coverImageUrl,
      coverPublicId: form.coverPublicId,
      assets: form.assets,
    };
    try {
      if (form.id) {
        await authedRequest(`/api/products/${form.id}`, { method: 'PATCH', body });
      } else {
        await authedRequest('/api/products', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save product');
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{form.id ? 'Edit product' : 'New product'}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-surface-muted hover:text-ink">
          <IconX size={18} />
        </button>
      </div>
      <form onSubmit={save} className="mt-5 space-y-5">
        {error && <Alert kind="error">{error}</Alert>}

        <Segmented
          value={form.type}
          onChange={(t) => setForm((f) => ({ ...f, type: t }))}
          options={[
            { value: 'digital', label: 'Paid product' },
            { value: 'lead_magnet', label: 'Free lead magnet' },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          {form.type === 'digital' && (
            <Field label="Price (USD)" type="number" min="0" step="0.01" required
              value={form.priceDollars} onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))} />
          )}
        </div>

        <Field label="Short description" optional value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} />
        <Textarea label="Full description" optional rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UploadTile
            icon={<IconImage size={22} />}
            label="Cover image"
            hint="PNG or JPG"
            accept="image/*"
            onChange={handleCover}
            done={form.coverImageUrl ? 'Cover uploaded' : undefined}
          />
          <UploadTile
            icon={<IconDownload size={22} />}
            label="Fulfilment file"
            hint="Delivered after purchase"
            onChange={handleFile}
            done={form.assets.length > 0 ? `${form.assets.length} file(s)` : undefined}
          />
        </div>
        {uploadNote && <Alert kind="info">{uploadNote} — you can still save; add files once Cloudinary is configured.</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button label" optional placeholder="Buy now" value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
          <Field label="Thank-you message" optional value={form.thankYouMessage} onChange={(e) => setForm((f) => ({ ...f, thankYouMessage: e.target.value }))} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            {form.id ? 'Save changes' : 'Create product'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function ProductsManager() {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ products: Product[] }>('/api/products');
    setProducts(res.products);
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  async function action(id: string, kind: 'publish' | 'draft' | 'archive' | 'duplicate') {
    setActionError('');
    try {
      if (kind === 'publish') await authedRequest(`/api/products/${id}/publish`, { method: 'POST' });
      else if (kind === 'duplicate') await authedRequest(`/api/products/${id}/duplicate`, { method: 'POST' });
      else await authedRequest(`/api/products/${id}/status`, { method: 'POST', body: { status: kind } });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiException ? err.message : 'Action failed');
    }
  }

  async function openEdit(p: Product) {
    const res = await authedRequest<{ product: Product }>(`/api/products/${p.id}`);
    const full = res.product;
    setEditing({
      id: full.id, title: full.title, type: full.type,
      priceDollars: (full.priceCents / 100).toString(),
      shortDescription: full.shortDescription, description: full.description,
      ctaLabel: full.ctaLabel, thankYouMessage: full.thankYouMessage ?? '',
      coverImageUrl: full.coverImageUrl, coverPublicId: '',
      assets: (full.assets ?? []).map((a) => ({ publicId: a.publicId, resourceType: a.resourceType as 'raw', filename: a.filename, bytes: a.bytes, format: '' })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <DashboardShell
      title="Products"
      subtitle="Sell downloads, templates and free lead magnets."
      breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Products' }]}
      actions={!editing && <Button onClick={() => router.push('/dashboard/products/new')}><IconPlus size={16} /> New product</Button>}
    >
      {actionError && <div className="mb-4"><Alert kind="error">{actionError}</Alert></div>}

      {editing && (
        <ProductForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); router.refresh(); }}
        />
      )}

      {products === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : products.length === 0 && !editing ? (
        <EmptyState
          icon={<IconBox size={24} />}
          title="No products yet"
          description="Create your first digital product or free lead magnet to start selling."
          action={<Button onClick={() => router.push('/dashboard/products/new')}><IconPlus size={16} /> New product</Button>}
        />
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} padded={false} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {p.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-muted text-neutral-400">
                    <IconBox size={20} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <Badge tone={p.status === 'published' ? 'success' : p.status === 'archived' ? 'danger' : 'neutral'}>{p.status}</Badge>
                  </div>
                  <div className="mt-0.5 text-sm text-neutral-500">
                    {p.type === 'lead_magnet' ? 'Free' : formatPrice(p.priceCents, p.currency)} · {p.salesCount} sold
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm">
                <button onClick={() => router.push(`/dashboard/products/${p.id}/edit`)} className="rounded-lg px-2.5 py-1.5 font-medium text-neutral-600 hover:bg-surface-muted hover:text-ink">Edit</button>
                <button onClick={() => action(p.id, 'duplicate')} className="rounded-lg px-2.5 py-1.5 font-medium text-neutral-600 hover:bg-surface-muted hover:text-ink">Duplicate</button>
                {p.status === 'published' ? (
                  <button onClick={() => action(p.id, 'draft')} className="rounded-lg px-2.5 py-1.5 font-medium text-neutral-600 hover:bg-surface-muted hover:text-ink">Unpublish</button>
                ) : (
                  <button onClick={() => action(p.id, 'publish')} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-brand-600 hover:bg-brand-50"><IconCheck size={15} /> Publish</button>
                )}
                <button onClick={() => action(p.id, 'archive')} className="rounded-lg px-2.5 py-1.5 font-medium text-danger-600 hover:bg-danger-50">Archive</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

export default function ProductsPage() {
  return <ProductsManager />;
}
