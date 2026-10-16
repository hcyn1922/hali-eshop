import React, { useState } from 'react';
import { ImagePlus, Lock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { STOCK_KEYS, keys, useAction } from '../../app/queries';
import { api } from '../../lib/api';
import type { Shop, ShopBankAccount } from '../../types';
import { Button, Input, Select, Textarea, cn, useToast } from '../../ui';

/** The banks offered first; anything else can be typed in. */
export const DEFAULT_BANKS = ['BML', 'MIB'] as const;
export const BANK_NAMES: Record<string, string> = { BML: 'Bank of Maldives (BML)', MIB: 'Maldives Islamic Bank (MIB)' };

type AccountRow = ShopBankAccount & { other: boolean };

const blankAccounts = (): AccountRow[] => DEFAULT_BANKS.map(bank => ({ bank, account_name: '', account_number: '', other: false }));

/** The shop's logo exactly as uploaded: only scaled to fit, never cropped or stretched. */
export function ShopLogo({ shop, className }: { shop: Pick<Shop, 'logo_url' | 'name'>; className?: string }) {
  if (!shop.logo_url) {
    return (
      <span className={cn('flex items-center justify-center rounded-lg bg-subtle text-lg font-semibold text-fg-3 ring-1 ring-inset ring-line', className)}>
        {shop.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={shop.logo_url} alt={`${shop.name} logo`} draggable={false} className={cn('object-contain', className)} />;
}

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

/** Name, logo, contacts, GST TIN and bank accounts for one shop (new or existing). */
export function ShopDetailsForm({ shop, onSaved, footer }: { shop?: Shop; onSaved?: (shop: Shop) => void; footer: (save: { submit: () => void; busy: boolean; valid: boolean }) => React.ReactNode }) {
  const { role } = useAuth();
  const isOwner = role === 'owner';
  const toast = useToast();
  const [form, setForm] = useState({
    name: shop?.name || '',
    tagline: shop?.tagline || '',
    phone: shop?.phone || '',
    email: shop?.email || '',
    instagram: shop?.instagram || '',
    address: shop?.address || '',
    gst_tin: shop?.gst_tin || '',
    bank_details: shop?.bank_details || '',
    invoice_note: shop?.invoice_note ?? 'Thank you for shopping with us!',
    logo_url: shop?.logo_url || '',
  });
  const [accounts, setAccounts] = useState<AccountRow[]>(() =>
    shop?.bank_accounts?.length ? shop.bank_accounts.map(a => ({ ...a, other: !DEFAULT_BANKS.includes(a.bank as any) })) : blankAccounts()
  );
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setAccount = (i: number, patch: Partial<AccountRow>) => setAccounts(list => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const save = useAction(
    () => {
      const body: Record<string, unknown> = { ...form };
      if (isOwner) body.bank_accounts = accounts.map(({ bank, account_name, account_number }) => ({ bank, account_name, account_number }));
      else {
        delete body.gst_tin;
        delete body.bank_details;
      }
      return shop ? api.updateShop(shop.id, body) : api.createShop(body);
    },
    { invalidate: [keys.shops, ...STOCK_KEYS], success: s => `${s.name} saved.`, onSuccess: onSaved }
  );

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast('Choose a PNG, JPG or WebP image.', 'error');
    if (file.size > 3 * 1024 * 1024) return toast('The logo must be under 3 MB.', 'error');
    setUploading(true);
    try {
      // Uploaded exactly as chosen (no resizing or re-compressing), so the logo is never altered
      const { url } = await api.uploadImage(await readFile(file));
      setForm(f => ({ ...f, logo_url: url }));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ShopLogo shop={{ logo_url: form.logo_url, name: form.name || '?' }} className="h-24 w-40 shrink-0 rounded-lg bg-white p-2 ring-1 ring-inset ring-line" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg-2">Logo</p>
            <div className="flex flex-wrap gap-2">
              <label className={cn('focus-within:ring-2', 'inline-flex')}>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload logo" onChange={e => uploadLogo(e.target.files?.[0])} />
                <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-fg-2 shadow-xs hover:bg-hover">
                  <ImagePlus className="h-4 w-4" /> {uploading ? 'Uploading…' : form.logo_url ? 'Change logo' : 'Upload logo'}
                </span>
              </label>
              {form.logo_url && (
                <Button size="sm" variant="tertiary" onClick={() => setForm(f => ({ ...f, logo_url: '' }))}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-4">PNG with a transparent background works best. Used as it is on invoices.</p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Input label="Shop name" required maxLength={60} value={form.name} onChange={set('name')} />
          <Input label="Tagline" maxLength={120} value={form.tagline} onChange={set('tagline')} placeholder="e.g. Watches & accessories" />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-fg">Contact details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" type="tel" maxLength={60} value={form.phone} onChange={set('phone')} placeholder="+960 7XX XXXX" />
            <Input label="Email" type="email" maxLength={120} value={form.email} onChange={set('email')} />
            <Input label="Instagram" maxLength={60} value={form.instagram} onChange={set('instagram')} placeholder="@yourshop" />
            <Input label="Address" maxLength={300} value={form.address} onChange={set('address')} placeholder="e.g. Malé, Maldives" />
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            GST and payment {!isOwner && <span className="inline-flex items-center gap-1 text-xs font-normal text-fg-4"><Lock className="h-3 w-3" /> Only the owner can change these</span>}
          </h3>
          <Input
            label="GST TIN"
            maxLength={40}
            value={form.gst_tin}
            onChange={set('gst_tin')}
            disabled={!isOwner}
            placeholder="e.g. 1234567GST501"
            hint="Leave empty if this shop is not GST-registered. Reports only work out GST for shops with a TIN."
          />
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-fg-2">Bank accounts</p>
            {accounts.map((a, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end">
                <div className="flex flex-col gap-2">
                  <Select
                    label="Bank"
                    disabled={!isOwner}
                    value={a.other ? '__other' : a.bank}
                    onChange={e => (e.target.value === '__other' ? setAccount(i, { other: true, bank: '' }) : setAccount(i, { other: false, bank: e.target.value }))}
                  >
                    {DEFAULT_BANKS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__other">Other bank…</option>
                  </Select>
                  {a.other && <Input aria-label="Bank name" placeholder="Bank name" maxLength={40} disabled={!isOwner} value={a.bank} onChange={e => setAccount(i, { bank: e.target.value })} />}
                </div>
                <Input label="Account name" maxLength={80} disabled={!isOwner} value={a.account_name} onChange={e => setAccount(i, { account_name: e.target.value })} placeholder={form.name || 'Name on the account'} />
                <Input label="Account number" inputMode="numeric" maxLength={40} disabled={!isOwner} value={a.account_number} onChange={e => setAccount(i, { account_number: e.target.value })} placeholder="7730000000000" />
                {isOwner && (
                  <Button size="md" variant="tertiary" iconOnly icon={<Trash2 className="h-4 w-4" />} onClick={() => setAccounts(list => list.filter((_, j) => j !== i))}>
                    Remove account
                  </Button>
                )}
              </div>
            ))}
            {isOwner && accounts.length < 6 && (
              <Button size="sm" className="self-start" icon={<Plus className="h-4 w-4" />} onClick={() => setAccounts(list => [...list, { bank: 'BML', account_name: '', account_number: '', other: false }])}>
                Add account
              </Button>
            )}
            <p className="text-xs text-fg-4">Accounts left without a number are not saved. Saved accounts are printed on this shop's invoices.</p>
          </div>
          <Textarea
            containerClassName="mt-4"
            label="Other payment details"
            rows={2}
            maxLength={500}
            disabled={!isOwner}
            value={form.bank_details}
            onChange={set('bank_details')}
            placeholder="e.g. Pay by card at the counter"
          />
        </section>

        <Textarea label="Invoice footer note" rows={2} maxLength={300} value={form.invoice_note} onChange={set('invoice_note')} />
      </div>
      {footer({ submit: () => save.mutate(undefined), busy: save.isPending || uploading, valid: Boolean(form.name.trim()) })}
    </>
  );
}
