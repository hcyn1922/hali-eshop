import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useOrders, useProducts } from '../../app/queries';
import { formatMVR } from '../../lib/formatters';
import type { Order, OrderChannel } from '../../types';
import { BarChart, Button, Card, CardHeader, DetailRow, Input, PageHeader, Select, StatCard, Table } from '../../ui';
import { CHANNELS } from '../orders/meta';

type Period = 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'all' | 'custom';

const COUNTED = (o: Order) => !['cancelled', 'failed', 'returned'].includes(o.stage);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeFor(period: Period, from: string, to: string): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (period) {
    case 'this_month':
      start.setDate(1);
      return [start, end];
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return [s, e];
    }
    case 'last_30':
      start.setDate(start.getDate() - 29);
      return [start, end];
    case 'this_year':
      return [new Date(now.getFullYear(), 0, 1), end];
    case 'custom':
      return [from ? new Date(`${from}T00:00:00`) : new Date(2000, 0, 1), to ? new Date(`${to}T23:59:59`) : end];
    default:
      return [new Date(2000, 0, 1), end];
  }
}

function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Horizontal bars for comparing a few categories (single hue, value labels). */
function BarList({ rows, format }: { rows: Array<{ label: string; value: number; hint?: string }>; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(r => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fg-2">{r.label}</span>
            <span className="tabular font-medium text-fg">
              {format(r.value)}
              {r.hint && <span className="ml-1.5 font-normal text-fg-4">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-2 rounded-full bg-brand-500 dark:bg-brand-400" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportsPage() {
  const orders = useOrders();
  const products = useProducts();
  const [period, setPeriod] = useState<Period>('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [start, end] = rangeFor(period, from, to);

  const inRange = useMemo(
    () =>
      (orders.data || []).filter(o => {
        const d = new Date(o.order_date || o.created_at);
        return d >= start && d <= end;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders.data, start.getTime(), end.getTime()]
  );
  const counted = inRange.filter(COUNTED);

  const sales = counted.reduce((s, o) => s + o.subtotal_amount, 0);
  const cost = counted.reduce((s, o) => s + o.items.reduce((x, i) => x + i.line_cost, 0), 0);
  const profit = sales - cost;
  const fees = counted.reduce((s, o) => s + (o.delivery_fee || 0), 0);
  const courier = counted.reduce((s, o) => s + (o.delivery_rate || 0), 0);
  const received = inRange.filter(o => o.stage !== 'cancelled').reduce((s, o) => s + (o.amount_received || 0), 0);
  const outstanding = counted.reduce((s, o) => s + Math.max(0, o.total_amount - (o.amount_received || 0)), 0);

  // Sales over time: daily for short ranges, monthly otherwise
  const series = useMemo(() => {
    const earliest = counted.length ? new Date(Math.min(...counted.map(o => new Date(o.order_date || o.created_at).getTime()))) : start;
    const first = start.getFullYear() === 2000 ? earliest : start;
    const monthly = (end.getTime() - first.getTime()) / 86400000 > 62;
    const buckets = new Map<string, { key: string; label: string; tooltip: string; value: number }>();
    const cursor = new Date(first.getFullYear(), first.getMonth(), monthly ? 1 : first.getDate());
    const stop = end;
    while (cursor <= stop && buckets.size < 400) {
      const key = monthly ? `${cursor.getFullYear()}-${cursor.getMonth()}` : dayKey(cursor);
      buckets.set(key, {
        key,
        label: monthly ? cursor.toLocaleDateString('en-GB', { month: 'short' }) : cursor.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        tooltip: monthly ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : cursor.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        value: 0,
      });
      if (monthly) cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
    for (const o of counted) {
      const d = new Date(o.order_date || o.created_at);
      const b = buckets.get(monthly ? `${d.getFullYear()}-${d.getMonth()}` : dayKey(d));
      if (b) b.value += o.subtotal_amount;
    }
    return [...buckets.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counted, period, start.getTime(), end.getTime()]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; units: number; revenue: number; profit: number }>();
    for (const o of counted)
      for (const i of o.items) {
        const r = map.get(i.product_id) || { id: i.product_id, name: i.product_name, units: 0, revenue: 0, profit: 0 };
        r.units += i.quantity;
        r.revenue += i.line_total;
        r.profit += i.line_total - i.line_cost;
        map.set(i.product_id, r);
      }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [counted]);

  const topBuyers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; orders: number; spent: number }>();
    for (const o of counted) {
      const r = map.get(o.buyer_id) || { id: o.buyer_id, name: o.buyer_name || 'Buyer', orders: 0, spent: 0 };
      r.orders += 1;
      r.spent += o.total_amount;
      map.set(o.buyer_id, r);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent).slice(0, 8);
  }, [counted]);

  const byChannel = (Object.keys(CHANNELS) as OrderChannel[])
    .map(c => {
      const list = counted.filter(o => o.channel === c);
      return { label: CHANNELS[c], value: list.reduce((s, o) => s + o.subtotal_amount, 0), hint: `${list.length} order${list.length === 1 ? '' : 's'}` };
    })
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const byMethod = (['bank_transfer', 'cash'] as const).map(m => ({
    label: m === 'cash' ? 'Cash' : 'Bank transfer',
    value: inRange.filter(o => o.payment_method === m && o.stage !== 'cancelled').reduce((s, o) => s + (o.amount_received || 0), 0),
  }));

  const stockAtCost = (products.data || []).reduce((s, p) => s + p.available_stock * p.wholesale_unit_cost, 0);
  const stockAtRetail = (products.data || []).reduce((s, p) => s + p.available_stock * p.actual_listed_price, 0);

  const periodLabel = `${start.getFullYear() === 2000 ? 'All time' : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const exportCsv = () =>
    downloadCsv(`hali-orders-${dayKey(start)}-${dayKey(end)}.csv`, [
      ['Order', 'Date', 'Status', 'Channel', 'Buyer', 'Phone', 'Product', 'SKU', 'Qty', 'Unit price', 'Line total', 'Unit cost', 'Line cost', 'Delivery fee', 'Order total', 'Paid', 'Payment status'],
      ...inRange.flatMap(o =>
        o.items.map((i, idx) => [
          o.order_number,
          (o.order_date || o.created_at).slice(0, 10),
          o.stage,
          CHANNELS[o.channel],
          o.buyer_name || '',
          o.buyer_phone || '',
          i.product_name,
          i.product_sku,
          i.quantity,
          i.unit_selling_price.toFixed(2),
          i.line_total.toFixed(2),
          i.unit_cost.toFixed(2),
          i.line_cost.toFixed(2),
          idx === 0 ? o.delivery_fee.toFixed(2) : '',
          idx === 0 ? o.total_amount.toFixed(2) : '',
          idx === 0 ? (o.amount_received || 0).toFixed(2) : '',
          o.payment_status,
        ])
      ),
    ]);

  return (
    <>
      <PageHeader
        title="Reports"
        description={periodLabel}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={inRange.length === 0}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select label="Period" value={period} onChange={e => setPeriod(e.target.value as Period)} containerClassName="sm:w-52">
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="last_30">Last 30 days</option>
          <option value="this_year">This year</option>
          <option value="all">All time</option>
          <option value="custom">Custom range</option>
        </Select>
        {period === 'custom' && (
          <>
            <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard label="Product sales" value={formatMVR(sales)} hint={`${counted.length} order${counted.length === 1 ? '' : 's'}`} />
        <StatCard label="Gross profit" value={formatMVR(profit)} hint={sales > 0 ? `${((profit / sales) * 100).toFixed(1)}% margin` : 'No sales yet'} tone="success" />
        <StatCard label="Average order" value={formatMVR(counted.length ? sales / counted.length : 0)} hint="Products only" />
        <StatCard label="Still to collect" value={formatMVR(outstanding)} hint={`${formatMVR(received)} received`} tone={outstanding > 0 ? 'warning' : undefined} />
      </div>

      <Card className="mt-5">
        <CardHeader title="Product sales over time" description="Cancelled, failed and returned orders are excluded." />
        <div className="px-5 pb-4 pt-6">
          <BarChart data={series} formatValue={v => formatMVR(v)} ariaLabel="Product sales over time" />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top products" />
          <Table
            rows={topProducts}
            rowKey={r => r.id}
            empty={<p className="px-5 py-10 text-center text-sm text-fg-3">No sales in this period.</p>}
            columns={[
              { key: 'name', header: 'Product', primary: true, render: r => <span className="font-medium text-fg">{r.name}</span> },
              { key: 'units', header: 'Units', align: 'right', render: r => <span className="tabular">{r.units}</span> },
              { key: 'revenue', header: 'Sales', align: 'right', render: r => <span className="tabular">{formatMVR(r.revenue)}</span> },
              { key: 'profit', header: 'Profit', align: 'right', render: r => <span className="tabular font-medium text-fg">{formatMVR(r.profit)}</span> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Top buyers" />
          <Table
            rows={topBuyers}
            rowKey={r => r.id}
            empty={<p className="px-5 py-10 text-center text-sm text-fg-3">No buyers in this period.</p>}
            columns={[
              { key: 'name', header: 'Buyer', primary: true, render: r => <span className="font-medium text-fg">{r.name}</span> },
              { key: 'orders', header: 'Orders', align: 'right', render: r => <span className="tabular">{r.orders}</span> },
              { key: 'spent', header: 'Spent', align: 'right', render: r => <span className="tabular font-medium text-fg">{formatMVR(r.spent)}</span> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Sales by channel" />
          <div className="p-5">
            {byChannel.length ? <BarList rows={byChannel} format={formatMVR} /> : <p className="text-sm text-fg-3">No sales in this period.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments received" />
          <div className="p-5">
            <BarList rows={byMethod} format={formatMVR} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Delivery" description="Kept separate from product profit." />
          <dl className="divide-y divide-line px-5 py-1">
            <DetailRow label="Fees charged to buyers">{formatMVR(fees)}</DetailRow>
            <DetailRow label="Courier charges">{formatMVR(courier)}</DetailRow>
            <DetailRow label="Delivery net">
              <span className={fees - courier < 0 ? 'text-error-600' : ''}>{formatMVR(fees - courier)}</span>
            </DetailRow>
          </dl>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="GST estimate (8%)" description="For MIRA returns, if your shop is GST-registered." />
          <dl className="divide-y divide-line px-5 py-1">
            <DetailRow label="Taxable sales (products + delivery)">{formatMVR(sales + fees)}</DetailRow>
            <DetailRow label="GST if prices include GST (× 8/108)">{formatMVR(((sales + fees) * 8) / 108)}</DetailRow>
            <DetailRow label="GST if charged on top (× 8%)">{formatMVR((sales + fees) * 0.08)}</DetailRow>
          </dl>
          <p className="px-5 pb-4 text-xs text-fg-4">An estimate only. Check the figures with MIRA guidance or your accountant before filing.</p>
        </Card>
        <Card>
          <CardHeader title="Stock value today" />
          <dl className="divide-y divide-line px-5 py-1">
            <DetailRow label="Units in stock">{(products.data || []).reduce((s, p) => s + p.available_stock, 0)}</DetailRow>
            <DetailRow label="At wholesale cost">{formatMVR(stockAtCost)}</DetailRow>
            <DetailRow label="At listed prices">{formatMVR(stockAtRetail)}</DetailRow>
            <DetailRow label="Potential profit">{formatMVR(stockAtRetail - stockAtCost)}</DetailRow>
          </dl>
        </Card>
      </div>
    </>
  );
}
