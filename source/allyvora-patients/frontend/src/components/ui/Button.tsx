import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-sm disabled:bg-brand/50',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3',
  quiet: 'text-brand hover:bg-brand-soft disabled:text-ink-3',
  danger: 'bg-surface text-danger border border-danger/30 hover:bg-danger-soft disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  kbd?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, kbd, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {kbd && (
        <kbd
          className={cn(
            'ml-1 hidden rounded px-1 font-sans text-2xs font-medium lg:inline',
            variant === 'primary' ? 'bg-black/15 text-brand-ink/90' : 'bg-sunken text-ink-3',
          )}
        >
          {kbd}
        </kbd>
      )}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-sunken hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
