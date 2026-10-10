import React, { useState } from 'react';
import { Building2, Pencil, Plus, Tag, Trash2, Truck } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { keys, useAction, useCategories, useCouriers, useProducts, useSuppliers } from '../../app/queries';
import { api } from '../../lib/api';
import { formatMVR } from '../../lib/formatters';
import type { Category, CourierServiceType, DeliveryService, Supplier } from '../../types';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, Toggle } from '../../ui';

type Tab = 'suppliers' | 'categories' | 'couriers';

const COURIER_TYPES: Record<CourierServiceType, string> = {
  courier_company: 'Courier company',
  independent_rider: 'Independent rider',
  in_house: 'Our own rider',
};

function SupplierModal({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    instagram_or_website: supplier?.instagram_or_website || '',
    address: supplier?.address || '',
    payment_details: supplier?.payment_details || '',
    notes: supplier?.notes || '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = useAction(() => (supplier ? api.updateSupplier(supplier.id, form) : api.createSupplier(form)), {
    invalidate: [keys.suppliers, keys.products],
    success: s => `${s.name} saved.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Building2 className="h-5 w-5" />}
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate(undefined)}>
            Save supplier
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Supplier name" required value={form.name} onChange={set('name')} containerClassName="sm:col-span-2" />
        <Input label="Contact person" value={form.contact_person} onChange={set('contact_person')} />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Instagram or website" value={form.instagram_or_website} onChange={set('instagram_or_website')} />
        <Input label="Address" value={form.address} onChange={set('address')} containerClassName="sm:col-span-2" />
        <Textarea label="Payment details" rows={2} value={form.payment_details} onChange={set('payment_details')} containerClassName="sm:col-span-2" placeholder="Bank account, terms…" />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} containerClassName="sm:col-span-2" />
      </div>
    </Modal>
  );
}

function CategoryModal({ category, onClose }: { category?: Category; onClose: () => void }) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const save = useAction(
    () => (category ? api.updateCategory(category.id, { name, description }) : api.createCategory(name, description)),
    { invalidate: [keys.categories, keys.products], success: c => `Category "${c.name}" saved.`, onSuccess: onClose }
  );
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      icon={<Tag className="h-5 w-5" />}
      title={category ? 'Rename category' : 'New category'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
        <Textarea label="Description" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}

function CourierModal({ courier, onClose }: { courier?: DeliveryService; onClose: () => void }) {
  const [form, setForm] = useState({
    name: courier?.name || '',
    phone: courier?.phone || '',
    default_rate: String(courier?.default_rate ?? 30),
    service_type: courier?.service_type || ('courier_company' as CourierServiceType),
    coverage_area: courier?.coverage_area || '',
    notes: courier?.notes || '',
    is_active: courier?.is_active ?? true,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const body = () => ({ ...form, default_rate: Number(form.default_rate) || 0 });
  const save = useAction(() => (courier ? api.updateDeliveryService(courier.id, body()) : api.createDeliveryService(body())), {
    invalidate: [keys.couriers],
    success: c => `${c.name} saved.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      icon={<Truck className="h-5 w-5" />}
      title={courier ? 'Edit courier' : 'Add courier'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate(undefined)}>
            Save courier
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={form.name} onChange={set('name')} containerClassName="sm:col-span-2" />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Input label="Usual charge" type="number" min="0" step="0.01" value={form.default_rate} onChange={set('default_rate')} leading={<span className="text-xs">MVR</span>} />
        <Select label="Type" value={form.service_type} onChange={set('service_type')}>
          {(Object.keys(COURIER_TYPES) as CourierServiceType[]).map(t => (
            <option key={t} value={t}>
              {COURIER_TYPES[t]}
            </option>
          ))}
        </Select>
        <Input label="Coverage" value={form.coverage_area} onChange={set('coverage_area')} placeholder="e.g. Malé & Hulhumalé" />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} containerClassName="sm:col-span-2" />
        <div className="sm:col-span-2">
          <Toggle checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} label="Available for new orders" />
        </div>
      </div>
    </Modal>
  );
}

