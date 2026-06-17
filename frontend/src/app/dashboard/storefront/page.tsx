'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Tabs } from '@/components/ui';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { StoreContentEditor } from '@/components/stan/StoreContentEditor';
import { StoreDesignEditor } from '@/components/stan/StoreDesignEditor';
import { LandingPagesTab } from '@/components/stan/LandingPagesTab';
import { useAuth } from '@/lib/auth-context';
import {
  IconExternal,
  IconStore,
  IconPalette,
} from '@/components/icons';
import type { CreatorProfile } from '@/lib/types';

function MyStore() {
  const { authedRequest } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<'store' | 'landing' | 'design'>(
    tabParam === 'landing' || tabParam === 'design' ? tabParam : 'store',
  );

  useEffect(() => {
    authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile')
      .then((r) => setProfile(r.profile))
      .catch(() => {});
  }, [authedRequest]);

  useEffect(() => {
    if (tabParam === 'landing' || tabParam === 'design' || tabParam === 'store') {
      setTab(tabParam);
    }
  }, [tabParam]);

  if (!profile) {
    return (
      <DashboardShell title="My Store" maxWidth="max-w-[1280px]">
        <Skeleton className="h-96 w-full" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="My Store" maxWidth="max-w-[1280px]" hideSubtitle hideTitle>
      <PaymentBanner />

      <Tabs
        variant="stan"
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'store', label: 'Store', icon: <IconStore size={18} /> },
          { value: 'landing', label: 'Landing Pages', icon: <IconExternal size={18} /> },
          { value: 'design', label: 'Edit Design', icon: <IconPalette size={18} /> },
        ]}
      />

      {tab === 'store' && (
        <StoreContentEditor profile={profile} onProfileUpdated={setProfile} />
      )}

      {tab === 'landing' && <LandingPagesTab username={profile.username} />}

      {tab === 'design' && <StoreDesignEditor />}
    </DashboardShell>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={null}>
      <MyStore />
    </Suspense>
  );
}
