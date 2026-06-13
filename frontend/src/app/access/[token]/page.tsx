import { notFound } from 'next/navigation';
import { apiRequest, ApiException, API_URL } from '@/lib/api';
import { Card } from '@/components/ui';
import { IconDownload, IconCheckCircle } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

interface FulfilmentData {
  product: { title: string; shortDescription: string; thankYouMessage: string; coverImageUrl: string };
  files: { id: string; filename: string; bytes: number }[];
}

function prettyBytes(bytes: number): string {
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

export default async function AccessPage({ params }: Props) {
  const { token } = await params;
  let data: FulfilmentData;
  try {
    data = await apiRequest<FulfilmentData>(`/api/fulfilment/${encodeURIComponent(token)}`, {
      credentials: false,
    });
  } catch (err) {
    if (err instanceof ApiException && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-md px-5 py-12">
        <Card>
          {data.product.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.product.coverImageUrl}
              alt={data.product.title}
              className="mb-5 h-44 w-full rounded-xl object-cover"
            />
          )}
          <div className="flex items-center gap-2 text-sm font-medium text-success-700">
            <IconCheckCircle size={18} /> Purchase complete
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.product.title}</h1>
          {data.product.thankYouMessage && (
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{data.product.thankYouMessage}</p>
          )}

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your files</h2>
            {data.files.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                No downloadable files are attached to this product.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={`${API_URL}/api/fulfilment/${encodeURIComponent(token)}/download/${f.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-xs transition hover:border-brand-300 hover:shadow-soft"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <IconDownload size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.filename}</span>
                        <span className="text-xs text-neutral-400">{prettyBytes(f.bytes)}</span>
                      </span>
                      <span className="text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">Download</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-6 text-xs text-neutral-400">
            Bookmark this page — your download links refresh automatically each time you visit.
          </p>
        </Card>
      </div>
    </div>
  );
}
