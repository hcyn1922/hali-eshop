import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Minus, Package, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMVR } from '../../lib/formatters';
import { ORDER_KEYS, keys, useBuyers, useCouriers, useExistingAddresses, useProducts } from '../../app/queries';
import type { Buyer, Order, OrderChannel, PaymentMethod, Product } from '../../types';
import { Avatar, Badge, Button, Card, CardHeader, Combobox, DetailRow, Input, PageHeader, Segmented, Select, Textarea, useToast } from '../../ui';
import { AddressFields, type AddressValue } from '../buyers/AddressFields';
import { CHANNELS, PAYMENT_METHODS } from './meta';

interface Line {
  product: Product;
  quantity: number;
  price: string;
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const products = useProducts();
  const buyers = useBuyers();
  const couriers = useCouriers();
  const savedAddresses = useExistingAddresses();

  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [newBuyer, setNewBuyer] = useState<{ name: string; phone: string; instagram_handle: string } | null>(null);
  const [channel, setChannel] = useState<OrderChannel>('instagram');
  const [channelDetail, setChannelDetail] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [address, setAddress] = useState<AddressValue>({ delivery_address: '' });
  const [addressKey, setAddressKey] = useState(0);
  const [courierId, setCourierId] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [courierRate, setCourierRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [amountReceived, setAmountReceived] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preselect a buyer when opened from their profile (/orders/new?buyer=…)
  const [params] = useSearchParams();
  const preselect = params.get('buyer');
  useEffect(() => {
    const b = preselect && buyers.data?.find(x => x.id === preselect);
    if (b && !buyer) chooseBuyer(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, buyers.data]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * (Number(l.price) || 0), 0);
  const fee = Number(deliveryFee) || 0;
  const total = subtotal + fee;
  const received = Number(amountReceived) || 0;

  const activeProducts = (products.data || []).filter(p => p.is_active);
  const productOptions = useMemo(
    () =>
      activeProducts.map(p => {
        const inOrder = lines.find(l => l.product.id === p.id)?.quantity || 0;
        const left = p.available_stock - inOrder;
        return {
          key: p.id,
          value: p,
          search: `${p.name} ${p.sku} ${p.category_name || ''}`,
          disabled: left <= 0,
          render: (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{p.name}</p>
                <p className="truncate text-xs text-fg-3">{p.sku}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular font-medium text-fg">{formatMVR(p.actual_listed_price)}</p>
                <p className={left <= 0 ? 'text-xs text-error-600' : 'text-xs text-fg-3'}>{left <= 0 ? 'Out of stock' : `${left} available`}</p>
              </div>
            </div>
          ),
        };
      }),
    [activeProducts, lines]
  );

  const buyerOptions = useMemo(
    () =>
      (buyers.data || []).map(b => ({
        key: b.id,
        value: b,
        search: `${b.name} ${b.phone} ${b.instagram_handle || ''}`,
        render: (
          <div className="flex items-center gap-3">
            <Avatar name={b.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{b.name}</p>
              <p className="truncate text-xs text-fg-3">
                {b.phone}
                {b.instagram_handle ? ` · @${b.instagram_handle.replace(/^@/, '')}` : ''}
              </p>
            </div>
          </div>
        ),
      })),
    [buyers.data]
  );

  const addProduct = (p: Product) =>
    setLines(prev => {
      const existing = prev.find(l => l.product.id === p.id);
      if (existing) return prev.map(l => (l.product.id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.available_stock) } : l));
      return [...prev, { product: p, quantity: 1, price: String(p.actual_listed_price) }];
    });

  const chooseBuyer = (b: Buyer) => {
    setBuyer(b);
    setNewBuyer(null);
    setAddress({
      delivery_address: b.delivery_address,
      boat_name: b.boat_name,
      boat_phone: b.boat_phone,
      boat_jetty: b.boat_jetty,
      atoll_code: b.atoll_code,
      island_name: b.island_name,
      location_link: b.location_link,
    });
    setAddressKey(k => k + 1);
  };

  const chooseCourier = (id: string) => {
    setCourierId(id);
    const c = couriers.data?.find(x => x.id === id);
    if (c) {
      setCourierRate(String(c.default_rate));
      if (!Number(deliveryFee)) setDeliveryFee(String(c.default_rate));
    }
  };

  const buyerSaved = [
    ...(buyer?.delivery_address ? [buyer.delivery_address] : []),
    ...(savedAddresses.data || []).filter(a => a !== buyer?.delivery_address),
  ].slice(0, 30);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!buyer && !newBuyer) return setError('Choose the buyer or add a new one.');
    if (newBuyer && (!newBuyer.name.trim() || !newBuyer.phone.trim())) return setError('Enter the new buyer’s name and phone number.');
    if (lines.length === 0) return setError('Add at least one product.');
    if (!address.delivery_address.trim()) return setError('Enter the delivery address.');

