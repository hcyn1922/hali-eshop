import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can, ROLE_LABELS } from '../../app/permissions';
import { keys, useAction, useShops, useStatus } from '../../app/queries';
import { ShopDetailsForm } from '../shops/ShopDetailsForm';
import { useTheme } from '../../app/theme';
import { api } from '../../lib/api';
import { supabase } from '../../supabaseClient';
import { Badge, Button, Card, Input, PageHeader, Select, Tabs, Textarea, cn } from '../../ui';

type Tab = 'profile' | 'password' | 'shop' | 'setup';

/** Two-column settings section (label on the left, form on the right) in the Untitled UI style. */
function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-line py-6 last:border-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
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
  const shops = useShops();
  const list = shops.data || [];
  const [shopId, setShopId] = useState('');
  const shop = list.find(s => s.id === shopId) || list[0];
  if (!shop) return null;
  return (
    <Section title="Shop details" description="Each shop has its own logo, contacts, GST TIN and bank accounts, printed on its invoices.">
      <Select label="Shop" value={shop.id} onChange={e => setShopId(e.target.value)} containerClassName="mb-6 sm:max-w-xs">
        {list.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <ShopDetailsForm
        key={shop.id}
        shop={shop}
        footer={({ submit, busy, valid }) => (
          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>
              Save {shop.name}
            </Button>
          </div>
        )}
      />
    </Section>
  );
}

function SetupTab() {
  const status = useStatus();
  const shops = useShops();
  const testEmail = useAction(api.sendTestEmail, { invalidate: [], success: r => r.message });
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
      done: Boolean(status.data?.emailConfigured),
      title: 'Owner email notifications',
      body: status.data?.emailConfigured
        ? `New orders, deliveries and access requests are emailed to ${status.data.notifyEmail}. Staff whose role has "Order emails" also get new-order and delivery emails${status.data.staffEmailReady ? '' : ' once MAIL_FROM is set to a domain verified in Resend'}.`
        : 'Add RESEND_API_KEY in Vercel to get an email for new orders, deliveries and access requests.',
      action: status.data?.emailConfigured && (
        <Button size="sm" className="mt-3" loading={testEmail.isPending} onClick={() => testEmail.mutate(undefined)}>
          Send a test email
        </Button>
      ),
    },
    {
      done: Boolean(status.data?.aiPhotos?.enabled),
      title: 'AI studio product photos (optional)',
      body: status.data?.aiPhotos?.enabled
        ? `On, using ${status.data.aiPhotos.model}. Each person can make ${status.data.aiPhotos.dailyLimit} AI photos a day.`
        : 'Add OPENAI_API_KEY in Vercel to turn product snapshots into studio photos from the product form.',
    },
    {
      done: (shops.data || []).length > 0 && (shops.data || []).every(s => s.phone || s.instagram || s.bank_accounts?.length),
      title: 'Shop details for invoices',
      body: 'Add each shop\'s contacts and BML / MIB bank accounts in the Shop details tab.',
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
              {'action' in i && i.action}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const EMAIL_KINDS: Record<string, string> = { new_order: 'New order', delivered: 'Delivered', access_request: 'Access request', test: 'Test' };

/** Where emails come from and go to, and what happened to the latest ones. */
function EmailSection() {
  const info = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications });
  const testEmail = useAction(api.sendTestEmail, { invalidate: [['notifications']], success: r => r.message });
  const d = info.data;
  if (!d) return null;
  const failed = d.log.filter(e => !e.ok).length;
  return (
    <Section title="Email" description="Sent through Resend. The log shows every email the app tried to send and why any failed.">
      {!d.configured ? (
        <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700 ring-1 ring-inset ring-warning-200 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/30">
          Email is off: RESEND_API_KEY is not set in Vercel.
        </p>
      ) : (
        <>
          <dl className="divide-y divide-line rounded-lg border border-line px-4">
            <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-fg-3">Sent from</dt>
              <dd className="break-all font-medium text-fg sm:text-right">{d.from}</dd>
            </div>
            <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-fg-3">Sent to (owner)</dt>
              <dd className="break-all font-medium text-fg sm:text-right">{d.ownerTo}</dd>
            </div>
            <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-fg-3">Staff with Order emails</dt>
              <dd className="text-fg sm:text-right">
                {d.staffTo.length || d.staffWaiting.length
                  ? [...d.staffTo, ...d.staffWaiting].map(s => <span key={s.email} className="block break-all">{s.email}{d.staffWaiting.includes(s) && <span className="text-fg-4"> (waiting for a verified domain)</span>}</span>)
                  : <span className="text-fg-4">None</span>}
              </dd>
            </div>
          </dl>
          {d.testSender && (
            <p className="mt-3 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700 ring-1 ring-inset ring-warning-200 dark:bg-warning-500/10 dark:text-warning-500 dark:ring-warning-500/30">
              You are on Resend's test sender (onboarding@resend.dev). It only delivers to the email address your Resend account was opened with, so {d.ownerTo} must be that address. To send anywhere else, verify your domain in Resend and set MAIL_FROM in Vercel.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" loading={testEmail.isPending} onClick={() => testEmail.mutate(undefined)}>
              Send a test email
            </Button>
            {failed > 0 && <Badge color="error">{failed} of the last {d.log.length} failed</Badge>}
          </div>
        </>
      )}
      <h3 className="mb-2 mt-6 text-sm font-semibold text-fg">Recent emails</h3>
      {d.log.length === 0 ? (
        <p className="text-sm text-fg-3">No emails yet. New orders, deliveries and access requests will appear here.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {d.log.map((e, i) => (
            <li key={i} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge color={e.ok ? 'success' : 'error'}>{e.ok ? 'Sent' : 'Failed'}</Badge>
                  <span className="truncate font-medium text-fg">{e.subject}</span>
                </span>
                <span className="text-xs text-fg-4">{new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="mt-1 break-all text-fg-3">
                {EMAIL_KINDS[e.kind] || e.kind}
                {e.by ? ` · by ${e.by}` : ''} · to {e.to.join(', ')}
              </p>
              {e.error && <p className={`mt-1 ${e.ok ? 'text-warning-700 dark:text-warning-500' : 'text-error-600'}`}>{e.error}</p>}
            </li>
          ))}
        </ul>
      )}
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
        {tab === 'setup' && isOwner && (
          <>
            <SetupTab />
            <EmailSection />
          </>
        )}
      </Card>
    </>
  );
}
