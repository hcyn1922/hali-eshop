import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'brand' | 'link';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-xs border border-transparent',
  brand: 'bg-brand-500 text-white hover:bg-brand-600 shadow-xs border border-transparent',
  secondary: 'bg-surface text-fg-2 border border-line-strong hover:bg-hover hover:text-fg shadow-xs',
  tertiary: 'text-fg-3 hover:bg-hover hover:text-fg-2 border border-transparent',
  destructive: 'bg-error-600 text-white hover:bg-error-700 shadow-xs border border-transparent',
  link: 'text-fg-2 hover:text-fg underline-offset-4 hover:underline border border-transparent !px-0 !h-auto',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
  lg: 'h-11 px-4 text-base gap-2',
};

const iconOnlySizes: Record<Size, string> = { sm: 'h-9 w-9', md: 'h-10 w-10', lg: 'h-11 w-11' };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconOnly, className, children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        variants[variant],
        iconOnly ? cn(iconOnlySizes[size], 'p-0') : sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {!iconOnly && children}
      {iconOnly && <span className="sr-only">{children}</span>}
    </button>
  );
});
