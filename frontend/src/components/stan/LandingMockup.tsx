/** Stan-style landing page mockup for the empty state (reference: illustration + placeholders). */
export function LandingMockup() {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[1.75rem] bg-white p-4 shadow-[0_16px_48px_-12px_rgba(15,15,25,0.15)]">
        {/* Hero illustration area */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#ffedd5] via-[#fed7aa] to-[#fbcfe8]">
          <svg viewBox="0 0 240 180" className="h-full w-full" aria-hidden="true">
            <ellipse cx="120" cy="165" rx="70" ry="8" fill="#000" opacity="0.06" />
            <circle cx="108" cy="72" r="28" fill="#6366f1" opacity="0.85" />
            <path d="M88 78c8-18 32-18 40 0" fill="#312e81" opacity="0.9" />
            <rect x="78" y="98" width="60" height="52" rx="16" fill="#5865f2" />
            <circle cx="148" cy="88" r="18" fill="#fda4af" />
            <rect x="132" y="104" width="36" height="40" rx="12" fill="#fb7185" />
            <circle cx="62" cy="48" r="6" fill="#fbbf24" opacity="0.8" />
            <circle cx="178" cy="42" r="5" fill="#a78bfa" opacity="0.7" />
            <path d="M170 58c6 4 10 10 8 16" stroke="#f472b6" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        {/* Title / subtitle placeholders */}
        <div className="mt-4 space-y-2 px-1">
          <div className="h-3.5 w-[78%] rounded-full bg-[#e0e7ff]" />
          <div className="h-2.5 w-[52%] rounded-full bg-[#e0e7ff]/80" />
        </div>
        {/* Content blocks */}
        <div className="mt-4 space-y-2.5 px-1">
          <div className="h-[72px] rounded-xl bg-[#eef2ff]" />
          <div className="h-[72px] rounded-xl bg-[#eef2ff]" />
        </div>
      </div>
    </div>
  );
}
