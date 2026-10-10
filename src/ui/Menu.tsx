import React, { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

export interface MenuItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** Small dropdown menu anchored to a trigger. */
export function Menu({
  trigger,
  items,
  align = 'right',
  header,
  direction = 'down',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  header?: React.ReactNode;
  direction?: 'down' | 'up';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'animate-fade-in absolute z-40 min-w-[220px] overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {header && <div className="border-b border-line px-4 py-3">{header}</div>}
          {items
            .filter(i => !i.hidden)
            .map((item, idx) => (
              <button
                key={idx}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium hover:bg-hover',
                  item.danger ? 'text-error-600' : 'text-fg-2'
                )}
              >
                {item.icon && <span className="text-fg-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
