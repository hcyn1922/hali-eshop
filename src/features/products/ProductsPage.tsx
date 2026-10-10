import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, LayoutGrid, List, PackagePlus, Plus, Search } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { useCategories, useProducts } from '../../app/queries';
import { formatMVR } from '../../lib/formatters';
import type { Product } from '../../types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Select, Skeleton, Table } from '../../ui';
import { ProductFormModal, ReceiveStockModal } from './ProductForms';
import { ProductThumb } from './ProductThumb';
import { stockState } from './meta';

type StockFilter = 'all' | 'low' | 'out' | 'inactive';

export function ProductsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const products = useProducts();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [adding, setAdding] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const view = (params.get('view') as 'grid' | 'list') || 'grid';

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data || []).filter(p => {
      if (q && ![p.name, p.sku, p.category_name, p.supplier_name].some(v => (v || '').toLowerCase().includes(q))) return false;
      if (category && p.category_id !== category) return false;
      if (stock === 'low') return p.is_active && p.available_stock > 0 && p.available_stock <= p.low_stock_threshold;
      if (stock === 'out') return p.is_active && p.available_stock <= 0;
      if (stock === 'inactive') return !p.is_active;
      return true;
    });
  }, [products.data, query, category, stock]);

  const showCost = can.seeCosts(role);
  const open = (p: Product) => navigate(`/products/${p.id}`);

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalog, prices and live stock."
        actions={
          can.manageCatalog(role) && (
            <>
              <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setReceiving(true)}>
                Receive stock
              </Button>
              <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
                New product
              </Button>
            </>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          aria-label="Search products"
          placeholder="Search name, SKU, category or supplier"
          value={query}
          onChange={e => setQuery(e.target.value)}
          leading={<Search className="h-5 w-5" />}
          containerClassName="lg:w-80"
        />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="sm:w-48">
            <option value="">All categories</option>
            {(categories.data || []).map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Stock" value={stock} onChange={e => setStock(e.target.value as StockFilter)} className="sm:w-44">
            <option value="all">All stock levels</option>
            <option value="low">Running low</option>
            <option value="out">Out of stock</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="lg:ml-auto">
          <Segmented
            items={[
              { key: 'grid', label: 'Grid', icon: <LayoutGrid className="h-4 w-4" /> },
              { key: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
            ]}
            value={view}
            onChange={v => setParams({ view: v }, { replace: true })}
          />
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title={(products.data || []).length ? 'No products match' : 'No products yet'}
            description={(products.data || []).length ? 'Try clearing the filters.' : 'Add your first product to start taking orders.'}
            action={
              can.manageCatalog(role) &&
              !(products.data || []).length && (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                  New product
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {list.map(p => {
            const s = stockState(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p)}
                className="focus-ring group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-surface text-left shadow-xs transition-shadow hover:shadow-sm"
              >
                <ProductThumb product={p} className="aspect-square w-full rounded-none border-0 border-b border-line" />
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <p className="truncate text-xs text-fg-4">{p.category_name}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-fg">{p.name}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span className="tabular text-sm font-semibold text-fg">{formatMVR(p.actual_listed_price)}</span>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table
            rows={list}
            rowKey={p => p.id}
            onRowClick={open}
            columns={[
              {
                key: 'product',
                header: 'Product',
                primary: true,
                render: p => (
                  <div className="flex items-center gap-3">
                    <ProductThumb product={p} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{p.name}</p>
                      <p className="truncate text-fg-3">{p.sku}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'category', header: 'Category', hideOnMobile: true, render: p => p.category_name },
              { key: 'price', header: 'Price', align: 'right', render: p => <span className="tabular font-medium text-fg">{formatMVR(p.actual_listed_price)}</span> },
              ...(showCost
                ? [
                    { key: 'cost', header: 'Cost', align: 'right' as const, render: (p: Product) => <span className="tabular">{formatMVR(p.wholesale_unit_cost)}</span> },
                    {
                      key: 'margin',
                      header: 'Margin',
                      align: 'right' as const,
                      render: (p: Product) =>
                        p.actual_listed_price > 0 ? (
                          <span className="tabular">{(((p.actual_listed_price - p.wholesale_unit_cost) / p.actual_listed_price) * 100).toFixed(1)}%</span>
                        ) : (
                          '—'
                        ),
                    },
                  ]
                : []),
              {
                key: 'stock',
                header: 'Stock',
                align: 'right',
                render: p => {
                  const s = stockState(p);
                  return <Badge color={s.color}>{s.label}</Badge>;
                },
              },
            ]}
          />
        </Card>
      )}

      {adding && (
        <ProductFormModal
          open
          onClose={saved => {
            setAdding(false);
            if (saved) navigate(`/products/${saved.id}`);
          }}
        />
      )}
      {receiving && <ReceiveStockModal open onClose={() => setReceiving(false)} />}
    </>
  );
}