export function SuppliersPage() {
  const { role } = useAuth();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const couriers = useCouriers();
  const products = useProducts();
  const showSuppliers = can.viewSuppliers(role);
  const showCategories = can.viewSuppliers(role) || can.manageCatalog(role);
  const showCatalog = showSuppliers || showCategories;
  const [tab, setTab] = useState<Tab>(showSuppliers ? 'suppliers' : showCategories ? 'categories' : 'couriers');
  const [editing, setEditing] = useState<{ kind: Tab; item?: any } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'category' | 'courier'; id: string; name: string } | null>(null);

  const productCount = (key: 'supplier_id' | 'category_id', id: string) => (products.data || []).filter(p => p[key] === id).length;

  const remove = useAction(
    async (d: { kind: 'category' | 'courier'; id: string }) => {
      if (d.kind === 'category') await api.deleteCategory(d.id);
      else await api.deleteDeliveryService(d.id);
    },
    { invalidate: [keys.categories, keys.couriers], success: 'Deleted.', onSuccess: () => setDeleting(null) }
  );

  const addLabel = tab === 'suppliers' ? 'Add supplier' : tab === 'categories' ? 'New category' : 'Add courier';
  const canAdd =
    tab === 'couriers' ? can.manageCouriers(role) : tab === 'suppliers' ? can.manageSuppliers(role) : can.manageCatalog(role);

  return (
    <>
      <PageHeader
        title={showCatalog ? 'Suppliers & couriers' : 'Couriers'}
        description="The people you buy from and the riders who deliver for you."
        actions={
          canAdd && (
            <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setEditing({ kind: tab })}>
              {addLabel}
            </Button>
          )
        }
      />
      {showCatalog && (
        <Tabs
          className="mb-6"
          value={tab}
          onChange={setTab}
          items={[
            ...(showSuppliers ? [{ key: 'suppliers' as Tab, label: 'Suppliers', count: suppliers.data?.length }] : []),
            ...(showCategories ? [{ key: 'categories' as Tab, label: 'Categories', count: categories.data?.length }] : []),
            { key: 'couriers' as Tab, label: 'Couriers', count: couriers.data?.length },
          ]}
        />
      )}

      <Card>
        {tab === 'suppliers' && (
          <Table
            rows={suppliers.data || []}
            rowKey={s => s.id}
            onRowClick={can.manageSuppliers(role) ? s => setEditing({ kind: 'suppliers', item: s }) : undefined}
            empty={<EmptyState icon={<Building2 className="h-6 w-6" />} title="No suppliers yet" description="Add the wholesalers you buy stock from." />}
            columns={[
              {
                key: 'name',
                header: 'Supplier',
                primary: true,
                render: s => (
                  <span>
                    <span className="block font-medium text-fg">{s.name}</span>
                    <span className="text-fg-3">{s.contact_person || s.instagram_or_website || '—'}</span>
                  </span>
                ),
              },
              { key: 'phone', header: 'Phone', render: s => s.phone || '—' },
              { key: 'email', header: 'Email', hideOnMobile: true, render: s => s.email || '—' },
              { key: 'products', header: 'Products', align: 'right', render: s => <span className="tabular">{productCount('supplier_id', s.id)}</span> },
            ]}
          />
        )}

        {tab === 'categories' && (
          <Table
            rows={categories.data || []}
            rowKey={c => c.id}
            empty={<EmptyState icon={<Tag className="h-6 w-6" />} title="No categories yet" />}
            columns={[
              {
                key: 'name',
                header: 'Category',
                primary: true,
                render: c => (
                  <span>
                    <span className="block font-medium text-fg">{c.name}</span>
                    {c.description && <span className="text-fg-3">{c.description}</span>}
                  </span>
                ),
              },
              { key: 'products', header: 'Products', align: 'right', render: c => <span className="tabular">{productCount('category_id', c.id)}</span> },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                render: c =>
                  can.manageCatalog(role) && (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="tertiary" iconOnly icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing({ kind: 'categories', item: c })}>
                        Rename {c.name}
                      </Button>
                      <Button size="sm" variant="tertiary" iconOnly icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting({ kind: 'category', id: c.id, name: c.name })}>
                        Delete {c.name}
                      </Button>
                    </span>
                  ),
              },
            ]}
          />
        )}

        {tab === 'couriers' && (
          <Table
            rows={couriers.data || []}
            rowKey={c => c.id}
            onRowClick={can.manageCouriers(role) ? c => setEditing({ kind: 'couriers', item: c }) : undefined}
            empty={<EmptyState icon={<Truck className="h-6 w-6" />} title="No couriers yet" />}
            columns={[
              {
                key: 'name',
                header: 'Courier',
                primary: true,
                render: c => (
                  <span className="flex items-center justify-between gap-3 md:block">
                    <span>
                      <span className="block font-medium text-fg">{c.name}</span>
                      <span className="text-fg-3">{COURIER_TYPES[c.service_type]}</span>
                    </span>
                    {!c.is_active && (
                      <span className="md:hidden">
                        <Badge>Paused</Badge>
                      </span>
                    )}
                  </span>
                ),
              },
              { key: 'phone', header: 'Phone', render: c => c.phone || '—' },
              { key: 'coverage', header: 'Coverage', hideOnMobile: true, render: c => c.coverage_area || '—' },
              { key: 'rate', header: 'Usual charge', align: 'right', render: c => <span className="tabular">{formatMVR(c.default_rate)}</span> },
              {
                key: 'status',
                header: 'Status',
                hideOnMobile: true,
                render: c => (c.is_active ? <Badge color="success" dot>Available</Badge> : <Badge>Paused</Badge>),
              },
              ...(can.deleteCouriers(role)
                ? [
                    {
                      key: 'delete',
                      header: <span className="sr-only">Delete</span>,
                      align: 'right' as const,
                      hideOnMobile: true,
                      render: (c: DeliveryService) => (
                        <Button
                          size="sm"
                          variant="tertiary"
                          iconOnly
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={e => {
                            e.stopPropagation();
                            setDeleting({ kind: 'courier', id: c.id, name: c.name });
                          }}
                        >
                          Delete {c.name}
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Card>

      {editing?.kind === 'suppliers' && <SupplierModal supplier={editing.item} onClose={() => setEditing(null)} />}
      {editing?.kind === 'categories' && <CategoryModal category={editing.item} onClose={() => setEditing(null)} />}
      {editing?.kind === 'couriers' && <CourierModal courier={editing.item} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal
          open
          size="sm"
          onClose={() => setDeleting(null)}
          title={`Delete ${deleting.name}?`}
          description={deleting.kind === 'courier' ? 'Past orders keep the courier name they were handed to.' : 'Only empty categories can be deleted.'}
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" loading={remove.isPending} onClick={() => remove.mutate(deleting)}>
                Delete
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
