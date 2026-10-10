import React from 'react';
import { cn } from './cn';

/** The shopping-bag "e" mark from the Hali logo. */
export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/hali-mark.svg" alt="" className={cn('h-8 w-8', className)} draggable={false} />;
}

/** Mark + "hali shop" wordmark in the logo's colours. */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="Hali e-shop">
      <LogoMark />
      <span className="font-display text-[19px] font-semibold leading-none tracking-tight">
        <span className={inverted ? 'text-white' : 'text-navy-900 dark:text-white'}>hali</span>
        <span className="ml-[3px] text-brand-500">shop</span>
      </span>
    </span>
  );
}
