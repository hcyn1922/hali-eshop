import React, { useMemo, useState } from 'react';
import { Boxes, PackagePlus, SlidersHorizontal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { STOCK_KEYS, keys, useAction, useCategories, useProducts, useSuppliers } from '../../app/queries';
import { api } from '../../lib/api';
import { calculateSuggestedPrice, formatMVR } from '../../lib/formatters';
import type { PricingRule, Product, ProductImage } from '../../types';
import { Button, Input, Modal, Segmented, Select, Textarea, Toggle, useToast } from '../../ui';
import { ImageUploader } from './ImageUploader';

const DEFAULT_MARKUP = 7.14;

export function ProductFormModal({ product, open, onClose }: { product?: Product; open: boolean; onClose: (saved?: Product) => void }) {
  const { role } = useAuth();
  const isOwner = can.seeCosts(role);
  const categories = useCategories();
  const suppliers = useSuppliers();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category_id: product?.category_id || '',
    supplier_id: product?.supplier_id || '',
    description: product?.description || '',
    cost: product ? String(product.wholesale_unit_cost || '') : '',
    rule: (product?.pricing_rule === 'gross_margin' ? 'gross_margin' : 'markup_on_cost') as PricingRule,
    percentage: product ? String(product.pricing_rule_percentage ?? DEFAULT_MARKUP) : String(DEFAULT_MARKUP),
    price: product ? String(product.actual_listed_price) : '',
    threshold: String(product?.low_stock_threshold ?? 5),
    openingStock: '0',
    active: product?.is_active ?? true,
  });
  const [images, setImages] = useState<ProductImage[]>(product?.images || []);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const suggested = useMemo(
    () => calculateSuggestedPrice(Number(form.cost) || 0, Number(form.percentage) || 0, form.rule),
    [form.cost, form.percentage, form.rule]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let categoryId = form.category_id;
      if (categoryId === '__new') {
        const created = await api.createCategory(newCategory.trim());
        categoryId = created.id;
      }
      const price = form.price === '' ? suggested : Number(form.price);
      const body: Partial<Product> & { openingStock?: number } = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category_id: categoryId,
        supplier_id: form.supplier_id,
        description: form.description.trim(),
        images,
        actual_listed_price: price,
        low_stock_threshold: Number(form.threshold) || 0,
        is_active: form.active,
      };
      if (isOwner) {
        Object.assign(body, {
          wholesale_unit_cost: Number(form.cost) || 0,
          pricing_rule: form.rule,
          pricing_rule_percentage: Number(form.percentage) || 0,
          suggested_price: suggested,
        });
      }
      const saved = product
        ? await api.updateProduct(product.id, body)
        : await api.createProduct({ ...body, openingStock: Number(form.openingStock) || 0 });
      await Promise.all([...STOCK_KEYS, keys.categories].map(k => queryClient.invalidateQueries({ queryKey: k })));
      toast(product ? `${saved.name} updated.` : `${saved.name} added to the catalog.`);
      onClose(saved);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => onClose()}
      size="lg"
      icon={<Boxes className="h-5 w-5" />}
      title={product ? 'Edit product' : 'New product'}
      footer={
        <>
          <Button onClick={() => onClose()}>Cancel</Button>
          <Button variant="primary" type="submit" form="product-form" loading={busy}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Product name" required value={form.name} onChange={set('name')} containerClassName="sm:col-span-2" />
          <Input label="SKU" required value={form.sku} onChange={set('sku')} placeholder="e.g. HALI-PRF-001" />
          <Select label="Category" value={form.category_id} onChange={set('category_id')}>
            <option value="">Uncategorised</option>
            {(categories.data || []).map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {can.manageCatalog(role) && <option value="__new">+ New category…</option>}
          </Select>
          {form.category_id === '__new' && (
            <Input label="New category name" required value={newCategory} onChange={e => setNewCategory(e.target.value)} containerClassName="sm:col-span-2" />
          )}
          <Select label="Supplier" value={form.supplier_id} onChange={set('supplier_id')} containerClassName="sm:col-span-2">
            <option value="">None</option>
            {(suppliers.data || []).map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Textarea label="Description" rows={2} value={form.description} onChange={set('description')} containerClassName="sm:col-span-2" />
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold text-fg">Photos</p>
          <ImageUploader images={images} onChange={setImages} />
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold text-fg">Pricing</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {isOwner && (
              <>
                <Input
                  label="Wholesale unit cost"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.cost}
                  onChange={set('cost')}
                  leading={<span className="text-xs">MVR</span>}
                />
                <div>
                  <p className="mb-1.5 text-sm font-medium text-fg-2">Pricing rule</p>
                  <Segmented
                    items={[
                      { key: 'markup_on_cost', label: 'Markup on cost' },
                      { key: 'gross_margin', label: 'Gross margin' },
                    ]}
                    value={form.rule as 'markup_on_cost' | 'gross_margin'}
                    onChange={r => setForm(f => ({ ...f, rule: r }))}
                  />
                </div>
                <Input
                  label={form.rule === 'markup_on_cost' ? 'Markup %' : 'Margin %'}
                  type="number"
                  step="0.01"
                  min="0"
                  max={form.rule === 'gross_margin' ? '99' : undefined}
                  inputMode="decimal"
                  value={form.percentage}
                  onChange={set('percentage')}
                  hint={
                    form.rule === 'markup_on_cost'
                      ? `Cost × (1 + ${form.percentage || 0}%) = ${formatMVR(suggested)}`
                      : `Cost ÷ (1 − ${form.percentage || 0}%) = ${formatMVR(suggested)}`
                  }
                />
              </>
            )}
            <Input
              label="Listed selling price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required={!isOwner}
              value={form.price}
              onChange={set('price')}
              leading={<span className="text-xs">MVR</span>}
              placeholder={isOwner ? suggested.toFixed(2) : undefined}
              hint={
                isOwner && (
                  <button type="button" className="cursor-pointer font-semibold text-fg-2 hover:text-fg" onClick={() => setForm(f => ({ ...f, price: suggested.toFixed(2) }))}>
                    Use suggested price ({formatMVR(suggested)})
                  </button>
                )
              }
            />
          </div>
        </div>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <Input label="Low-stock alert at" type="number" min="0" step="1" value={form.threshold} onChange={set('threshold')} hint="Units left before it shows as running low." />
          {!product && (
            <Input
              label="Opening stock"
              type="number"
              min="0"
              step="1"
              value={form.openingStock}
              onChange={set('openingStock')}
              hint="Recorded as the first purchase batch at the cost above."
            />
          )}
          <div className="sm:col-span-2">
            <Toggle checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} label="Active" hint="Inactive products can't be added to new orders." />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function ReceiveStockModal({ product, open, onClose }: { product?: Product; open: boolean; onClose: () => void }) {
  const products = useProducts();
  const suppliers = useSuppliers();
  const [productId, setProductId] = useState(product?.id || '');
  const target = product || (products.data || []).find(p => p.id === productId);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    batch: '',
    date: today,
    quantity: '',
    unitCost: '',
    shipping: '0',
    other: '0',
    supplier: product?.supplier_id || '',
    notes: '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const defaultBatch = target ? `${target.sku}-${today.replace(/-/g, '')}` : '';

  const action = useAction(
    () =>
      api.addBatch({
        product_id: target!.id,
        batch_number: (form.batch || defaultBatch).trim(),
        purchase_date: form.date,
        quantity: Number(form.quantity),
        unit_cost: Number(form.unitCost) || 0,
        shipping_cost: Number(form.shipping) || 0,
        other_costs: Number(form.other) || 0,
        supplier_id: form.supplier || target!.supplier_id,
        notes: form.notes.trim(),
      }),
    { invalidate: STOCK_KEYS, success: b => `Received ${b.quantity} units of ${target?.name}.`, onSuccess: onClose }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<PackagePlus className="h-5 w-5" />}
      title="Receive stock"
      description="Records a purchase batch and adds the units to available stock."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={action.isPending} disabled={!target || !(Number(form.quantity) > 0)} onClick={() => action.mutate(undefined)}>
            Receive stock
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!product && (
          <Select label="Product" required value={productId} onChange={e => setProductId(e.target.value)} containerClassName="sm:col-span-2">
            <option value="">Choose a product…</option>
            {(products.data || []).map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) · {p.available_stock} in stock
              </option>
            ))}
          </Select>
        )}
        <Input label="Quantity received" required type="number" min="1" step="1" value={form.quantity} onChange={set('quantity')} />
        <Input label="Purchase date" type="date" value={form.date} onChange={set('date')} />
        <Input label="Wholesale unit cost" type="number" min="0" step="0.01" inputMode="decimal" value={form.unitCost} onChange={set('unitCost')} leading={<span className="text-xs">MVR</span>} />
        <Input label="Shipping / freight (total)" type="number" min="0" step="0.01" inputMode="decimal" value={form.shipping} onChange={set('shipping')} leading={<span className="text-xs">MVR</span>} />
        <Input label="Other costs (total)" type="number" min="0" step="0.01" inputMode="decimal" value={form.other} onChange={set('other')} leading={<span className="text-xs">MVR</span>} />
        <Input label="Batch number" value={form.batch} onChange={set('batch')} placeholder={defaultBatch || 'Auto'} />
        <Select label="Supplier" value={form.supplier} onChange={set('supplier')} containerClassName="sm:col-span-2">
          <option value="">{target?.supplier_name ? `Product supplier (${target.supplier_name})` : 'None'}</option>
          {(suppliers.data || []).map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} containerClassName="sm:col-span-2" />
      </div>
    </Modal>
  );
}

export function CorrectStockModal({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const [count, setCount] = useState(String(product.available_stock));
  const [reason, setReason] = useState('');
  const delta = (Number(count) || 0) - product.available_stock;
  const action = useAction(() => api.correctStock(product.id, Number(count), reason.trim()), {
    invalidate: STOCK_KEYS,
    success: m => `Stock set to ${m.resulting_stock}. The correction is in the ledger.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<SlidersHorizontal className="h-5 w-5" />}
      title="Correct stock count"
      description={`Use after a physical count. ${product.name} currently shows ${product.available_stock} units.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={action.isPending}
            disabled={!reason.trim() || delta === 0 || !Number.isInteger(Number(count)) || Number(count) < 0}
            onClick={() => action.mutate(undefined)}
          >
            Save correction
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Counted units"
          type="number"
          min="0"
          step="1"
          value={count}
          onChange={e => setCount(e.target.value)}
          hint={delta === 0 ? 'Same as the current count.' : `${delta > 0 ? '+' : ''}${delta} units`}
        />
        <Textarea label="Reason" required rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Broken bottle found during count" />
      </div>
    </Modal>
  );
}
