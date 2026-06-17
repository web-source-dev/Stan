import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Stan-style iPhone preview — matches reference product editor screenshots. */
export function PhoneFrame({
  children,
  className = '',
  contentClassName = '',
  maxWidth = 324,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Max device width in px (My Store preview is larger than the editor's). */
  maxWidth?: number;
}) {
  return (
    <div className={cn('mx-auto w-full', className)} style={{ maxWidth }}>
      <div
        className="relative overflow-hidden rounded-[2.65rem] bg-[#1c1c1e] p-[6px] shadow-[0_28px_56px_-20px_rgba(15,15,25,0.5)]"
        style={{ aspectRatio: '9 / 19.2' }}
      >
        <div className="pointer-events-none absolute left-1/2 top-[18px] z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full overflow-hidden rounded-[2.05rem] bg-white">
          <div
            className={cn(
              'stan-phone-scroll h-full overflow-y-auto overflow-x-hidden overscroll-contain pt-7',
              contentClassName,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
