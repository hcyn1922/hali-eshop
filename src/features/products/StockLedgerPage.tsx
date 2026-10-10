import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMovements } from '../../app/queries';
import type { MovementType } from '../../types';
import { Card, Input, PageHeader, Select, Skeleton } from '../../ui';
import { MovementsTable } from './MovementsTable';
import { MOVEMENTS } from './meta';

export function StockLedgerPage() {
  const movements = useMovements();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<MovementType | ''>('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (movements.data || []).filter(
      m =>
        (!type || m.movement_type === type) &&
        (!q || [m.product_name, m.product_sku, m.reference_id, m.notes, m.performed_by_name].some(v => (v || '').toLowerCase().includes(q)))
    );
  }, [movements.data, query, type]);

  return (
    <>
      <PageHeader
        title="Stock ledger"
        description="Every unit received, sold, returned or corrected. Entries can't be edited or deleted, and stock can never go below zero."
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:px-5">
          <Input
            aria-label="Search the ledger"
            placeholder="Search product, order or note"
            value={query}
            onChange={e => setQuery(e.target.value)}
            leading={<Search className="h-5 w-5" />}
            containerClassName="sm:w-80"
          />
          <Select aria-label="Movement type" value={type} onChange={e => setType(e.target.value as MovementType | '')} className="sm:w-56">
            <option value="">All movements</option>
            {(Object.keys(MOVEMENTS) as MovementType[]).map(t => (
              <option key={t} value={t}>
                {MOVEMENTS[t].label}
              </option>
            ))}
          </Select>
        </div>
        {movements.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <MovementsTable rows={rows} showProduct />
        )}
      </Card>
    </>
  );
}
