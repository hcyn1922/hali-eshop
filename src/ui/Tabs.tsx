import React from 'react';
import { cn } from './cn';

export interface TabItem<K extends string> {
  key: K;
  label: React.ReactNode;
  count?: number;
}

/** Underline tabs (scroll horizontally on phones). */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" className="flex min-w-max gap-4 border-b border-line sm:gap-6">
        {items.map(item => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={cn(
                'focus-ring -mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                active ? 'border-brand-500 text-fg' : 'border-transparent text-fg-4 hover:text-fg-2'
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-gray-100 text-fg-3 dark:bg-gray-800'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Segmented button group (e.g. Board / List). */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: K; label: React.ReactNode; icon?: React.ReactNode }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="inline-flex self-start overflow-hidden rounded-lg border border-line-strong shadow-xs">
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
          className={cn(
            'focus-ring flex h-10 cursor-pointer items-center gap-2 px-3.5 text-sm font-semibold transition-colors',
            i > 0 && 'border-l border-line-strong',
            item.key === value ? 'bg-primary text-on-primary' : 'bg-surface text-fg-3 hover:bg-hover hover:text-fg-2'
          )}
        >
          {item.icon}
          <span className={item.icon ? 'hidden sm:inline' : ''}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
