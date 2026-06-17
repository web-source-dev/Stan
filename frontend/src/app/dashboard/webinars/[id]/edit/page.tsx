'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { WebinarEditor } from '@/components/stan/WebinarEditor';
import { useAuth } from '@/lib/auth-context';
import { webinarFromApi, type ApiWebinar, type WebinarEditorState } from '@/lib/webinar-types';

export default function EditWebinarPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<WebinarEditorState | null>(null);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ webinar: ApiWebinar }>(`/api/webinars/${id}`);
    setInitial(webinarFromApi(res.webinar));
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initial) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'Products', href: '/dashboard/products' }, { label: 'Edit Webinar' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <WebinarEditor initial={initial} onSaved={() => router.push('/dashboard/products')} />
      </div>
    </DashboardShell>
  );
}
