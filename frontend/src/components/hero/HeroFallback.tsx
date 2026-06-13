/**
 * Static, dependency-free storefront mock. Serves three jobs:
 *  - the Suspense/loading frame while the 3D bundle streams in,
 *  - the reduced-motion experience,
 *  - the no-WebGL fallback.
 * Uses CSS 3D transforms + layered float for depth without any GPU scene.
 */
export function HeroFallback({ animate = true }: { animate?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-sm [perspective:1400px]">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-gradient opacity-25 blur-3xl" />
      <div
        className="relative rounded-[2.25rem] border border-line bg-white/90 p-3 shadow-lift [transform-style:preserve-3d] [transform:rotateX(8deg)_rotateY(-12deg)]"
      >
        <div className="rounded-[1.75rem] bg-surface-subtle p-6">
          <div className="flex flex-col items-center text-center">
            <div className={`grid h-20 w-20 place-items-center rounded-full bg-brand-gradient text-2xl font-bold text-white shadow-glow ${animate ? 'animate-float' : ''}`}>
              M
            </div>
            <div className="mt-3 text-lg font-bold">Maya Rivera</div>
            <div className="text-sm text-neutral-500">Fitness coach</div>
          </div>
          <div className="mt-6 space-y-3">
            <div className={`rounded-2xl border border-line bg-white p-4 shadow-soft ${animate ? 'animate-float' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">12-Week Strength Plan</span>
                <span className="text-sm font-semibold">$49</span>
              </div>
              <div className="mt-3 rounded-lg bg-brand-gradient py-2 text-center text-sm font-semibold text-white">
                Buy now
              </div>
            </div>
            <div className={`rounded-2xl border border-line bg-white p-4 shadow-soft ${animate ? 'animate-float-slow' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">1:1 Coaching Call</span>
                <span className="text-sm font-semibold">$120</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">30 min · video call</div>
            </div>
            <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-center text-sm font-medium text-brand-700">
              Free macro guide → join the list
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
