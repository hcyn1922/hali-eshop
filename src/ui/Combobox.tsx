import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from './cn';

export interface ComboOption<T> {
  value: T;
  key: string;
  /** Text matched against the search. */
  search: string;
  render: React.ReactNode;
  disabled?: boolean;
}

/**
 * Search box with a filtered list (keyboard: ↑ ↓ Enter Esc). Selecting calls onSelect
 * and clears the search, so it doubles as an "add item" picker.
 */
export function Combobox<T>({
  options,
  onSelect,
  placeholder,
  label,
  emptyText = 'No matches',
  footer,
  autoFocus,
}: {
  options: ComboOption<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  label?: string;
  emptyText?: React.ReactNode;
  footer?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter(o => o.search.toLowerCase().includes(q)) : options;
    return list.slice(0, 50);
  }, [options, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (o: ComboOption<T> | undefined) => {
    if (!o || o.disabled) return;
    onSelect(o.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg-2">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-4" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive(a => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive(a => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (open) {
                e.preventDefault();
                choose(filtered[active]);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="focus-ring h-10 w-full rounded-lg border border-line-strong bg-surface pl-10 pr-3.5 text-[15px] text-fg shadow-xs placeholder:text-fg-4 sm:text-sm"
        />
      </div>
      {open && (
        <div className="animate-fade-in absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <ul id={`${id}-list`} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3.5 py-3 text-sm text-fg-3">{emptyText}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.key}
                role="option"
                aria-selected={i === active}
                aria-disabled={o.disabled}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => {
                  e.preventDefault();
                  choose(o);
                }}
                className={cn(
                  'mx-1 cursor-pointer rounded-md px-2.5 py-2 text-sm',
                  i === active && !o.disabled && 'bg-hover',
                  o.disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {o.render}
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-line p-1">{footer}</div>}
        </div>
      )}
    </div>
  );
}
