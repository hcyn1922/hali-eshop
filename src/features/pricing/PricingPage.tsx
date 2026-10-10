import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

/**
 * When a supplier changes the cost (e.g. a 25% discount), shows the new price
 * that keeps the same margin % and the one that keeps the same profit per unit,
 * then lets the owner finalise a price and set it on the product.
 */
function CostChangeCalculator({ products }: { products: Product[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [originalCost, setOriginalCost] = useState('430');
  const [discount, setDiscount] = useState('25');
  const [margin, setMargin] = useState('14');
  const [finalPrice, setFinalPrice] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [saving, setSaving] = useState(false);

  const product = products.find(p => p.id === productId);
  const cost = Number(originalCost) || 0;
  const d = Math.min(Math.max(Number(discount) || 0, -1000), 100) / 100;
  const m = Math.min(Math.max(Number(margin) || 0, 0), 99.99) / 100;

  const newCost = round2(cost * (1 - d));
  const currentPrice = round2(cost / (1 - m));
  const currentProfit = round2(currentPrice - cost);
  const sameMarginPrice = round2(newCost / (1 - m));
  const sameProfitPrice = round2(newCost + currentProfit);

  const chosen = Number(finalPrice);
  const hasFinal = finalPrice !== '' && Number.isFinite(chosen) && chosen > 0;
  const finalProfit = round2(chosen - newCost);

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find(x => x.id === id);
    if (!p) return;
    setOriginalCost(String(p.wholesale_unit_cost));
    if (p.actual_listed_price > 0 && p.wholesale_unit_cost > 0) {
      setMargin(String(round2(((p.actual_listed_price - p.wholesale_unit_cost) / p.actual_listed_price) * 100)));
    }
    setFinalPrice('');
  };

  const setPrice = async () => {
    if (!product || !hasFinal) return;
    setSaving(true);
    try {
      await api.updateProduct(product.id, {
        actual_listed_price: round2(chosen),
        ...(updateCost && newCost !== product.wholesale_unit_cost
          ? {
              wholesale_unit_cost: newCost,
              suggested_price: calculateSuggestedPrice(newCost, product.pricing_rule_percentage, product.pricing_rule === 'gross_margin' ? 'gross_margin' : 'markup_on_cost'),
            }
          : {}),
      });
      await Promise.all(STOCK_KEYS.map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(`${product.name} now sells for ${formatMVR(chosen)}.`);
      setOriginalCost(String(updateCost ? newCost : cost));
      setDiscount('0');
      setMargin(String(round2(((chosen - (updateCost ? newCost : cost)) / chosen) * 100)));
      setFinalPrice('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const scenarios = [
    { key: 'margin', title: `Keep the ${pctText(m * 100)} margin`, price: sameMarginPrice, note: `${formatMVR(newCost)} ÷ (1 − ${pctText(m * 100)})` },
    { key: 'profit', title: `Keep the ${formatMVR(currentProfit)} profit`, price: sameProfitPrice, note: `${formatMVR(newCost)} + ${formatMVR(currentProfit)}` },
  ];

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Select label="Product" hint="Optional. Fills in its cost and current margin, and lets you set the final price on it." value={productId} onChange={e => pickProduct(e.target.value)}>
          <option value="">No product, just calculate</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
        <Input label="Original cost" type="number" min="0" step="0.01" value={originalCost} onChange={e => setOriginalCost(e.target.value)} leading={<span className="text-xs">MVR</span>} />
        <Input label="Supplier discount" hint="Use a negative number for a price increase." type="number" max="100" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} trailing={<span className="text-xs">%</span>} />
        <Input label="Current margin" hint="Profit as a share of the selling price." type="number" min="0" max="99.99" step="0.01" value={margin} onChange={e => setMargin(e.target.value)} trailing={<span className="text-xs">%</span>} />
        <dl className="divide-y divide-line rounded-lg border border-line px-4">
          <DetailRow label="New cost">
            <span className="tabular font-semibold text-fg">{formatMVR(newCost)}</span>
          </DetailRow>
          <DetailRow label="Current selling price">
            <span className="tabular">{formatMVR(product?.actual_listed_price || currentPrice)}</span>
          </DetailRow>
          <DetailRow label="Current profit per unit">
            <span className="tabular">{formatMVR(currentProfit)}</span>
          </DetailRow>
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map(s => {
            const selected = hasFinal && round2(chosen) === s.price;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setFinalPrice(s.price.toFixed(2))}
                className={cn(
                  'focus-ring cursor-pointer rounded-xl p-4 text-left ring-1 ring-inset transition-colors',
                  selected ? 'bg-primary/5 ring-2 ring-primary' : 'bg-subtle ring-line hover:bg-hover'
                )}
              >
                <p className="text-sm font-medium text-fg-3">{s.title}</p>
                <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-fg">{formatMVR(s.price)}</p>
                <p className="mt-1 font-mono text-xs text-fg-4">{s.note}</p>
                <p className="mt-3 text-xs font-medium text-fg-2">{selected ? 'Selected' : 'Use this price'}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col rounded-xl bg-subtle p-5 ring-1 ring-inset ring-line">
          <p className="text-sm font-semibold text-fg">Finalise the price</p>
          <p className="mt-0.5 text-sm text-fg-3">Pick a suggestion above or type your own price.</p>
          <Input
            containerClassName="mt-4"
            label="Final selling price"
            type="number"
            min="0"
            step="0.01"
            placeholder={sameMarginPrice.toFixed(2)}
            value={finalPrice}
            onChange={e => setFinalPrice(e.target.value)}
            leading={<span className="text-xs">MVR</span>}
          />
          {hasFinal && (
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <DetailRow label="Profit per unit">
                <span className={cn('tabular', finalProfit < 0 && 'text-error-600')}>{formatMVR(finalProfit)}</span>
              </DetailRow>
              <DetailRow label="Margin on price">{pctText((finalProfit / chosen) * 100)}</DetailRow>
              <DetailRow label="Markup on cost">{newCost > 0 ? pctText((finalProfit / newCost) * 100) : '—'}</DetailRow>
            </dl>
          )}
          <div className="mt-auto pt-4">
            {product ? (
              <>
                {newCost !== product.wholesale_unit_cost && (
                  <div className="mb-4">
                    <Toggle
                      checked={updateCost}
                      onChange={setUpdateCost}
                      label={`Also change its cost to ${formatMVR(newCost)}`}
                      hint="New orders then record the new cost. Turn off while you still sell stock bought at the old cost."
                    />
                  </div>
                )}
                <Button variant="primary" className="w-full" icon={<Check className="h-4 w-4" />} loading={saving} disabled={!hasFinal} onClick={setPrice}>
                  {hasFinal ? `Set ${product.name} to ${formatMVR(chosen)}` : 'Choose a price first'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-fg-3">Choose a product at the top to set this price on it.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCalculator({ products }: { products: Product[] }) {
  const [mode, setMode] = useState<'cost_change' | 'markup_margin'>('cost_change');
  return (
    <Card>
      <CardHeader
        title="Price calculator"
        description={mode === 'cost_change' ? 'Work out a new price when the supplier changes the cost.' : 'Compare markup on cost with margin on the selling price.'}
        actions={
          <Segmented
            items={[
              { key: 'cost_change', label: 'Cost change' },
              { key: 'markup_margin', label: 'Markup or margin' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
      />
      {mode === 'cost_change' ? <CostChangeCalculator products={products} /> : <MarkupMarginCalculator />}
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
