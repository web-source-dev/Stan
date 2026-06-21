import { AccessClient } from './AccessClient';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export default async function AccessPage({ params }: Props) {
  const { token } = await params;
  return <AccessClient token={token} />;
}
