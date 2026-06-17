'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { Logo } from '@/components/icons';

function UnsubscribeInner() {
  const params = useSearchParams();
  const c = params.get('c') ?? '';
  const e = params.get('e') ?? '';
  const t = params.get('t') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!c || !e || !t) {
      setState('error');
      setMessage('This unsubscribe link is invalid.');
      return;
    }
    apiRequest('/api/broadcasts/unsubscribe', {
      method: 'POST',
      body: { creatorId: c, email: e, token: t },
      credentials: false,
    })
      .then(() => setState('done'))
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiException ? err.message : 'Something went wrong.');
      });
  }, [c, e, t]);

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lift">
      {state === 'working' && <p className="text-sm text-neutral-500">Updating your preferences…</p>}
      {state === 'done' && (
        <>
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-success-50 text-success-600">✓</div>
          <h1 className="text-xl font-bold tracking-tight text-[#1a1c3a]">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm text-neutral-500">{e} will no longer receive emails from this creator.</p>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Couldn&apos;t unsubscribe</h1>
          <p className="mt-2 text-sm text-neutral-500">{message}</p>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-subtle p-6">
      <div className="absolute left-6 top-6"><Logo /></div>
      <Suspense fallback={null}><UnsubscribeInner /></Suspense>
    </div>
  );
}
