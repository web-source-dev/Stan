'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { LandingPageEditor, type LandingEditorState } from '@/components/stan/LandingPageEditor';
import { useAuth } from '@/lib/auth-context';

export default function EditLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [id, setId] = useState('');
  const [initial, setInitial] = useState<LandingEditorState | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const [pageRes, profRes] = await Promise.all([
      authedRequest<{ page: LandingEditorState & { id: string; slug: string; productId?: string | null } }>(
        `/api/landing/${id}`,
      ),
      authedRequest<{ profile: { username: string } | null }>('/api/creator/profile'),
    ]);
    const p = pageRes.page;
    setInitial({
      id: p.id,
      title: p.title,
      slug: p.slug,
      headline: p.headline ?? '',
      body: p.body ?? '',
      productId: p.productId ?? '',
      ctaLabel: p.ctaLabel ?? 'Get access',
      published: p.published ?? false,
    });
    setUsername(profRes.profile?.username ?? '');
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initial || !username) return null;

  return (
    <DashboardShell title="" maxWidth="max-w-[1280px]" hideSubtitle>
      <PaymentBanner />
      <LandingPageEditor
        initial={initial}
        username={username}
        onSaved={() => router.push('/dashboard/storefront?tab=landing')}
      />
    </DashboardShell>
  );
}
