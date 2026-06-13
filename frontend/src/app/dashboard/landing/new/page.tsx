'use client';

import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { LandingPageEditor, EMPTY_LANDING } from '@/components/stan/LandingPageEditor';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';

export default function NewLandingPage() {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [username, setUsername] = useState('');

  useEffect(() => {
    authedRequest<{ profile: { username: string } | null }>('/api/creator/profile')
      .then((r) => setUsername(r.profile?.username ?? ''))
      .catch(() => {});
  }, [authedRequest]);

  return (
    <DashboardShell title="" maxWidth="max-w-[1280px]" hideSubtitle>
      <PaymentBanner />
      {username && (
        <LandingPageEditor
          initial={EMPTY_LANDING}
          username={username}
          onSaved={() => router.push('/dashboard/storefront?tab=landing')}
        />
      )}
    </DashboardShell>
  );
}
