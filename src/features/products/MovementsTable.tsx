import React from 'react';
import { Link } from 'react-router-dom';
import { formatMaldivesDateTime } from '../../lib/formatters';
import type { StockMovement } from '../../types';
import { Badge, Table, cn } from '../../ui';
import { MOVEMENTS } from './meta';

/** The immutable stock ledger, newest first. */
export function MovementsTable({ rows, showProduct }: { rows: StockMovement[]; showProduct?: boolean }) {
  return (
    <Table
      rows={rows}
      rowKey={m => m.id}
      empty={<p className="px-5 py-12 text-center text-sm text-fg-3">No stock movements yet.</p>}
      columns={[
        ...(showProduct
          ? [
              {
                key: 'product',
                header: 'Product',
                primary: true,
                render: (m: StockMovement) => (
                  <Link to={`/products/${m.product_id}`} className="hover:underline" onClick={e => e.stopPropagation()}>
                    <span className="block font-medium text-fg">{m.product_name || 'Deleted product'}</span>
                    <span className="text-fg-3">{m.product_sku}</span>
                  </Link>
                ),
              },
            ]
          : []),
        {
          key: 'type',
          header: 'Movement',
          primary: !showProduct,
          render: m => (
            <Badge color={(MOVEMENTS[m.movement_type] || MOVEMENTS.opening_balance).color}>{(MOVEMENTS[m.movement_type] || { label: m.movement_type }).label}</Badge>
          ),
        },
        {
          key: 'change',
          header: 'Change',
          align: 'right',
          render: m => (
            <span className={cn('tabular font-semibold', m.quantity_delta > 0 ? 'text-success-700 dark:text-success-500' : 'text-fg')}>
              {m.quantity_delta > 0 ? '+' : ''}
              {m.quantity_delta}
            </span>
          ),
        },
        { key: 'balance', header: 'Balance', align: 'right', render: m => <span className="tabular">{m.resulting_stock}</span> },
        {
          key: 'note',
          header: 'Reference',
          className: 'max-w-sm',
          render: m => (
            <span className="block">
              {m.reference_id && <span className="block font-medium text-fg-2">{m.reference_id}</span>}
              <span className="line-clamp-2 text-fg-3">{m.notes}</span>
            </span>
          ),
        },
        {
          key: 'when',
          header: 'When',
          render: m => (
            <span className="block whitespace-nowrap">
              <span className="block">{formatMaldivesDateTime(m.created_at)}</span>
              <span className="text-fg-4">{m.performed_by_name}</span>
            </span>
          ),
        },
      ]}
    />
  );
}
