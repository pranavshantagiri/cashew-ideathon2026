'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'default' | 'compact' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-[#183e2f] border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:border-ink-3 hover:bg-canvas/60',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-brand-soft hover:text-brand',
  danger: 'bg-danger text-white border border-transparent hover:bg-[#a13127]',
  accent: 'bg-accent text-white border border-transparent hover:bg-[#c47322]',
};

const sizes: Record<Size, string> = {
  default: 'h-10 px-4 text-[14px]',
  compact: 'h-9 px-3 text-[13px]',
  sm: 'h-8 px-3 text-[12px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'default', loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-btn font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
