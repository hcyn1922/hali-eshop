import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Store } from 'lucide-react';
import { useShops } from '../../app/queries';
import type { Shop } from '../../types';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Skeleton } from '../../ui';
import { ShopDetailsForm, ShopLogo } from './ShopDetailsForm';

/** New or edit shop: the full details form in a window, with a save bar that stays in view. */
export function ShopModal({ shop, onClose }: { shop?: Shop; onClose: (saved?: Shop) => void }) {
  return (
    <Modal open size="lg" onClose={() => onClose()} icon={<Store className="h-5 w-5" />} title={shop ? `Edit ${shop.name}` : 'New shop'} description="Shown on this shop's invoices.">
      <ShopDetailsForm
        shop={shop}
        onSaved={s => onClose(s)}
        footer={({ submit, busy, valid }) => (
          <div className="pb-safe sticky -bottom-5 z-10 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
            <Button onClick={() => onClose()}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>
              {shop ? 'Save shop' : 'Add shop'}
            </Button>
          </div>
        )}
      />
    </Modal>
  );
}

export const isGstRegistered = (shop?: Pick<Shop, 'gst_tin'>) => Boolean(shop?.gst_tin?.trim());

/** The owner's storefronts. Every product belongs to one shop. */
export function ShopsPage() {
  const shops = useShops();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const list = shops.data || [];

  return (
    <>
      <PageHeader
        title="Shops"
        description="Your storefronts. Each has its own logo, contact details, GST TIN and bank accounts for its invoices."
        actions={
          <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
            New shop
          </Button>
        }
      />
      {shops.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Store className="h-6 w-6" />} title="No shops yet" description="Add a shop to group your products." />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map(s => (
            <Card key={s.id} className="flex flex-col p-5">
              <Link to={`/shops/${s.id}`} className="focus-ring -m-1 flex items-center gap-4 rounded-lg p-1">
                <ShopLogo shop={s} className="h-14 w-24 shrink-0" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-fg">{s.name}</h2>
                  {s.tagline && <p className="truncate text-sm text-fg-3">{s.tagline}</p>}
                  <div className="mt-1.5">
                    {isGstRegistered(s) ? <Badge color="success">GST registered</Badge> : <Badge>Not GST registered</Badge>}
                  </div>
                </div>
              </Link>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-subtle px-3.5 py-3 ring-1 ring-inset ring-line">
                  <dt className="text-xs text-fg-3">Products</dt>
                  <dd className="tabular mt-0.5 text-xl font-semibold text-fg">{s.product_count ?? 0}</dd>
                </div>
                <div className="rounded-lg bg-subtle px-3.5 py-3 ring-1 ring-inset ring-line">
                  <dt className="text-xs text-fg-3">Units in stock</dt>
                  <dd className="tabular mt-0.5 text-xl font-semibold text-fg">{s.units_in_stock ?? 0}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => navigate(`/shops/${s.id}`)}>
                  Shop details
                </Button>
                <Button size="sm" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/products?shop=${s.id}`)}>
                  View products
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {adding && <ShopModal onClose={saved => { setAdding(false); if (saved) navigate(`/shops/${saved.id}`); }} />}
    </>
  );
}
