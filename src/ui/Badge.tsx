import React from 'react';
import { cn } from './cn';

export type BadgeColor = 'gray' | 'brand' | 'navy' | 'success' | 'warning' | 'error' | 'blue' | 'purple';

const colors: Record<BadgeColor, { box: string; dot: string }> = {
  gray: { box: 'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-700', dot: 'bg-gray-500' },
  brand: { box: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30', dot: 'bg-brand-500' },
  navy: { box: 'bg-navy-50 text-navy-700 ring-navy-200 dark:bg-navy-400/15 dark:text-navy-200 dark:ring-navy-400/30', dot: 'bg-navy-500' },
  success: { box: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/30', dot: 'bg-success-500' },
  warning: { box: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/30', dot: 'bg-warning-500' },
  error: { box: 'bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/30', dot: 'bg-error-500' },
  blue: { box: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:ring-blue-500/30', dot: 'bg-blue-500' },
  purple: { box: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-500 dark:ring-purple-500/30', dot: 'bg-purple-500' },
};

export function Badge({
  color = 'gray',
  dot,
  children,
  className,
}: {
  color?: BadgeColor;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        colors[color].box,
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', colors[color].dot)} aria-hidden />}
      {children}
    </span>
  );
}
