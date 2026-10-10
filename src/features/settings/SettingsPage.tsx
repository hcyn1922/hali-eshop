import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can, ROLE_LABELS } from '../../app/permissions';
import { keys, useAction, useShopProfile, useStatus } from '../../app/queries';
import { useTheme } from '../../app/theme';
import { api } from '../../lib/api';
import { supabase } from '../../supabaseClient';
import type { ShopProfile } from '../../types';
import { Badge, Button, Card, Input, PageHeader, Tabs, Textarea, cn } from '../../ui';

type Tab = 'profile' | 'password' | 'shop' | 'setup';

/** Two-column settings section (label on the left, form on the right) in the Untitled UI style. */
function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-line py-6 last:border-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-3">{description}</p>}
      </div>
      <div className="max-w-xl">
        {children}
        {footer && <div className="mt-5 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

function ProfileTab() {
  const { staff, role, refreshProfile } = useAuth();
  const { isDark, toggle } = useTheme();
  const [name, setName] = useState(staff?.full_name || '');
  const [phone, setPhone] = useState(staff?.phone || '');
  const save = useAction(() => api.updateStaffProfile(staff!.id, { full_name: name, phone }), {
    invalidate: [keys.staff],
    success: 'Profile saved.',
    onSuccess: () => refreshProfile(),
  });
  return (
    <>
      <Section
        title="Personal info"
        description="How you appear to the team."
        footer={
          <Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Full name" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Email" value={staff?.email || ''} disabled hint="Only the owner can change sign-in emails." />
          <Input label="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg-2">Role</p>
            <Badge color="navy">{ROLE_LABELS[role]}</Badge>
          </div>
        </div>
      </Section>
      <Section title="Appearance" description="Saved on this device.">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          {[
            { dark: false, label: 'Light', icon: Sun },
            { dark: true, label: 'Dark', icon: Moon },
          ].map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => opt.dark !== isDark && toggle()}
              className={cn(
                'focus-ring flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold',
                opt.dark === isDark ? 'border-navy-900 text-fg ring-1 ring-navy-900 dark:border-white dark:ring-white' : 'border-line text-fg-3 hover:bg-hover'
              )}
            >
              <opt.icon className="h-4 w-4" /> {opt.label}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

function PasswordTab() {
  const { hasLocalPassword, refreshProfile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm !== '' && next !== confirm;
  const save = useAction(() => api.changePassword({ currentPassword: current, newPassword: next }), {
    invalidate: [],
    success: 'Password updated.',
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      refreshProfile();
    },
  });
  return (
    <Section
      title="Shop password"
      description={hasLocalPassword ? 'Used with your email on the log-in page.' : 'You sign in with Supabase. You can also set a shop password.'}
      footer={
        <Button variant="primary" loading={save.isPending} disabled={next.length < 8 || mismatch || (hasLocalPassword && !current)} onClick={() => save.mutate(undefined)}>
          Update password
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {hasLocalPassword && <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />}
        <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} hint="At least 8 characters." />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          error={mismatch ? 'The passwords do not match.' : null}
        />
      </div>
    </Section>
  );
}

function ShopTab() {
  const shop = useShopProfile();
  const [form, setForm] = useState<ShopProfile | null>(null);
  useEffect(() => {
    if (shop.data && !form) setForm(shop.data);
  }, [shop.data, form]);
  const save = useAction(() => api.updateShopProfile(form!), { invalidate: [keys.shop], success: 'Shop details saved.' });
  if (!form) return null;
  const set = (k: keyof ShopProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f!, [k]: e.target.value }));
  return (
    <Section
      title="Shop details"
      description="Printed on every invoice you send to buyers."
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate(undefined)}>
          Save shop details
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Shop name" required value={form.name} onChange={set('name')} containerClassName="sm:col-span-2" />
        <Input label="Tagline" value={form.tagline} onChange={set('tagline')} containerClassName="sm:col-span-2" placeholder="e.g. Perfumes & cosmetics" />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Instagram" value={form.instagram} onChange={set('instagram')} placeholder="@yourshop" />
        <Input label="GST TIN" value={form.gst_tin} onChange={set('gst_tin')} hint="Only if GST-registered." />
        <Input label="Address" value={form.address} onChange={set('address')} containerClassName="sm:col-span-2" />
        <Textarea label="Bank details for payment" rows={3} value={form.bank_details} onChange={set('bank_details')} containerClassName="sm:col-span-2" placeholder="Bank, account name and number" />
        <Textarea label="Invoice footer note" rows={2} value={form.invoice_note} onChange={set('invoice_note')} containerClassName="sm:col-span-2" />
      </div>
    </Section>
  );
}

function SetupTab() {
  const status = useStatus();
  const shop = useShopProfile();
  const items = [
    {
      done: status.data?.storage === 'supabase',
      title: 'Durable database (Supabase)',
      body:
        status.data?.storage === 'supabase'
          ? 'Data is stored in your Supabase project.'
          : 'Data is in a local file on the server. Set SUPABASE_SERVICE_ROLE_KEY before going live on Vercel.',
    },
    {
      done: Boolean(supabase),
      title: 'Password reset emails (Supabase Auth)',
      body: supabase ? 'Staff can reset their own password by email.' : 'Without it, the owner resets passwords from Staff & access.',
    },
    {
      done: Boolean(shop.data?.phone || shop.data?.instagram),
      title: 'Shop details for invoices',
      body: 'Add your phone, Instagram and bank details in the Shop details tab.',
    },
  ];
  return (
    <Section title="Go-live checklist" description="The full step-by-step guide is in the README file of the code repository.">
      <ul className="flex flex-col gap-3">
        {items.map(i => (
          <li key={i.title} className="flex gap-3 rounded-lg border border-line p-4">
            {i.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-fg-4" />}
            <div>
              <p className="text-sm font-semibold text-fg">{i.title}</p>
              <p className="mt-0.5 text-sm text-fg-3">{i.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SettingsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const isOwner = can.manageStaff(role);
  return (
    <>
      <PageHeader title="Settings" description="Your account and shop preferences." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'profile', label: 'My profile' },
          { key: 'password', label: 'Password' },
          ...(isOwner ? [{ key: 'shop' as Tab, label: 'Shop details' }, { key: 'setup' as Tab, label: 'Setup' }] : []),
        ]}
      />
      <Card className="mt-6 px-5 sm:px-6">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'password' && <PasswordTab />}
        {tab === 'shop' && isOwner && <ShopTab />}
        {tab === 'setup' && isOwner && <SetupTab />}
      </Card>
    </>
  );
}
