import type { Metadata } from 'next';
import { GlobalPortal } from './GlobalPortal';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ email?: string }> };

export const metadata: Metadata = {
  title: 'Your purchases · all stores',
};

export default async function GlobalAccountPage({ searchParams }: Props) {
  const { email } = await searchParams;
  return <GlobalPortal initialEmail={email} />;
}
