import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Layers, Pencil, X } from 'lucide-react';
import { STOCK_KEYS, useCategories, useProducts } from '../../app/queries';
import { api } from '../../lib/api';
import { calculateSuggestedPrice, formatMVR } from '../../lib/formatters';
import type { PricingRule, Product } from '../../types';
import { Badge, Button, Card, CardHeader, DetailRow, Input, Modal, PageHeader, Segmented, Select, Table, Toggle, cn, useToast } from '../../ui';

type Rule = 'markup_on_cost' | 'gross_margin';
type Rounding = 'none' | '1' | '5' | '10' | '9';

const GST_RATE = 8;

function applyRounding(price: number, rounding: Rounding): number {
  if (rounding === 'none') return Math.round(price * 100) / 100;
  if (rounding === '9') return Math.max(9, Math.floor(price / 10) * 10 + 9);
  const step = Number(rounding);
  return Math.round(price / step) * step;
}

/** Suggested price from the spec formulas, then optional GST and rounding. */
function priceFor(cost: number, rule: Rule, pct: number, gst: boolean, rounding: Rounding) {
  const base = calculateSuggestedPrice(cost, pct, rule);
  return applyRounding(gst ? base * (1 + GST_RATE / 100) : base, rounding);
}

const ROUNDING_OPTIONS: Array<[Rounding, string]> = [
  ['none', 'No rounding'],
  ['1', 'Nearest MVR 1'],
  ['5', 'Nearest MVR 5'],
  ['10', 'Nearest MVR 10'],
  ['9', 'Ends in 9'],
];

