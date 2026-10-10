import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Pencil, Phone, Plus, Search, UserPlus, UsersRound } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { keys, useAction, useBuyers, useOrders } from '../../app/queries';
import { api } from '../../lib/api';
import { formatMVR, formatMaldivesDate } from '../../lib/formatters';
import type { Buyer } from '../../types';
import { Avatar, Badge, Button, Card, DetailRow, EmptyState, Input, Modal, PageHeader, SlideOver, Skeleton, Table, Textarea } from '../../ui';
import { STAGES } from '../orders/meta';
import { AddressFields, type AddressValue } from './AddressFields';

function BuyerFormModal({ buyer, open, onClose }: { buyer?: Buyer; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(buyer?.name || '');
  const [phone, setPhone] = useState(buyer?.phone || '');
  const [instagram, setInstagram] = useState(buyer?.instagram_handle || '');
  const [notes, setNotes] = useState(buyer?.notes || '');
  const [address, setAddress] = useState<AddressValue>({
    delivery_address: buyer?.delivery_address || '',
    boat_name: buyer?.boat_name,
    boat_phone: buyer?.boat_phone,
    boat_jetty: buyer?.boat_jetty,
    atoll_code: buyer?.atoll_code,
    island_name: buyer?.island_name,
  });
  const payload = () => ({
    name: name.trim(),
    phone: phone.trim(),
    instagram_handle: instagram.trim().replace(/^@/, '') || undefined,
    notes: notes.trim(),
    ...address,
  });
  const save = useAction(() => (buyer ? api.updateBuyer(buyer.id, payload()) : api.createBuyer(payload())), {
    invalidate: [keys.buyers, keys.orders, keys.addresses],
    success: b => (buyer ? `${b.name} updated.` : `${b.name} added.`),
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<UserPlus className="h-5 w-5" />}
      title={buyer ? 'Edit buyer' : 'Add buyer'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!name.trim() || !phone.trim() || !address.delivery_address.trim()}
            onClick={() => save.mutate(undefined)}
          >
            {buyer ? 'Save changes' : 'Add buyer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
          <Input label="Phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+960 7xx xxxx" />
          <Input label="Instagram handle" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" containerClassName="sm:col-span-2" />
        </div>
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold text-fg">Delivery address</p>
          <AddressFields value={address} onChange={setAddress} />
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferences, sizes, best time to call…" />
      </div>
    </Modal>
  );
}

function BuyerPanel({ buyer, onClose }: { buyer: Buyer; onClose: () => void }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const orders = useOrders();
  const [editing, setEditing] = useState(false);
  const history = (orders.data || []).filter(o => o.buyer_id === buyer.id);

  return (
    <>
      <SlideOver
        open
        onClose={onClose}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={buyer.name} />
            {buyer.name}
          </span>
        }
        footer={
          can.editBuyers(role) && (
            <>
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/orders/new?buyer=${buyer.id}`)}>
                New order
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-1.5 text-sm text-fg-3">
          <a href={`tel:${buyer.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-fg">
            <Phone className="h-4 w-4" /> {buyer.phone}
          </a>
          {buyer.instagram_handle && <span>@{buyer.instagram_handle.replace(/^@/, '')}</span>}
          <span className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {buyer.delivery_address}
          </span>
        </div>
        {buyer.notes && <p className="mt-4 rounded-lg bg-subtle p-3 text-sm text-fg-2">{buyer.notes}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line p-3">
            <dt className="text-xs text-fg-4">Orders</dt>
            <dd className="tabular mt-1 text-lg font-semibold text-fg">{buyer.orders_count || 0}</dd>
          </div>
          <div className="rounded-lg border border-line p-3">
            <dt className="text-xs text-fg-4">Total spent</dt>
            <dd className="tabular mt-1 text-lg font-semibold text-fg">{formatMVR(buyer.total_spent || 0)}</dd>
          </div>
        </dl>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-fg">Order history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-fg-3">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {history.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left text-sm hover:bg-hover"
                >
                  <span>
                    <span className="block font-medium text-fg">{o.order_number}</span>
                    <span className="text-fg-3">{formatMaldivesDate(o.order_date || o.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge color={STAGES[o.stage].color} dot>
                      {STAGES[o.stage].label}
                    </Badge>
                    <span className="tabular font-medium text-fg">{formatMVR(o.total_amount)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-5">
          <DetailRow label="Customer since">{formatMaldivesDate(buyer.created_at)}</DetailRow>
        </dl>
      </SlideOver>
      {editing && <BuyerFormModal buyer={buyer} open onClose={() => setEditing(false)} />}
    </>
  );
}

export function BuyersPage() {
  const { role } = useAuth();
  const buyers = useBuyers();
  const orders = useOrders();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lastOrder = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders.data || []) {
      const d = o.order_date || o.created_at;
      if (!map.has(o.buyer_id) || map.get(o.buyer_id)! < d) map.set(o.buyer_id, d);
    }
    return map;
  }, [orders.data]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...(buyers.data || [])].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
    return q ? all.filter(b => [b.name, b.phone, b.instagram_handle, b.delivery_address].some(v => (v || '').toLowerCase().includes(q))) : all;
  }, [buyers.data, query]);

  const selected = (buyers.data || []).find(b => b.id === selectedId);

  return (
    <>
      <PageHeader
        title="Buyers"
        description="Everyone who has ordered from Hali, with their addresses and history."
        actions={
          can.editBuyers(role) && (
            <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
              Add buyer
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm font-semibold text-fg">
            {buyers.data?.length ?? 0} buyer{buyers.data?.length === 1 ? '' : 's'}
          </p>
          <Input
            aria-label="Search buyers"
            placeholder="Search name, phone, Instagram or address"
            value={query}
            onChange={e => setQuery(e.target.value)}
            leading={<Search className="h-5 w-5" />}
            containerClassName="sm:w-96"
          />
        </div>
        {buyers.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <Table
            rows={list}
            rowKey={b => b.id}
            onRowClick={b => setSelectedId(b.id)}
            empty={
              <EmptyState
                icon={<UsersRound className="h-6 w-6" />}
                title={query ? 'No buyers match' : 'No buyers yet'}
                description={query ? 'Try a different name or number.' : 'Buyers are added when you create their first order, or here.'}
              />
            }
            columns={[
              {
                key: 'name',
                header: 'Buyer',
                primary: true,
                render: b => (
                  <div className="flex items-center gap-3">
                    <Avatar name={b.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{b.name}</p>
                      <p className="truncate text-fg-3">{b.instagram_handle ? `@${b.instagram_handle.replace(/^@/, '')}` : b.phone}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'phone', header: 'Phone', render: b => b.phone },
              {
                key: 'address',
                header: 'Address',
                hideOnMobile: true,
                className: 'max-w-xs',
                render: b => <span className="line-clamp-1">{b.delivery_address}</span>,
              },
              { key: 'orders', header: 'Orders', align: 'right', render: b => <span className="tabular">{b.orders_count || 0}</span> },
              {
                key: 'spent',
                header: 'Total spent',
                align: 'right',
                render: b => <span className="tabular font-medium text-fg">{formatMVR(b.total_spent || 0)}</span>,
              },
              {
                key: 'last',
                header: 'Last order',
                hideOnMobile: true,
                render: b => (lastOrder.get(b.id) ? formatMaldivesDate(lastOrder.get(b.id)!) : '—'),
              },
            ]}
          />
        )}
      </Card>
      {adding && <BuyerFormModal open onClose={() => setAdding(false)} />}
      {selected && <BuyerPanel buyer={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
