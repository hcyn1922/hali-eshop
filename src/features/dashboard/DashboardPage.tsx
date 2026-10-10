import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Boxes, PackageOpen, Plus, ShoppingBag, Sparkles, Truck, Wallet } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { ORDER_KEYS, STOCK_KEYS, keys, useAction, useMetrics, useOrders, useProducts, useStatus } from '../../app/queries';
import { api } from '../../lib/api';
import { formatMVR, formatMaldivesDate } from '../../lib/formatters';
import { Badge, BarChart, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatCard, Table } from '../../ui';
import { CHANNELS, STAGES, awaitingReturn, balanceDue } from '../orders/meta';
import type { Order } from '../../types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Product revenue per day for the last 14 days (cancelled/failed/returned excluded). */
function dailySales(orders: Order[]) {
  const days: { key: string; label: string; tooltip: string; value: number }[] = [];
  const index = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    index.set(key, days.length);
    days.push({
      key,
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tooltip: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      value: 0,
    });
  }
  for (const o of orders) {
    if (['cancelled', 'failed', 'returned'].includes(o.stage)) continue;
    const key = new Date(o.order_date || o.created_at);
    key.setHours(0, 0, 0, 0);
    const i = index.get(key.toISOString().slice(0, 10));
    if (i !== undefined) days[i].value += o.subtotal_amount || 0;
  }
  return days;
}

