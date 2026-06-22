'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { IconGlobe, IconChevronDown, IconCheck } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Site-wide language switcher. Uses Google's website-translate engine under the
 * hood (zero per-string i18n) but hides Google's banner + dropdown entirely and
 * drives it from our own custom dropdown via the `googtrans` cookie, so the
 * selection persists across navigation and full reloads.
 */

interface GoogleTranslateNS {
  TranslateElement: {
    new (opts: { pageLanguage: string; includedLanguages?: string; autoDisplay?: boolean }, el: string): unknown;
  };
}
declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: GoogleTranslateNS };
    __gtInited?: boolean;
    __gtPatched?: boolean;
  }
}

const LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ur', label: 'اردو' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

function readCookieLang(): string {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
  return m ? decodeURIComponent(m[1]) : 'en';
}

function writeCookieLang(code: string) {
  const host = window.location.hostname;
  const value = code === 'en' ? '' : `/en/${code}`;
  const domains = ['']; // current host (works for localhost/IP)
  if (host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) domains.push(`;domain=.${host}`);
  for (const d of domains) {
    document.cookie = value
      ? `googtrans=${value};path=/${d}`
      : `googtrans=;path=/${d};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

/** Defensive patch so Google's text-node rewrites don't crash React's reconciler. */
function patchDomForTranslate() {
  if (window.__gtPatched) return;
  window.__gtPatched = true;
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return origRemove.call(this, child) as T;
  };
  const origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return origInsert.call(this, node, ref) as T;
  };
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // On dashboard, the bottom-right corner holds the Stanley FAB — sit above it.
  const onDashboard = Boolean(pathname?.startsWith('/dashboard'));

  // Boot the Google engine once; it auto-applies the googtrans cookie on load.
  useEffect(() => {
    setLang(readCookieLang());
    patchDomForTranslate();

    window.googleTranslateElementInit = () => {
      if (window.__gtInited || !window.google?.translate) return;
      window.__gtInited = true;
      // eslint-disable-next-line new-cap
      new window.google.translate.TranslateElement(
        { pageLanguage: 'en', includedLanguages: LANGS.map((l) => l.code).join(','), autoDisplay: false },
        'google_translate_element',
      );
    };

    const id = 'google-translate-script';
    if (window.google?.translate) window.googleTranslateElementInit();
    else if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function choose(code: string) {
    setOpen(false);
    if (code === lang) return;
    writeCookieLang(code);
    // Reload so the engine re-applies cleanly across the whole page.
    window.location.reload();
  }

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <>
      {/* Engine container (kept off-screen + Google's bar hidden via globals.css) */}
      <div id="google_translate_element" aria-hidden />

      {/* Our custom dropdown — bottom-right, raised above the Stanley FAB on dashboard. */}
      <div
        ref={ref}
        translate="no"
        className={cn('notranslate fixed right-5 z-[45]', onDashboard ? 'bottom-24' : 'bottom-5')}
      >
        {open && (
          <div className="absolute bottom-12 right-0 max-h-72 w-52 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-lift">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => choose(l.code)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
                  l.code === lang ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-surface-muted',
                )}
              >
                {l.label}
                {l.code === lang && <IconCheck size={15} className="text-brand-600" />}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Change language"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-soft transition hover:border-brand-300 hover:text-brand-600"
        >
          <IconGlobe size={16} className="text-brand-600" />
          <span className="max-w-[8rem] truncate">{current.label}</span>
          <IconChevronDown size={14} className={cn('text-neutral-400 transition', open && 'rotate-180')} />
        </button>
      </div>
    </>
  );
}
