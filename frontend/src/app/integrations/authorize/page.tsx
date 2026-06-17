'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/icons';

/* Brand marks */
function IgLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12">
      <defs><linearGradient id="az-ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FEDA75" /><stop offset="0.4" stopColor="#FA7E1E" /><stop offset="0.75" stopColor="#D62976" /><stop offset="1" stopColor="#962FBF" /></linearGradient></defs>
      <rect width="24" height="24" rx="7" fill="url(#az-ig)" /><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="16.2" cy="7.8" r="1.1" fill="#fff" />
    </svg>
  );
}
function GCalLogo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" className="h-12 w-12" />;
}
function ZoomLogo() {
  return <svg viewBox="0 0 24 24" className="h-12 w-12"><rect width="24" height="24" rx="6" fill="#2D8CFF" /><path d="M6 9.6A1.6 1.6 0 0 1 7.6 8h4.8A1.6 1.6 0 0 1 14 9.6v4.8A1.6 1.6 0 0 1 12.4 16H7.6A1.6 1.6 0 0 1 6 14.4V9.6Z" fill="#fff" /><path d="M15 11l2.6-1.7c.4-.3 1 0 1 .5v4.4c0 .5-.6.8-1 .5L15 13v-2Z" fill="#fff" /></svg>;
}
function ZapierLogo() {
  return <svg viewBox="0 0 24 24" className="h-12 w-12"><rect width="24" height="24" rx="6" fill="#FF4F00" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5.5" x2="12" y2="18.5" /><line x1="5.5" y1="12" x2="18.5" y2="12" /><line x1="7.4" y1="7.4" x2="16.6" y2="16.6" /><line x1="16.6" y1="7.4" x2="7.4" y2="16.6" /></g></svg>;
}
function TikTokLogo() {
  return <svg viewBox="0 0 24 24" className="h-12 w-12"><rect width="24" height="24" rx="6" fill="#000" /><path d="M15 6c.3 1.6 1.3 2.7 2.8 2.9v2c-1 0-2-.3-2.8-.9v4.2A3.7 3.7 0 1 1 11 10.5v2.1a1.7 1.7 0 1 0 1.2 1.6V6H15Z" fill="#fff" /></svg>;
}

const PROVIDERS: Record<string, { label: string; back: string; logo: React.ReactNode; perms: string[] }> = {
  instagram: { label: 'Instagram', back: '/dashboard/autodm', logo: <IgLogo />, perms: ['Read comments and mentions on your posts', 'Send replies and direct messages on your behalf'] },
  tiktok: { label: 'TikTok', back: '/dashboard/autodm', logo: <TikTokLogo />, perms: ['Read comments on your videos', 'Send automated replies on your behalf'] },
  google_calendar: { label: 'Google Calendar', back: '/dashboard/settings?tab=integrations', logo: <GCalLogo />, perms: ['View and create events on your calendar', 'Keep your booking availability in sync'] },
  zoom: { label: 'Zoom', back: '/dashboard/settings?tab=integrations', logo: <ZoomLogo />, perms: ['Create Zoom meetings for your booked calls', 'Add join links to confirmation emails'] },
  zapier: { label: 'Zapier', back: '/dashboard/settings?tab=integrations', logo: <ZapierLogo />, perms: ['Trigger Zaps when events happen on Stan', 'Connect Stan to 6,000+ apps'] },
};

function AuthorizeInner() {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const provider = params.get('provider') ?? '';
  const meta = PROVIDERS[provider];
  const [busy, setBusy] = useState(false);

  if (!meta) {
    return <div className="text-center text-sm text-neutral-500">Unknown integration.</div>;
  }

  async function authorize() {
    setBusy(true);
    try {
      await authedRequest(`/api/integrations/${provider}/confirm`, { method: 'POST', body: {} });
      router.replace(`${meta.back}${meta.back.includes('?') ? '&' : '?'}connected=${provider}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lift">
      <div className="flex items-center justify-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white"><span className="text-xl font-bold">$</span></span>
        <span className="text-2xl text-neutral-300">↔</span>
        {meta.logo}
      </div>

      <h1 className="mt-6 text-center text-xl font-bold tracking-tight text-[#1a1c3a]">Connect {meta.label} to Stan</h1>
      <p className="mt-2 text-center text-sm text-neutral-500">Stan is requesting permission to:</p>

      <ul className="mt-5 space-y-3">
        {meta.perms.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm text-[#1a1c3a]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-50 text-success-600">✓</span>
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-7 space-y-2.5">
        <button onClick={authorize} disabled={busy} className="h-12 w-full rounded-full bg-brand-600 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Connecting…' : `Authorize ${meta.label}`}
        </button>
        <button onClick={() => router.replace(meta.back)} disabled={busy} className="h-12 w-full rounded-full bg-surface-muted text-[15px] font-bold text-neutral-600 transition hover:bg-surface-sunken disabled:opacity-50">
          Cancel
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-neutral-400">You can disconnect this integration at any time.</p>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-subtle p-6">
      <div className="absolute left-6 top-6"><Logo /></div>
      <Suspense fallback={null}><AuthorizeInner /></Suspense>
    </div>
  );
}
