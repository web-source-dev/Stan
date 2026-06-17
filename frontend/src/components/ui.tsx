import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/icons';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'solid';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-soft hover:bg-brand-700',
  solid: 'bg-brand-600 text-white shadow-soft hover:bg-brand-700',
  secondary:
    'bg-white text-ink border border-line-strong shadow-xs hover:bg-surface-muted hover:border-line-strong',
  outline:
    'bg-white text-ink border border-line-strong shadow-xs hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
  danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700',
};

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonOwnProps) {
  return (
    <button
      className={cn(BTN_BASE, BTN_SIZES[size], BTN_VARIANTS[variant], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  href,
  ...props
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  return (
    <Link
      href={href}
      className={cn(BTN_BASE, BTN_SIZES[size], BTN_VARIANTS[variant], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                             */
/* ------------------------------------------------------------------ */

const INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink shadow-xs outline-none transition placeholder:text-neutral-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-surface-muted';

function LabelRow({ label, optional }: { label: ReactNode; optional?: boolean }) {
  return (
    <span className="mb-1.5 flex items-center justify-between">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      {optional && <span className="text-2xs uppercase tracking-wide text-neutral-400">Optional</span>}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      {label && <LabelRow label={label} optional={optional} />}
      <input className={cn(INPUT_CLASS, error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15', className)} {...props} />
      {hint && !error && <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-danger-600">{error}</span>}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  error,
  optional,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      {label && <LabelRow label={label} optional={optional} />}
      <textarea className={cn(INPUT_CLASS, 'resize-y leading-relaxed', error && 'border-danger-500', className)} {...props} />
      {hint && !error && <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-danger-600">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  hint,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label && <LabelRow label={label} />}
      <select className={cn(INPUT_CLASS, 'cursor-pointer appearance-none bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-9', className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23737380' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...props}>
        {children}
      </select>
      {hint && <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = '',
  hover = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-white shadow-card',
        padded && 'p-6',
        hover && 'transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-neutral-600 ring-line-strong',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warn: 'bg-warn-50 text-warn-700 ring-warn-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const dotColor: Record<Tone, string> = {
    neutral: 'bg-neutral-400',
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warn: 'bg-warn-600',
    danger: 'bg-danger-500',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor[tone])} />}
      {children}
    </span>
  );
}

const ALERT_KINDS: Record<'info' | 'error' | 'success' | 'warn', string> = {
  info: 'bg-brand-50 text-brand-800 ring-brand-200',
  error: 'bg-danger-50 text-danger-700 ring-danger-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warn: 'bg-warn-50 text-warn-700 ring-warn-100',
};

export function Alert({
  kind = 'info',
  children,
  className = '',
}: {
  kind?: 'info' | 'error' | 'success' | 'warn';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset', ALERT_KINDS[kind], className)}>
      {children}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-neutral-500">
      <Spinner className="h-6 w-6 text-brand-500" />
      {label}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg bg-surface-sunken', className)} />;
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
        {icon && <span className="text-brand-500">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-line-strong bg-surface-subtle px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-surface-sunken p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg font-medium transition',
            size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm',
            value === opt.value
              ? 'bg-white text-ink shadow-xs'
              : 'text-neutral-500 hover:text-ink',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Pill tab row — matches Stan's Settings / My Store sub-navigation. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = '',
  variant = 'default',
}: {
  tabs: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  /** `stan` — white pill with blue border on active (My Store tabs). */
  variant?: 'default' | 'stan';
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        const stanActive = variant === 'stan' && active;
        const stanIdle = variant === 'stan' && !active;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] transition',
              variant === 'stan' ? 'font-bold' : 'font-semibold',
              stanActive && 'border border-brand-300 bg-white text-brand-600 shadow-xs',
              stanIdle && 'border border-transparent text-[#131f60] hover:bg-white/60',
              variant === 'default' && active && 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
              variant === 'default' && !active && 'text-neutral-500 hover:bg-surface-muted hover:text-ink',
            )}
          >
            {t.icon && (
              <span className={cn(variant === 'stan' ? (active ? 'text-brand-600' : 'text-[#131f60]') : active ? 'text-brand-600' : 'text-neutral-400')}>{t.icon}</span>
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Dashed "+ Field" filter chips — matches Income / Customers list filters. */
export function FilterChips<T extends string>({
  chips,
  active = [],
  onToggle,
  className = '',
}: {
  chips: { value: T; label: ReactNode }[];
  active?: T[];
  onToggle?: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((c) => {
        const on = active.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onToggle?.(c.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition',
              on
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-dashed border-line-strong text-brand-600 hover:bg-brand-50/60',
            )}
          >
            <span className="text-base leading-none">{on ? '×' : '+'}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  className = '',
}: {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || ''}
        width={size}
        height={size}
        className={cn('rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn('grid place-items-center rounded-full bg-brand-gradient font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Auth layout                                                         */
/* ------------------------------------------------------------------ */

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="inline-flex w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-in">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>}
          </div>
        </div>
        <p className="text-xs text-neutral-400">© {new Date().getFullYear()} Stan</p>
      </div>

      {/* Brand column */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-brand-gradient opacity-90" />
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-96 w-96 rounded-full bg-brand-900/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div />
          <div>
            <p className="text-2xl font-semibold leading-snug">
              “Everything I sell — products, courses, calls, and my email list — finally lives behind one link.”
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20 font-bold">M</span>
              <div>
                <div className="text-sm font-semibold">Maya R.</div>
                <div className="text-sm text-white/70">Creator · 48k followers</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/70">
            <span>Digital products</span>
            <span>Courses</span>
            <span>Bookings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