function MarkupMarginCalculator() {
  const [cost, setCost] = useState('650');
  const [rule, setRule] = useState<Rule>('markup_on_cost');
  const [pct, setPct] = useState('7.14');
  const [gst, setGst] = useState(false);
  const [rounding, setRounding] = useState<Rounding>('none');

  const c = Number(cost) || 0;
  const price = priceFor(c, rule, Number(pct) || 0, gst, rounding);
  const net = gst ? price / (1 + GST_RATE / 100) : price;
  const profit = net - c;

  return (
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Input label="Wholesale unit cost" type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} leading={<span className="text-xs">MVR</span>} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg-2">Pricing rule</p>
            <Segmented
              items={[
                { key: 'markup_on_cost', label: 'Markup on cost' },
                { key: 'gross_margin', label: 'Gross margin' },
              ]}
              value={rule}
              onChange={setRule}
            />
          </div>
          <Input label={rule === 'markup_on_cost' ? 'Markup %' : 'Margin %'} type="number" min="0" max={rule === 'gross_margin' ? 99 : undefined} step="0.01" value={pct} onChange={e => setPct(e.target.value)} />
          <Select label="Rounding" value={rounding} onChange={e => setRounding(e.target.value as Rounding)}>
            {ROUNDING_OPTIONS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
          <Toggle checked={gst} onChange={setGst} label={`Add ${GST_RATE}% GST`} hint="Only if your shop is registered for GST with MIRA." />
        </div>
        <div className="flex flex-col rounded-xl bg-subtle p-5 ring-1 ring-inset ring-line">
          <p className="text-sm font-medium text-fg-3">Suggested selling price</p>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-fg">{formatMVR(price)}</p>
          <p className="mt-2 font-mono text-sm text-fg-3">
            {rule === 'markup_on_cost' ? `${formatMVR(c)} × (1 + ${pct || 0}%)` : `${formatMVR(c)} ÷ (1 − ${pct || 0}%)`}
            {gst ? ` × 1.${String(GST_RATE).padStart(2, '0')}` : ''}
          </p>
          <dl className="mt-5 divide-y divide-line border-t border-line">
            <DetailRow label="Profit per unit">
              <span className="tabular">{formatMVR(profit)}</span>
            </DetailRow>
            <DetailRow label="Markup on cost">{c > 0 ? `${((profit / c) * 100).toFixed(2)}%` : '—'}</DetailRow>
            <DetailRow label="Margin on price">{net > 0 ? `${((profit / net) * 100).toFixed(2)}%` : '—'}</DetailRow>
            {gst && (
              <DetailRow label="GST collected">
                <span className="tabular">{formatMVR(price - net)}</span>
              </DetailRow>
            )}
          </dl>
          <p className="mt-auto pt-4 text-xs text-fg-4">
            Markup is measured against cost and margin against the selling price, so the same price always shows a smaller margin % than markup %.
          </p>
        </div>
      </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pctText = (n: number) => `${round2(n).toFixed(2).replace(/\.?0+$/, '')}%`;

const MARGIN_KEY = ['pricing-margins'];
const DELIVERY_KEY = ['pricing-delivery-rate'];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}

function Result({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'error' | 'success' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3.5 py-2.5 text-sm ring-1 ring-inset ring-line">
      <span className="text-fg-3">{label}</span>
      <span className={cn('tabular font-semibold', tone === 'error' ? 'text-error-600' : tone === 'success' ? 'text-success-600' : 'text-fg')}>{value}</span>
    </div>
  );
}

/**
 * Shop price − our discount = wholesale cost. The market price shows the
 * margin others sell at; the owner picks a margin, gets a selling price,
 * can change it, and sets it on a product.
 */
function ShopPriceCalculator({ products }: { products: Product[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const margins = useQuery({ queryKey: MARGIN_KEY, queryFn: api.getPricingMargins });
  const [productId, setProductId] = useState('');
  const deliveryRate = useQuery({ queryKey: DELIVERY_KEY, queryFn: api.getPricingDeliveryRate });
  const [known, setKnown] = useState<'shop' | 'wholesale'>('shop');
  const [shopPrice, setShopPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [delivery, setDelivery] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [marketPrice, setMarketPrice] = useState('');
  const [margin, setMargin] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState<string | null>(null);
  const [updateCost, setUpdateCost] = useState(true);
  const [saving, setSaving] = useState(false);

  const saved = margins.data || [];
  // Until the owner types a margin, start from the one they used last
  const marginText = margin ?? (saved[0] !== undefined ? String(saved[0]) : '');
  const product = products.find(p => p.id === productId);

  const d = Math.min(Math.max(Number(discount) || 0, 0), 99.99) / 100;
  // Either the shop price is known (cost = shop − discount) or the wholesale price is (shop = cost ÷ (1 − discount))
  const cost = known === 'shop' ? round2((Number(shopPrice) || 0) * (1 - d)) : round2(Number(wholesalePrice) || 0);
  const shop = known === 'shop' ? round2(Number(shopPrice) || 0) : round2(cost / (1 - d));
  const market = Number(marketPrice) || 0;
  const marketProfit = round2(market - cost);
  const m = Number(marginText);
  const marginValid = marginText !== '' && Number.isFinite(m) && m > 0 && m < 100;
  const calculated = cost > 0 && marginValid ? round2(cost / (1 - m / 100)) : 0;

  const finalText = finalPrice ?? (calculated ? calculated.toFixed(2) : '');
  const chosen = Number(finalText);
  const hasFinal = finalText !== '' && Number.isFinite(chosen) && chosen > 0;
  const overridden = finalPrice !== null && hasFinal && round2(chosen) !== calculated;
  const profit = round2(chosen - cost);
  const vsMarket = round2(chosen - market);
  const deliveryText = delivery ?? (deliveryRate.data?.rate ? String(deliveryRate.data.rate) : '');
  const deliveryCost = Math.max(Number(deliveryText) || 0, 0);
  const netProfit = round2(chosen - cost - deliveryCost);
  const rememberDelivery = async () => {
    if (deliveryText === '' || deliveryCost === (deliveryRate.data?.rate || 0)) return;
    try {
      queryClient.setQueryData(DELIVERY_KEY, await api.setPricingDeliveryRate(deliveryCost));
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const setMarginsCache = (list: number[]) => queryClient.setQueryData(MARGIN_KEY, list);
  const remember = async (value = m) => {
    if (!(value > 0 && value < 100)) return;
    try {
      setMarginsCache(await api.rememberPricingMargin(value));
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };
  const forget = async (value: number) => {
    try {
      setMarginsCache(await api.forgetPricingMargin(value));
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const pickProduct = (id: string) => {
    setProductId(id);
    setFinalPrice(null);
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (p.shop_price) {
      setKnown('shop');
      setShopPrice(String(p.shop_price));
      setDiscount(String(p.shop_discount_percentage || 0));
    } else {
      setKnown('wholesale');
      setWholesalePrice(p.wholesale_unit_cost ? String(p.wholesale_unit_cost) : '');
      setDiscount('0');
    }
    setMarketPrice(p.market_price ? String(p.market_price) : '');
    if (p.pricing_rule === 'gross_margin' && p.pricing_rule_percentage > 0) setMargin(String(p.pricing_rule_percentage));
  };

  const setPrice = async () => {
    if (!product || !hasFinal) return;
    setSaving(true);
    try {
      await api.updateProduct(product.id, {
        actual_listed_price: round2(chosen),
        ...(shop > 0 ? { shop_price: shop } : {}),
        shop_discount_percentage: round2(d * 100),
        ...(market > 0 ? { market_price: market } : {}),
        ...(marginValid ? { pricing_rule: 'gross_margin' as PricingRule, pricing_rule_percentage: m, suggested_price: calculated } : {}),
        ...(updateCost && cost > 0 ? { wholesale_unit_cost: cost } : {}),
      });
      if (marginValid) await remember();
      await rememberDelivery();
      await Promise.all(STOCK_KEYS.map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(`${product.name} now sells for ${formatMVR(chosen)}.`);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Select label="Product" hint="Optional. Fills in what you saved for it last time and lets you set the price on it." value={productId} onChange={e => pickProduct(e.target.value)}>
          <option value="">No product, just calculate</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>

        <Step n={1} title="What we pay">
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg-2">We know the</p>
            <Segmented
              items={[
                { key: 'shop', label: 'Shop price' },
                { key: 'wholesale', label: 'Wholesale price' },
              ]}
              value={known}
              onChange={k => {
                // Carry the current figure over so switching never loses it
                if (k === 'wholesale' && cost > 0) setWholesalePrice(String(cost));
                if (k === 'shop' && shop > 0) setShopPrice(String(shop));
                setKnown(k);
                setFinalPrice(null);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {known === 'shop' ? (
              <Input label="Shop price" type="number" min="0" step="0.01" placeholder="0.00" value={shopPrice} onChange={e => { setShopPrice(e.target.value); setFinalPrice(null); }} leading={<span className="text-xs">MVR</span>} />
            ) : (
              <Input label="Wholesale price" type="number" min="0" step="0.01" placeholder="0.00" value={wholesalePrice} onChange={e => { setWholesalePrice(e.target.value); setFinalPrice(null); }} leading={<span className="text-xs">MVR</span>} />
            )}
            <Input label="Discount we get" type="number" min="0" max="99.99" step="0.01" placeholder="0" value={discount} onChange={e => { setDiscount(e.target.value); setFinalPrice(null); }} trailing={<span className="text-xs">%</span>} />
          </div>
          {known === 'shop' ? (
            <Result label="Wholesale cost" value={formatMVR(cost)} />
          ) : (
            <>
              <Result label="Shop price" value={cost > 0 ? formatMVR(shop) : '—'} />
              <Result label="Wholesale cost" value={formatMVR(cost)} />
            </>
          )}
        </Step>

        <Step n={2} title="What the market charges">
          <Input label="Market selling price" hint="What other sellers sell this item for." type="number" min="0" step="0.01" placeholder="0.00" value={marketPrice} onChange={e => setMarketPrice(e.target.value)} leading={<span className="text-xs">MVR</span>} />
          <Result
            label="Market margin"
            value={market > 0 && cost > 0 ? `${pctText((marketProfit / market) * 100)} · ${formatMVR(marketProfit)} profit` : '—'}
            tone={market > 0 && cost > 0 && marketProfit < 0 ? 'error' : undefined}
          />
        </Step>

        <Step n={3} title="Our margin">
          <Input
            label="Margin we want"
            hint="Profit as a share of the selling price. Margins you use are remembered."
            type="number"
            min="0"
            max="99.99"
            step="0.01"
            placeholder="e.g. 20"
            value={marginText}
            onChange={e => {
              setMargin(e.target.value);
              setFinalPrice(null);
            }}
            onBlur={() => marginValid && !saved.includes(round2(m)) && remember()}
            trailing={<span className="text-xs">%</span>}
          />
          {saved.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-3">Saved margins</p>
              <div className="flex flex-wrap gap-2">
                {saved.map(v => {
                  const active = marginValid && round2(m) === v;
                  return (
                    <span
                      key={v}
                      className={cn(
                        'inline-flex items-center rounded-full text-sm ring-1 ring-inset',
                        active ? 'bg-primary text-on-primary ring-primary' : 'bg-surface text-fg-2 ring-line-strong'
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={active}
                        className="focus-ring cursor-pointer rounded-full py-1 pl-3 pr-1.5 font-medium tabular"
                        onClick={() => {
                          setMargin(String(v));
                          setFinalPrice(null);
                        }}
                      >
                        {pctText(v)}
                      </button>
                      <button
                        type="button"
                        aria-label={`Forget ${pctText(v)}`}
                        className={cn('focus-ring mr-1 cursor-pointer rounded-full p-1', active ? 'hover:bg-white/15' : 'text-fg-4 hover:bg-hover hover:text-fg-2')}
                        onClick={() => forget(v)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Step>
      </div>

      <div className="flex flex-col rounded-xl bg-subtle p-5 ring-1 ring-inset ring-line">
        <p className="text-sm font-medium text-fg-3">Calculated selling price</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-fg">{calculated ? formatMVR(calculated) : '—'}</p>
        <p className="mt-2 font-mono text-sm text-fg-3">
          {calculated ? `${formatMVR(cost)} ÷ (1 − ${pctText(m)})` : 'Enter the shop price and the margin you want.'}
        </p>

        <div className="mt-5 border-t border-line pt-5">
          <Input
            label="Final selling price"
            hint={overridden ? undefined : 'Change it to anything you like, e.g. a rounder number.'}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={finalText}
            onChange={e => setFinalPrice(e.target.value)}
            leading={<span className="text-xs">MVR</span>}
          />
          {overridden && (
            <button type="button" className="mt-1.5 cursor-pointer text-sm font-medium text-fg-2 underline underline-offset-4 hover:text-fg" onClick={() => setFinalPrice(null)}>
              Use the calculated {formatMVR(calculated)}
            </button>
          )}
          {hasFinal && cost > 0 && (
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <DetailRow label="Profit before delivery">
                <span className={cn('tabular', profit < 0 && 'text-error-600')}>{formatMVR(profit)}</span>
              </DetailRow>
              <DetailRow label="Our margin">{pctText((profit / chosen) * 100)}</DetailRow>
              <DetailRow label="Markup on cost">{pctText((profit / cost) * 100)}</DetailRow>
              {market > 0 && (
                <DetailRow label="Against the market">
                  <span className={cn('tabular', vsMarket > 0 ? 'text-warning-600' : 'text-success-600')}>
                    {vsMarket === 0 ? 'Same price' : `${formatMVR(Math.abs(vsMarket))} ${vsMarket > 0 ? 'above' : 'below'}`}
                  </span>
                </DetailRow>
              )}
            </dl>
          )}
        </div>

        {hasFinal && cost > 0 && (
          <div className="mt-5 rounded-lg bg-surface p-4 ring-1 ring-inset ring-line">
            <p className="text-sm font-semibold text-fg">Our profit on this product</p>
            <Input
              containerClassName="mt-3"
              label="Normal delivery rate"
              hint="What one delivery costs us. Remembered for next time."
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={deliveryText}
              onChange={e => setDelivery(e.target.value)}
              onBlur={rememberDelivery}
              leading={<span className="text-xs">MVR</span>}
            />
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <DetailRow label="Selling price">
                <span className="tabular">{formatMVR(chosen)}</span>
              </DetailRow>
              <DetailRow label="Wholesale cost">
                <span className="tabular">− {formatMVR(cost)}</span>
              </DetailRow>
              <DetailRow label="Delivery">
                <span className="tabular">− {formatMVR(deliveryCost)}</span>
              </DetailRow>
              <DetailRow label={<span className="font-semibold text-fg">Profit per sale</span>}>
                <span className={cn('tabular text-base font-semibold', netProfit < 0 ? 'text-error-600' : 'text-success-600')}>{formatMVR(netProfit)}</span>
              </DetailRow>
              <DetailRow label="Margin after delivery">{pctText((netProfit / chosen) * 100)}</DetailRow>
              {product && product.available_stock > 0 && (
                <DetailRow label={`Profit on the ${product.available_stock} in stock`}>
                  <span className={cn('tabular font-medium', netProfit < 0 && 'text-error-600')}>{formatMVR(netProfit * product.available_stock)}</span>
                </DetailRow>
              )}
            </dl>
            {product && product.available_stock > 0 && <p className="mt-2 text-xs text-fg-4">Stock profit assumes each item goes out in its own delivery.</p>}
          </div>
        )}

        <div className="mt-auto pt-5">
          {product ? (
            <>
              {cost > 0 && cost !== product.wholesale_unit_cost && (
                <div className="mb-4">
                  <Toggle
                    checked={updateCost}
                    onChange={setUpdateCost}
                    label={`Also change its cost from ${formatMVR(product.wholesale_unit_cost)} to ${formatMVR(cost)}`}
                    hint="New orders then record the new cost. Turn off while you still sell stock bought at the old cost."
                  />
                </div>
              )}
              <Button variant="primary" className="w-full" icon={<Check className="h-4 w-4" />} loading={saving} disabled={!hasFinal} onClick={setPrice}>
                {hasFinal ? `Set ${product.name} to ${formatMVR(chosen)}` : 'Enter a price first'}
              </Button>
              <p className="mt-2 text-xs text-fg-4">Also saves the shop price, discount, market price and margin on the product for next time.</p>
            </>
          ) : (
            <p className="text-sm text-fg-3">Choose a product at the top to set this price on it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PricingCalculator({ products }: { products: Product[] }) {
  const [mode, setMode] = useState<'shop_price' | 'markup_margin'>('shop_price');
  return (
    <Card>
      <CardHeader
        title="Price calculator"
        description={mode === 'shop_price' ? 'From the shop or wholesale price to a selling price, checked against the market, and our profit after delivery.' : 'Compare markup on cost with margin on the selling price.'}
        actions={
          <Segmented
            items={[
              { key: 'shop_price', label: 'Shop price' },
              { key: 'markup_margin', label: 'Markup or margin' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
      />
      {mode === 'shop_price' ? <ShopPriceCalculator products={products} /> : <MarkupMarginCalculator />}
    </Card>
  );
}

function BulkPricingModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const categories = useCategories();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [rule, setRule] = useState<Rule>('markup_on_cost');
  const [pct, setPct] = useState('15');
  const [rounding, setRounding] = useState<Rounding>('none');
  const [gst, setGst] = useState(false);
  const [busy, setBusy] = useState(false);

  const targets = products.filter(p => (!category || p.category_id === category) && p.wholesale_unit_cost > 0);
  const preview = targets.map(p => ({ p, next: priceFor(p.wholesale_unit_cost, rule, Number(pct) || 0, gst, rounding) }));

  const apply = async () => {
    setBusy(true);
    try {
      for (const { p, next } of preview) {
        await api.updateProduct(p.id, {
          pricing_rule: rule,
          pricing_rule_percentage: Number(pct) || 0,
          suggested_price: calculateSuggestedPrice(p.wholesale_unit_cost, Number(pct) || 0, rule),
          actual_listed_price: next,
        });
      }
      await Promise.all(STOCK_KEYS.map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(`Updated prices for ${preview.length} product${preview.length === 1 ? '' : 's'}.`);
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Layers className="h-5 w-5" />}
      title="Apply a pricing rule to many products"
      description="Updates the rule and the listed price. Orders already placed keep the price they were sold at."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={preview.length === 0} onClick={apply}>
            Update {preview.length} product{preview.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Products" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All products with a cost</option>
          {(categories.data || []).map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Rule" value={rule} onChange={e => setRule(e.target.value as Rule)}>
          <option value="markup_on_cost">Markup on cost</option>
          <option value="gross_margin">Gross margin</option>
        </Select>
        <Input label={rule === 'markup_on_cost' ? 'Markup %' : 'Margin %'} type="number" min="0" step="0.01" value={pct} onChange={e => setPct(e.target.value)} />
        <Select label="Rounding" value={rounding} onChange={e => setRounding(e.target.value as Rounding)}>
          {ROUNDING_OPTIONS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Toggle checked={gst} onChange={setGst} label={`Include ${GST_RATE}% GST in the listed price`} />
        </div>
      </div>
      <ul className="mt-5 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
        {preview.map(({ p, next }) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="min-w-0 truncate text-fg-2">{p.name}</span>
            <span className="tabular shrink-0 text-fg-3">
              {formatMVR(p.actual_listed_price)} → <span className="font-semibold text-fg">{formatMVR(next)}</span>
            </span>
          </li>
        ))}
        {preview.length === 0 && <li className="px-3.5 py-6 text-center text-fg-3">No products with a wholesale cost in this selection.</li>}
      </ul>
    </Modal>
  );
}

export function PricingPage() {
  const products = useProducts();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [bulk, setBulk] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ pct: '', price: '', rule: 'markup_on_cost' as Rule });
  const [saving, setSaving] = useState(false);
  const list = useMemo(() => [...(products.data || [])].sort((a, b) => a.name.localeCompare(b.name)), [products.data]);

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setDraft({ pct: String(p.pricing_rule_percentage), price: String(p.actual_listed_price), rule: p.pricing_rule === 'gross_margin' ? 'gross_margin' : 'markup_on_cost' });
  };
  const save = async (p: Product) => {
    setSaving(true);
    try {
      await api.updateProduct(p.id, {
        pricing_rule: draft.rule as PricingRule,
        pricing_rule_percentage: Number(draft.pct) || 0,
        suggested_price: calculateSuggestedPrice(p.wholesale_unit_cost, Number(draft.pct) || 0, draft.rule),
        actual_listed_price: Number(draft.price) || 0,
      });
      await Promise.all(STOCK_KEYS.map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(`${p.name} repriced.`);
      setEditId(null);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Set prices from wholesale cost with a markup or a target margin. Only the owner sees this page."
        actions={
          <Button icon={<Layers className="h-4 w-4" />} onClick={() => setBulk(true)}>
            Bulk update
          </Button>
        }
      />
      <PricingCalculator products={list} />

      <Card className="mt-5">
        <CardHeader title="Product prices" description="Listed price vs the price your rule suggests." />
        <Table
          rows={list}
          rowKey={p => p.id}
          columns={[
            {
              key: 'name',
              header: 'Product',
              primary: true,
              render: p => (
                <span>
                  <span className="block font-medium text-fg">{p.name}</span>
                  <span className="text-fg-3">{p.sku}</span>
                </span>
              ),
            },
            { key: 'cost', header: 'Cost', align: 'right', render: p => <span className="tabular">{formatMVR(p.wholesale_unit_cost)}</span> },
            {
              key: 'rule',
              header: 'Rule',
              render: p =>
                editId === p.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Rule"
                      value={draft.rule}
                      onChange={e => setDraft(d => ({ ...d, rule: e.target.value as Rule }))}
                      className="focus-ring h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
                    >
                      <option value="markup_on_cost">Markup</option>
                      <option value="gross_margin">Margin</option>
                    </select>
                    <input
                      aria-label="Percent"
                      type="number"
                      step="0.01"
                      value={draft.pct}
                      onChange={e => setDraft(d => ({ ...d, pct: e.target.value }))}
                      className="focus-ring tabular h-9 w-20 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm"
                    />
                    <span className="text-fg-4">%</span>
                  </div>
                ) : (
                  <span>
                    {p.pricing_rule === 'gross_margin' ? 'Margin' : 'Markup'} {p.pricing_rule_percentage}%
                  </span>
                ),
            },
            {
              key: 'suggested',
              header: 'Suggested',
              align: 'right',
              render: p => {
                const s = editId === p.id ? calculateSuggestedPrice(p.wholesale_unit_cost, Number(draft.pct) || 0, draft.rule) : p.suggested_price;
                return editId === p.id ? (
                  <button type="button" className="tabular cursor-pointer font-medium text-fg-2 underline-offset-4 hover:underline" onClick={() => setDraft(d => ({ ...d, price: s.toFixed(2) }))} title="Use this price">
                    {formatMVR(s)}
                  </button>
                ) : (
                  <span className="tabular">{formatMVR(s)}</span>
                );
              },
            },
            {
              key: 'listed',
              header: 'Listed',
              align: 'right',
              render: p =>
                editId === p.id ? (
                  <input
                    aria-label="Listed price"
                    type="number"
                    step="0.01"
                    value={draft.price}
                    onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                    className="focus-ring tabular h-9 w-28 rounded-lg border border-line-strong bg-surface px-2 text-right text-sm"
                  />
                ) : (
                  <span className="tabular font-medium text-fg">{formatMVR(p.actual_listed_price)}</span>
                ),
            },
            {
              key: 'margin',
              header: 'Margin',
              align: 'right',
              render: p => {
                const price = editId === p.id ? Number(draft.price) || 0 : p.actual_listed_price;
                if (!price) return '—';
                const m = ((price - p.wholesale_unit_cost) / price) * 100;
                return <Badge color={m < 0 ? 'error' : m < 5 ? 'warning' : 'success'}>{m.toFixed(1)}%</Badge>;
              },
            },
            {
              key: 'actions',
              header: <span className="sr-only">Edit</span>,
              align: 'right',
              render: p =>
                editId === p.id ? (
                  <span className="flex justify-end gap-1">
                    <Button size="sm" variant="tertiary" iconOnly icon={<X className="h-4 w-4" />} onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" iconOnly icon={<Check className="h-4 w-4" />} loading={saving} onClick={() => save(p)}>
                      Save
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="tertiary" iconOnly icon={<Pencil className="h-4 w-4" />} onClick={() => startEdit(p)}>
                    Edit price
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      {bulk && <BulkPricingModal products={list} onClose={() => setBulk(false)} />}
    </>
  );
}
