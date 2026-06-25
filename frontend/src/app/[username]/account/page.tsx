import type { Metadata } from 'next';
import { CustomerPortal } from './CustomerPortal';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `Your purchases · @${username}` };
}

export default async function AccountPage({ params, searchParams }: Props) {
  const { username } = await params;
  const { email } = await searchParams;
  return <CustomerPortal username={username} initialEmail={email} />;
}