    setBusy(true);
    try {
      let buyerId = buyer?.id;
      if (!buyerId && newBuyer) {
        const created = await api.createBuyer({
          name: newBuyer.name.trim(),
          phone: newBuyer.phone.trim(),
          instagram_handle: newBuyer.instagram_handle.trim().replace(/^@/, '') || undefined,
          ...address,
        });
        buyerId = created.id;
      }
      const courier = couriers.data?.find(c => c.id === courierId);
      const order: Order = await api.createOrder({
        buyer_id: buyerId!,
        channel,
        channel_detail: channel === 'other' ? channelDetail.trim() : undefined,
        delivery_fee: fee,
        payment_method: paymentMethod,
        payment_status: received >= total && total > 0 ? 'paid' : received > 0 ? 'partially_paid' : 'unpaid',
        amount_received: received,
        notes: notes.trim(),
        ...address,
        delivery_person_id: courier?.id,
        delivery_person_name: courier?.name,
        delivery_person_phone: courier?.phone,
        delivery_rate: courierRate !== '' ? Number(courierRate) : undefined,
        items: lines.map(l => ({ product_id: l.product.id, quantity: l.quantity, unit_selling_price: Number(l.price) || 0 })),
      });
      await Promise.all([...ORDER_KEYS, keys.addresses].map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(`Order ${order.order_number} created. Stock updated.`);
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        breadcrumb={
          <Link to="/orders" className="inline-flex items-center gap-1.5 font-semibold text-fg-3 hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> Orders
          </Link>
        }
        title="New order"
        description="Stock is deducted the moment the order is created."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* Buyer */}
          <Card>
            <CardHeader title="Buyer" description="Who is this order for?" />
            <div className="flex flex-col gap-4 p-5">
              {buyer ? (
                <div className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <Avatar name={buyer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">{buyer.name}</p>
                    <p className="truncate text-sm text-fg-3">
                      {buyer.phone}
                      {buyer.orders_count ? ` · ${buyer.orders_count} previous order${buyer.orders_count === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <Button variant="tertiary" size="sm" iconOnly icon={<X className="h-4 w-4" />} onClick={() => setBuyer(null)}>
                    Change buyer
                  </Button>
                </div>
              ) : newBuyer ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Name" required value={newBuyer.name} onChange={e => setNewBuyer({ ...newBuyer, name: e.target.value })} autoFocus />
                  <Input label="Phone" type="tel" required value={newBuyer.phone} onChange={e => setNewBuyer({ ...newBuyer, phone: e.target.value })} placeholder="+960 7xx xxxx" />
                  <Input
                    label="Instagram handle"
                    value={newBuyer.instagram_handle}
                    onChange={e => setNewBuyer({ ...newBuyer, instagram_handle: e.target.value })}
                    placeholder="@username"
                  />
                  <div className="flex items-end">
                    <Button variant="link" onClick={() => setNewBuyer(null)}>
                      Pick an existing buyer instead
                    </Button>
                  </div>
                </div>
              ) : (
                <Combobox
                  options={buyerOptions}
                  onSelect={chooseBuyer}
                  placeholder="Search by name, phone or Instagram"
                  emptyText="No buyer found"
                  footer={
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        setNewBuyer({ name: '', phone: '', instagram_handle: '' });
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-fg-2 hover:bg-hover"
                    >
                      <UserPlus className="h-4 w-4" /> Add a new buyer
                    </button>
                  }
                />
              )}
              <div>
                <p className="mb-1.5 text-sm font-medium text-fg-2">Order came from</p>
                <div className="overflow-x-auto">
                  <Segmented
                    items={(Object.keys(CHANNELS) as OrderChannel[]).map(c => ({ key: c, label: c === 'direct' ? 'Direct' : CHANNELS[c] }))}
                    value={channel}
                    onChange={setChannel}
                  />
                </div>
                {channel === 'other' && (
                  <Input
                    containerClassName="mt-3 sm:max-w-sm"
                    label="Where did it come from?"
                    value={channelDetail}
                    maxLength={60}
                    onChange={e => setChannelDetail(e.target.value)}
                    placeholder="e.g. TikTok, phone call, Facebook"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader title="Items" description="Prices default to the listed price and can be adjusted." />
            <div className="flex flex-col gap-4 p-5">
              <Combobox options={productOptions} onSelect={addProduct} placeholder="Search products by name or SKU" emptyText="No product found" />
              {lines.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong py-8 text-center">
                  <Package className="h-6 w-6 text-fg-4" />
                  <p className="mt-2 text-sm text-fg-3">No items yet. Search above to add products.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {lines.map(l => (
                    <li key={l.product.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                        <p className="truncate font-medium text-fg">{l.product.name}</p>
                        <p className="text-xs text-fg-3">
                          {l.product.sku} · {l.product.available_stock} in stock
                        </p>
                      </div>
                      <div className="flex items-center rounded-lg border border-line-strong">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="flex h-9 w-9 cursor-pointer items-center justify-center text-fg-3 hover:text-fg disabled:opacity-40"
                          disabled={l.quantity <= 1}
                          onClick={() => setLines(ls => ls.map(x => (x === l ? { ...x, quantity: x.quantity - 1 } : x)))}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="tabular w-8 text-center text-sm font-semibold">{l.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="flex h-9 w-9 cursor-pointer items-center justify-center text-fg-3 hover:text-fg disabled:opacity-40"
                          disabled={l.quantity >= l.product.available_stock}
                          onClick={() => setLines(ls => ls.map(x => (x === l ? { ...x, quantity: x.quantity + 1 } : x)))}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="w-32">
                        <Input
                          aria-label="Unit price (MVR)"
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={l.price}
                          onChange={e => setLines(ls => ls.map(x => (x === l ? { ...x, price: e.target.value } : x)))}
                          leading={<span className="text-xs">MVR</span>}
                          className="tabular text-right"
                        />
                      </div>
                      <p className="tabular ml-auto w-28 text-right text-sm font-semibold text-fg">
                        {formatMVR(l.quantity * (Number(l.price) || 0))}
                      </p>
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconOnly
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setLines(ls => ls.filter(x => x !== l))}
                      >
                        Remove {l.product.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader title="Delivery" />
            <div className="flex flex-col gap-5 p-5">
              <AddressFields key={addressKey} value={address} onChange={setAddress} savedAddresses={buyerSaved} />
              <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                <Select label="Courier" value={courierId} onChange={e => chooseCourier(e.target.value)} hint="You can also choose at handover.">
                  <option value="">Decide later</option>
                  {(couriers.data || [])
                    .filter(c => c.is_active)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {formatMVR(c.default_rate)}
                      </option>
                    ))}
                </Select>
                <Input
                  label="Delivery fee charged"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={deliveryFee}
                  onChange={e => setDeliveryFee(e.target.value)}
                  leading={<span className="text-xs">MVR</span>}
                  hint="Paid by the buyer"
                />
                <Input
                  label="Courier charge"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={courierRate}
                  onChange={e => setCourierRate(e.target.value)}
                  leading={<span className="text-xs">MVR</span>}
                  hint="What the courier charges us"
                />
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader title="Payment" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Select label="Method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>
                    {PAYMENT_METHODS[m]}
                  </option>
                ))}
              </Select>
              <Input
                label="Amount received now"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amountReceived}
                onChange={e => setAmountReceived(e.target.value)}
                leading={<span className="text-xs">MVR</span>}
                hint={
                  <button type="button" className="cursor-pointer font-semibold text-fg-2 hover:text-fg" onClick={() => setAmountReceived(total.toFixed(2))}>
                    Paid in full ({formatMVR(total)})
                  </button>
                }
              />
              <Textarea label="Notes" containerClassName="sm:col-span-2" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Gift wrap, delivery time, etc." />
            </div>
          </Card>
        </div>

        {/* Summary */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader title="Summary" />
          <div className="p-5">
            <dl className="divide-y divide-line">
              <DetailRow label={`Items (${lines.reduce((s, l) => s + l.quantity, 0)})`}>
                <span className="tabular">{formatMVR(subtotal)}</span>
              </DetailRow>
              <DetailRow label="Delivery fee">
                <span className="tabular">{formatMVR(fee)}</span>
              </DetailRow>
              <DetailRow label={<span className="font-semibold text-fg">Total</span>}>
                <span className="tabular text-base font-semibold">{formatMVR(total)}</span>
              </DetailRow>
              <DetailRow label="Received">
                <span className="tabular">{formatMVR(received)}</span>
              </DetailRow>
              <DetailRow label="Balance due">
                {total === 0 ? (
                  <span className="text-fg-4">—</span>
                ) : total - received > 0 ? (
                  <Badge color="warning">{formatMVR(total - received)}</Badge>
                ) : (
                  <Badge color="success">Paid</Badge>
                )}
              </DetailRow>
            </dl>
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-500">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" loading={busy}>
              Create order
            </Button>
            <Button variant="tertiary" className="mt-2 w-full" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