export function DashboardPage() {
  const { staff, role } = useAuth();
  const navigate = useNavigate();
  const metrics = useMetrics();
  const orders = useOrders();
  const products = useProducts();
  const status = useStatus();

  const loadSample = useAction(api.loadSampleInventory, {
    invalidate: [...STOCK_KEYS, ...ORDER_KEYS, keys.suppliers, keys.categories, keys.posts],
    success: r => r.message,
  });

  const allOrders = orders.data || [];
  const lowStock = (products.data || [])
    .filter(p => p.is_active && p.available_stock <= p.low_stock_threshold)
    .sort((a, b) => a.available_stock - b.available_stock);
  const attention = allOrders.filter(o => awaitingReturn(o) || (o.stage === 'delivered' && balanceDue(o) > 0));
  const sales = useMemo(() => dailySales(allOrders), [allOrders]);
  const sales14 = sales.reduce((s, d) => s + d.value, 0);

  const m = metrics.data;
  const firstName = (staff?.full_name || '').split(/[\s(]/)[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            {can.loadSample(role) && status.data && !status.data.sampleLoaded && (
              <Button icon={<Sparkles className="h-4 w-4" />} loading={loadSample.isPending} onClick={() => loadSample.mutate(undefined)}>
                Load sample inventory
              </Button>
            )}
            {can.createOrders(role) && (
              <span className="hidden lg:block">
                <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/orders/new')}>
                  New order
                </Button>
              </span>
            )}
          </>
        }
      />

      {/* Key figures */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {metrics.isLoading || !m ? (
          [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[132px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Recorded sales" value={formatMVR(m.recorded_sales_revenue)} hint="Product sales, delivery fees excluded" icon={<Wallet className="h-5 w-5" />} />
            {can.seeCosts(role) ? (
              <StatCard
                label="Gross profit"
                value={formatMVR(m.estimated_gross_profit)}
                hint={m.recorded_sales_revenue > 0 ? `${((m.estimated_gross_profit / m.recorded_sales_revenue) * 100).toFixed(1)}% margin` : 'Selling price − captured cost'}
                tone="success"
                icon={<Sparkles className="h-5 w-5" />}
              />
            ) : (
              <StatCard label="Total orders" value={m.total_orders_count} hint="All time" icon={<ShoppingBag className="h-5 w-5" />} />
            )}
            <StatCard
              label="Orders in progress"
              value={m.orders_in_progress}
              hint={`${m.pending_delivery_count} with a courier`}
              icon={<Truck className="h-5 w-5" />}
            />
            <StatCard
              label="Units in stock"
              value={m.available_stock_count}
              hint={m.low_stock_count > 0 ? `${m.low_stock_count} product${m.low_stock_count === 1 ? '' : 's'} running low` : 'All products stocked'}
              tone={m.low_stock_count > 0 ? 'warning' : undefined}
              icon={<Boxes className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* Sales trend */}
        {can.viewOrders(role) && (
          <Card className="xl:col-span-2">
            <CardHeader title="Sales, last 14 days" description={`${formatMVR(sales14)} in product sales`} />
            <div className="px-5 pb-4 pt-6">
              {orders.isLoading ? (
                <Skeleton className="h-[220px]" />
              ) : (
                <BarChart data={sales} formatValue={v => formatMVR(v)} ariaLabel="Product sales per day, last 14 days" />
              )}
            </div>
          </Card>
        )}

        {/* Needs attention */}
        <Card className={can.viewOrders(role) ? '' : 'xl:col-span-3'}>
          <CardHeader title="Needs attention" description="Stock and orders to follow up" />
          <ul className="divide-y divide-line">
            {attention.slice(0, 4).map(o => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600 dark:bg-warning-500/10">
                    {awaitingReturn(o) ? <PackageOpen className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{o.order_number} · {o.buyer_name}</span>
                    <span className="block truncate text-sm text-fg-3">
                      {awaitingReturn(o) ? 'Confirm goods are back on the shelf' : `${formatMVR(balanceDue(o))} still to collect`}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg-4" />
                </Link>
              </li>
            ))}
            {lowStock.slice(0, Math.max(0, 6 - Math.min(attention.length, 4))).map(p => (
              <li key={p.id}>
                <Link to={`/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 dark:bg-error-500/10">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                    <span className="block text-sm text-fg-3">
                      {p.available_stock === 0 ? 'Out of stock' : `Only ${p.available_stock} left`} · alert at {p.low_stock_threshold}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg-4" />
                </Link>
              </li>
            ))}
            {attention.length === 0 && lowStock.length === 0 && !products.isLoading && (
              <li className="px-5 py-10 text-center text-sm text-fg-3">All caught up. Nothing needs attention.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Recent orders */}
      {can.viewOrders(role) && (
        <Card className="mt-5">
          <CardHeader
            title="Recent orders"
            actions={
              <Button variant="secondary" size="sm" onClick={() => navigate('/orders?view=list')}>
                View all
              </Button>
            }
          />
          {orders.isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <Table
              rows={allOrders.slice(0, 6)}
              rowKey={o => o.id}
              onRowClick={o => navigate(`/orders/${o.id}`)}
              empty={
                <EmptyState
                  icon={<ShoppingBag className="h-6 w-6" />}
                  title="No orders yet"
                  description="Orders you take from Instagram, Viber, WhatsApp or SMS will show up here."
                  action={can.createOrders(role) && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orders/new')}>New order</Button>}
                />
              }
              columns={[
                {
                  key: 'order',
                  header: 'Order',
                  primary: true,
                  render: o => (
                    <div className="flex items-center justify-between gap-3 md:block">
                      <div>
                        <p className="font-medium text-fg">{o.order_number}</p>
                        <p className="text-fg-3">{o.buyer_name}</p>
                      </div>
                      <span className="md:hidden">
                        <Badge color={STAGES[o.stage].color} dot>{STAGES[o.stage].label}</Badge>
                      </span>
                    </div>
                  ),
                },
                { key: 'date', header: 'Date', render: o => formatMaldivesDate(o.order_date || o.created_at) },
                { key: 'channel', header: 'Channel', render: o => CHANNELS[o.channel] || o.channel, hideOnMobile: true },
                { key: 'stage', header: 'Status', hideOnMobile: true, render: o => <Badge color={STAGES[o.stage].color} dot>{STAGES[o.stage].label}</Badge> },
                { key: 'total', header: 'Total', align: 'right', render: o => <span className="tabular font-medium text-fg">{formatMVR(o.total_amount)}</span> },
              ]}
            />
          )}
        </Card>
      )}
    </>
  );
}
