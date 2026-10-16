import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Megaphone, PackagePlus, Pencil, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { useBatches, useMovements, useProducts } from '../../app/queries';
import { formatMVR, formatMaldivesDate } from '../../lib/formatters';
import { Badge, Button, Card, CardHeader, DetailRow, EmptyState, PageHeader, Skeleton, Table, Tabs, cn } from '../../ui';
import { CorrectStockModal, ProductFormModal, ReceiveStockModal } from './ProductForms';
import { MovementsTable } from './MovementsTable';
import { ProductThumb } from './ProductThumb';
import { stockState } from './meta';

type Tab = 'overview' | 'batches' | 'history';

export function ProductDetailPage() {
  const { productId } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const products = useProducts();
  const product = (products.data || []).find(p => p.id === productId);
  const batches = useBatches(productId);
  const movements = useMovements(productId);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<'edit' | 'receive' | 'correct' | null>(null);
  const [photo, setPhoto] = useState(0);

  if (products.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        description="It may have been removed."
        action={<Button onClick={() => navigate('/products')}>Back to products</Button>}
      />
    );
  }

  const s = stockState(product);
  const showCost = can.seeCosts(role);
  const margin = product.actual_listed_price > 0 ? ((product.actual_listed_price - product.wholesale_unit_cost) / product.actual_listed_price) * 100 : 0;
  const images = product.images || [];
  const sold = (movements.data || []).filter(m => m.movement_type === 'sold').reduce((sum, m) => sum - m.quantity_delta, 0);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/products" className="inline-flex items-center gap-1.5 font-semibold text-fg-3 hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> Products
          </Link>
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{product.sku}</span>
            <Badge color={s.color}>{s.label}</Badge>
          </span>
        }
        actions={
          <>
            {can.planPosts(role) && (
              <Button icon={<Megaphone className="h-4 w-4" />} onClick={() => navigate(`/social?product=${product.id}`)}>
                Plan post
              </Button>
            )}
            {can.manageCatalog(role) && (
              <>
                <Button icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setModal('correct')}>
                  Correct count
                </Button>
                <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setModal('edit')}>
                  Edit
                </Button>
                <Button variant="primary" icon={<PackagePlus className="h-4 w-4" />} onClick={() => setModal('receive')}>
                  Receive stock
                </Button>
              </>
            )}
          </>
        }
      />

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'batches', label: 'Purchase batches', count: batches.data?.length },
          { key: 'history', label: 'Stock history', count: movements.data?.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="p-3">
            <ProductThumb product={{ ...product, images: images.length ? [images[photo] || images[0]] : [] }} className="aspect-square w-full" />
            {images.length > 1 && (
              <div className="mt-3 flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setPhoto(i)}
                    className={cn('h-14 w-14 cursor-pointer overflow-hidden rounded-md border', i === photo ? 'border-brand-500' : 'border-line')}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Listed price', formatMVR(product.actual_listed_price)],
                ['Available', String(product.available_stock)],
                ['Sold (all time)', String(sold)],
                ...(showCost ? [['Margin', `${margin.toFixed(1)}%`]] : [['Alert at', String(product.low_stock_threshold)]]),
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <p className="text-sm text-fg-3">{label}</p>
                  <p className="tabular mt-1 text-xl font-semibold text-fg">{value}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader title="Details" />
              <dl className="divide-y divide-line px-5 py-1">
                <DetailRow label="Shop">{product.shop_name || '—'}</DetailRow>
                {product.brand && <DetailRow label="Brand">{product.brand}</DetailRow>}
                {product.model && <DetailRow label="Model">{product.model}</DetailRow>}
                {product.size && <DetailRow label="Size">{product.size}</DetailRow>}
                <DetailRow label="Category">{product.category_name || '—'}</DetailRow>
                <DetailRow label="Supplier">{product.supplier_name || '—'}</DetailRow>
                {showCost && (
                  <>
                    <DetailRow label="Wholesale unit cost">{formatMVR(product.wholesale_unit_cost)}</DetailRow>
                    <DetailRow label="Pricing rule">
                      {product.pricing_rule === 'gross_margin' ? 'Gross margin' : 'Markup on cost'} · {product.pricing_rule_percentage}%
                    </DetailRow>
                    <DetailRow label="Suggested price">{formatMVR(product.suggested_price)}</DetailRow>
                  </>
                )}
                <DetailRow label="Low-stock alert at">{product.low_stock_threshold} units</DetailRow>
                <DetailRow label="Status">{product.is_active ? 'Active' : 'Inactive'}</DetailRow>
                <DetailRow label="Added">{formatMaldivesDate(product.created_at)}</DetailRow>
              </dl>
              {product.description && <p className="border-t border-line px-5 py-4 text-sm text-fg-3">{product.description}</p>}
            </Card>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <Card>
          <Table
            rows={[...(batches.data || [])].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))}
            rowKey={b => b.id}
            empty={<p className="px-5 py-12 text-center text-sm text-fg-3">No purchase batches recorded.</p>}
            columns={[
              {
                key: 'batch',
                header: 'Batch',
                primary: true,
                render: b => (
                  <span>
                    <span className="block font-medium text-fg">{b.batch_number}</span>
                    <span className="text-fg-3">{b.supplier_name || '—'}</span>
                  </span>
                ),
              },
              { key: 'date', header: 'Purchased', render: b => formatMaldivesDate(b.purchase_date) },
              { key: 'qty', header: 'Quantity', align: 'right', render: b => <span className="tabular">{b.quantity}</span> },
              ...(showCost
                ? [
                    { key: 'unit', header: 'Unit cost', align: 'right' as const, render: (b: any) => <span className="tabular">{formatMVR(b.unit_cost)}</span> },
                    {
                      key: 'landed',
                      header: 'Landed unit cost',
                      align: 'right' as const,
                      render: (b: any) => (
                        <span className="tabular font-medium text-fg">
                          {formatMVR(b.unit_cost + ((b.shipping_cost || 0) + (b.other_costs || 0)) / Math.max(1, b.quantity))}
                        </span>
                      ),
                    },
                  ]
                : []),
              { key: 'notes', header: 'Notes', hideOnMobile: true, render: b => <span className="line-clamp-1">{b.notes || '—'}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <MovementsTable rows={movements.data || []} />
        </Card>
      )}

      {modal === 'edit' && <ProductFormModal product={product} open onClose={() => setModal(null)} />}
      {modal === 'receive' && <ReceiveStockModal product={product} open onClose={() => setModal(null)} />}
      {modal === 'correct' && <CorrectStockModal product={product} open onClose={() => setModal(null)} />}
    </>
  );
}
