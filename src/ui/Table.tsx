import React from 'react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide this column in the stacked phone layout. */
  hideOnMobile?: boolean;
  /** Use this column as the title line of the phone card. */
  primary?: boolean;
}

/**
 * Data table on desktop; on phones each row becomes a card with label/value pairs.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const primary = columns.find(c => c.primary) || columns[0];
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle">
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('whitespace-nowrap px-5 py-3 text-xs font-medium text-fg-3', align(col.align), col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer hover:bg-hover', 'transition-colors')}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-5 py-4 align-middle text-fg-3', align(col.align), col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map(row => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? e => e.key === 'Enter' && onRowClick(row) : undefined}
              className={cn('px-4 py-4', onRowClick && 'cursor-pointer active:bg-hover')}
            >
              <div className="mb-2 text-sm">{primary.render(row)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {columns
                  .filter(c => c !== primary && !c.hideOnMobile)
                  .map(col => (
                    <React.Fragment key={col.key}>
                      <dt className="text-xs text-fg-4">{col.header}</dt>
                      <dd className="text-right text-sm text-fg-2">{col.render(row)}</dd>
                    </React.Fragment>
                  ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
