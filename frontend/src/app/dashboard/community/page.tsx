'use client';

import { DashboardShell } from '@/components/DashboardShell';
import { EmptyState, Button } from '@/components/ui';
import { IconUsers } from '@/components/icons';
import { useRouter } from 'next/navigation';

export default function CommunityPage() {
  const router = useRouter();
  return (
    <DashboardShell
      title="Community"
      subtitle="Host a free or paid community for your audience."
    >
      <EmptyState
        icon={<IconUsers size={24} />}
        title="Build your community"
        description="Create a space where your members can connect, get exclusive updates, and access paid perks."
        action={
          <Button onClick={() => router.push('/dashboard/products/new')}>
            Add to your store
          </Button>
        }
      />
    </DashboardShell>
  );
}
