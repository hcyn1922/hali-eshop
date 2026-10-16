import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { STOCK_KEYS, keys, useAction, useShops } from '../../app/queries';
import { api } from '../../lib/api';
import type { Shop } from '../../types';
import { Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton, Textarea } from '../../ui';

function ShopModal({ shop, onClose }: { shop?: Shop; onClose: () => void }) {
  const [name, setName] = useState(shop?.name || '');
  const [description, setDescription] = useState(shop?.description || '');
  const save = useAction(() => (shop ? api.updateShop(shop.id, { name, description }) : api.createShop(name, description)), {
    invalidate: [keys.shops, keys.products],
    success: s => `Shop "${s.name}" saved.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      icon={<Store className="h-5 w-5" />}
      title={shop ? 'Edit shop' : 'New shop'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (name.trim()) save.mutate(undefined); }}>
        <Input label="Shop name" required autoFocus maxLength={60} value={name} onChange={e => setName(e.target.value)} />
        <Textarea label="Notes" rows={2} maxLength={300} value={description} onChange={e => setDescription(e.target.value)} hint="Optional, e.g. what this shop sells." />
      </form>
    </Modal>
  );
}

/** The owner's storefronts. Every product belongs to one shop. */
export function ShopsPage() {
  const shops = useShops();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Shop | 'new' | null>(null);
  const remove = useAction((s: Shop) => api.deleteShop(s.id), { invalidate: [keys.shops, ...STOCK_KEYS], success: 'Shop removed.' });
  const list = shops.data || [];

  return (
    <>
      <PageHeader
        title="Shops"
        description="Your storefronts. Every product belongs to one shop, and the Products page can show one shop at a time."
        actions={
          <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setEditing('new')}>
            New shop
          </Button>
        }
      />
      {shops.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Store className="h-6 w-6" />} title="No shops yet" description="Add a shop to group your products." />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map(s => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-2 ring-1 ring-inset ring-line">
                    <Store className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-fg">{s.name}</h2>
                    {s.description && <p className="truncate text-sm text-fg-3">{s.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="tertiary" iconOnly icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(s)}>
                    Edit {s.name}
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    iconOnly
                    icon={<Trash2 className="h-4 w-4" />}
                    disabled={(s.product_count || 0) > 0 || list.length === 1}
                    title={(s.product_count || 0) > 0 ? 'Move its products to another shop first' : list.length === 1 ? 'Keep at least one shop' : undefined}
                    onClick={() => window.confirm(`Remove the shop "${s.name}"?`) && remove.mutate(s)}
                  >
                    Remove {s.name}
                  </Button>
                </div>
              </div>
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
              <Button className="mt-4 self-start" variant="secondary" size="sm" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/products?shop=${s.id}`)}>
                View products
              </Button>
            </Card>
          ))}
        </div>
      )}
      {editing && <ShopModal shop={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
