import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Stan-style iPhone preview frame for live storefront previews. */
export function PhoneFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[320px]', className)}>
      <div
        className="relative overflow-hidden rounded-[2.75rem] bg-[#121212] p-[10px] shadow-[0_32px_64px_-24px_rgba(15,15,25,0.45)]"
        style={{ aspectRatio: '9/19' }}
      >
        {/* Dynamic island */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 h-[20px] w-[80px] -translate-x-1/2 rounded-full bg-black/90" />
        <div className="h-full overflow-hidden rounded-[2.15rem] bg-white ring-1 ring-black/10">
          <div className="stan-phone-scroll h-full overflow-y-auto overflow-x-hidden overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
