import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Columns3, List, Plus, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { useOrders } from '../../app/queries';
import { formatMVR, formatMaldivesDate } from '../../lib/formatters';
import type { Order } from '../../types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Skeleton, Table, Tabs, cn } from '../../ui';
import { OrderDetail } from './OrderDetail';
import { BOARD_COLUMNS, CHANNELS, PAYMENT_STATUS, STAGES, awaitingReturn } from './meta';

type ListFilter = 'all' | 'active' | 'courier' | 'delivered' | 'closed' | 'unpaid';

const FILTERS: Record<ListFilter, (o: Order) => boolean> = {
  all: () => true,
  active: o => ['new', 'packed'].includes(o.stage),
  courier: o => o.stage === 'handed_over',
  delivered: o => o.stage === 'delivered',
  closed: o => ['failed', 'cancelled', 'returned'].includes(o.stage),
  unpaid: o => o.payment_status !== 'paid' && o.stage !== 'cancelled',
};

function relativeAge(date: string) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : formatMaldivesDate(date);
}

function BoardCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const items = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring w-full cursor-pointer rounded-lg border border-line bg-surface p-3.5 text-left shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">{order.order_number}</span>
        <span className="text-xs text-fg-4">{relativeAge(order.created_at)}</span>
      </div>
      <p className="mt-1 truncate text-sm text-fg-2">{order.buyer_name}</p>
      <p className="truncate text-xs text-fg-4">
        {items} item{items === 1 ? '' : 's'} · {CHANNELS[order.channel]}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="tabular text-sm font-semibold text-fg">{formatMVR(order.total_amount)}</span>
        {awaitingReturn(order) ? (
          <Badge color="warning">Return pending</Badge>
        ) : ['failed', 'cancelled', 'returned'].includes(order.stage) ? (
          <Badge color={STAGES[order.stage].color}>{STAGES[order.stage].label}</Badge>
        ) : (
          <Badge color={PAYMENT_STATUS[order.payment_status].color}>{PAYMENT_STATUS[order.payment_status].label}</Badge>
        )}
      </div>
    </button>
  );
}

export function OrdersPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [params, setParams] = useSearchParams();
  const orders = useOrders();
  const [query, setQuery] = useState('');

  const defaultView = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'list' : 'board';
  const view = (params.get('view') as 'board' | 'list') || defaultView;
  const filter = (params.get('filter') as ListFilter) || 'all';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  const all = orders.data || [];
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(o =>
      [o.order_number, o.buyer_name, o.buyer_phone, o.buyer_instagram, ...o.items.map(i => i.product_name)].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [all, query]);

  const selected = orderId ? all.find(o => o.id === orderId) : undefined;
  const open = (o: Order) => navigate(`/orders/${o.id}${params.toString() ? `?${params}` : ''}`);
  const close = () => navigate(`/orders${params.toString() ? `?${params}` : ''}`);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Track every order from DM to doorstep."
        actions={
          can.createOrders(role) && (
            <span className="hidden lg:block">
              <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/orders/new')}>
                New order
              </Button>
            </span>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Search orders"
          placeholder="Search order, buyer, phone or product"
          value={query}
          onChange={e => setQuery(e.target.value)}
          leading={<Search className="h-5 w-5" />}
          containerClassName="sm:w-96"
        />
        <Segmented
          items={[
            { key: 'board', label: 'Board', icon: <Columns3 className="h-4 w-4" /> },
            { key: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
          ]}
          value={view}
          onChange={v => setParam('view', v)}
        />
      </div>

      {orders.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="No orders yet"
            description="Create an order when a buyer messages you on Instagram, Viber, WhatsApp or SMS."
            action={
              can.createOrders(role) && (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orders/new')}>
                  New order
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'board' ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {BOARD_COLUMNS.map(col => {
            let items = searched.filter(o => col.stages.includes(o.stage));
            if (col.key === 'done' || col.key === 'closed') {
              // Keep finished columns short: anything needing action first, then the most recent
              items = [...items.filter(awaitingReturn), ...items.filter(o => !awaitingReturn(o)).slice(0, 12)];
            }
            return (
              <section key={col.key} className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-subtle p-3 ring-1 ring-inset ring-line sm:w-auto sm:min-w-[216px] sm:max-w-none sm:flex-1">
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-fg">{col.label}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-fg-3 ring-1 ring-inset ring-line">
                    {searched.filter(o => col.stages.includes(o.stage)).length}
                  </span>
                </header>
                <div className="flex flex-col gap-2.5">
                  {items.map(o => (
                    <BoardCard key={o.id} order={o} onOpen={() => open(o)} />
                  ))}
                  {items.length === 0 && <p className="px-1 py-6 text-center text-sm text-fg-4">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="px-4 pt-3 sm:px-5">
            <Tabs
              value={filter}
              onChange={f => setParam('filter', f)}
              items={(
                [
                  ['all', 'All'],
                  ['active', 'To pack'],
                  ['courier', 'With courier'],
                  ['delivered', 'Delivered'],
                  ['unpaid', 'Unpaid'],
                  ['closed', 'Failed & cancelled'],
                ] as Array<[ListFilter, string]>
              ).map(([key, label]) => ({ key, label, count: searched.filter(FILTERS[key]).length }))}
            />
          </div>
          <Table
            rows={searched.filter(FILTERS[filter])}
            rowKey={o => o.id}
            onRowClick={open}
            empty={<p className="px-5 py-12 text-center text-sm text-fg-3">No orders match.</p>}
            columns={[
              {
                key: 'order',
                header: 'Order',
                primary: true,
                render: o => (
                  <div className="flex items-center justify-between gap-3 md:block">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{o.order_number}</p>
                      <p className="truncate text-fg-3">{o.buyer_name}</p>
                    </div>
                    <span className="md:hidden">
                      <Badge color={STAGES[o.stage].color} dot>
                        {STAGES[o.stage].label}
                      </Badge>
                    </span>
                  </div>
                ),
              },
              { key: 'date', header: 'Date', render: o => formatMaldivesDate(o.order_date || o.created_at) },
              { key: 'channel', header: 'Channel', hideOnMobile: true, render: o => CHANNELS[o.channel] },
              {
                key: 'stage',
                header: 'Status',
                hideOnMobile: true,
                render: o => (
                  <span className="flex flex-wrap gap-1.5">
                    <Badge color={STAGES[o.stage].color} dot>
                      {STAGES[o.stage].label}
                    </Badge>
                    {awaitingReturn(o) && <Badge color="warning">Return pending</Badge>}
                  </span>
                ),
              },
              {
                key: 'payment',
                header: 'Payment',
                render: o => <Badge color={PAYMENT_STATUS[o.payment_status].color}>{PAYMENT_STATUS[o.payment_status].label}</Badge>,
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: o => <span className={cn('tabular font-medium text-fg')}>{formatMVR(o.total_amount)}</span>,
              },
            ]}
          />
        </Card>
      )}

      {selected && <OrderDetail order={selected} onClose={close} />}
    </>
  );
}
