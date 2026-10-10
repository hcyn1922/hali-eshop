import React, { useState } from 'react';
import { Check, KeyRound, MoreHorizontal, Power, ShieldCheck, Trash2, UserCog, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../app/permissions';
import { keys, useAction, useAuthSettings, useStaff } from '../../app/queries';
import { api } from '../../lib/api';
import { formatMaldivesDate } from '../../lib/formatters';
import type { StaffProfile, StaffRole } from '../../types';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Menu, Modal, PageHeader, Select, Table, Tabs, Toggle, type BadgeColor } from '../../ui';

const ROLES: StaffRole[] = ['owner', 'sales', 'inventory', 'marketing'];
const ROLE_COLORS: Record<StaffRole, BadgeColor> = { owner: 'navy', sales: 'blue', inventory: 'purple', marketing: 'gray' };

type Tab = 'team' | 'requests' | 'inactive';

function InviteModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'sales' as StaffRole, password: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = useAction(() => api.inviteStaff({ ...form, password: form.password || undefined, is_active: true }), {
    invalidate: [keys.staff],
    success: s => `${s.full_name} added as ${ROLE_LABELS[s.role]}.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      icon={<UserPlus className="h-5 w-5" />}
      title="Add staff member"
      description="Give them a shop password now, or invite the same email from Supabase Authentication."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.full_name.trim() || !form.email.trim() || (form.password !== '' && form.password.length < 8)}
            onClick={() => save.mutate(undefined)}
          >
            Add staff member
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={form.full_name} onChange={set('full_name')} />
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Select label="Role" value={form.role} onChange={set('role')}>
          {ROLES.map(r => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <p className="-mt-2 text-sm text-fg-3 sm:col-span-2">{ROLE_DESCRIPTIONS[form.role]}</p>
        <Input
          label="Initial password"
          type="text"
          autoComplete="off"
          value={form.password}
          onChange={set('password')}
          containerClassName="sm:col-span-2"
          hint="Optional. At least 8 characters. Share it privately; they can change it in Settings."
          error={form.password !== '' && form.password.length < 8 ? 'At least 8 characters.' : null}
        />
      </div>
    </Modal>
  );
}

function RoleModal({ member, onClose }: { member: StaffProfile; onClose: () => void }) {
  const [role, setRole] = useState<StaffRole>(member.role);
  const save = useAction(() => api.changeStaffRole(member.id, role), {
    invalidate: [keys.staff],
    success: s => `${s.full_name} is now ${ROLE_LABELS[s.role]}.`,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      icon={<UserCog className="h-5 w-5" />}
      title={`Change role for ${member.full_name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={role === member.role} onClick={() => save.mutate(undefined)}>
            Save role
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {ROLES.map(r => (
          <label key={r} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${role === r ? 'border-navy-900 ring-1 ring-navy-900 dark:border-white dark:ring-white' : 'border-line'}`}>
            <input type="radio" name="role" className="mt-1 accent-navy-900" checked={role === r} onChange={() => setRole(r)} />
            <span>
              <span className="block text-sm font-semibold text-fg">{ROLE_LABELS[r]}</span>
              <span className="text-sm text-fg-3">{ROLE_DESCRIPTIONS[r]}</span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }: { member: StaffProfile; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const save = useAction(() => api.resetStaffPassword(member.id, password), { invalidate: [keys.staff], success: r => r.message, onSuccess: onClose });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      icon={<KeyRound className="h-5 w-5" />}
      title="Set a new password"
      description={`For ${member.full_name}. They'll be signed out on all devices.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={password.length < 8} onClick={() => save.mutate(undefined)}>
            Save password
          </Button>
        </>
      }
    >
      <Input label="New password" type="text" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} hint="At least 8 characters." />
    </Modal>
  );
}

function AccessSettings() {
  const settings = useAuthSettings();
  const save = useAction(api.updateAuthSettings, { invalidate: [keys.authSettings], success: 'Access settings saved.' });
  const s = settings.data;
  if (!s) return null;
  return (
    <Card className="mt-5">
      <CardHeader title="Sign-up settings" description="Control who can create an account." />
      <div className="flex flex-col gap-5 p-5">
        <Toggle
          checked={s.allow_open_registration}
          onChange={v => save.mutate({ allow_open_registration: v })}
          label="Approve new sign-ups automatically"
          hint="Off (recommended): you approve every request on the Requests tab."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Role for auto-approved sign-ups"
            value={s.default_role}
            onChange={e => save.mutate({ default_role: e.target.value as StaffRole })}
            disabled={!s.allow_open_registration}
          >
            {ROLES.filter(r => r !== 'owner').map(r => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Select label="Stay signed in for" value={String(s.session_duration_days)} onChange={e => save.mutate({ session_duration_days: Number(e.target.value) })}>
            {[1, 7, 14, 30].map(d => (
              <option key={d} value={d}>
                {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}

export function StaffPage() {
  const { staff: me, primaryOwnerEmail } = useAuth();
  const staff = useStaff();
  const [tab, setTab] = useState<Tab>('team');
  const [modal, setModal] = useState<{ kind: 'invite' | 'role' | 'password' | 'delete'; member?: StaffProfile } | null>(null);
  const [approveRole, setApproveRole] = useState<Record<string, StaffRole>>({});

  const all = staff.data || [];
  const team = all.filter(s => s.approval_status === 'approved' && s.is_active);
  const requests = all.filter(s => s.approval_status === 'pending');
  const inactive = all.filter(s => (s.approval_status === 'approved' && !s.is_active) || s.approval_status === 'rejected');

  const invalidate = [keys.staff];
  const toggle = useAction(api.toggleStaffActive, { invalidate, success: s => `${s.full_name} ${s.is_active ? 'reactivated' : 'deactivated'}.` });
  const approve = useAction((a: { id: string; role: StaffRole }) => api.approveStaffRequest(a.id, a.role), {
    invalidate,
    success: s => `${s.full_name} approved as ${ROLE_LABELS[s.role]}.`,
  });
  const reject = useAction(api.rejectStaffRequest, { invalidate, success: 'Request declined.' });
  const remove = useAction(api.deleteStaff, { invalidate, success: r => r.message, onSuccess: () => setModal(null) });

  const isProtected = (s: StaffProfile) => s.id === me?.id || s.email.toLowerCase() === primaryOwnerEmail;
  const rows = tab === 'team' ? team : tab === 'requests' ? requests : inactive;

  return (
    <>
      <PageHeader
        title="Staff & access"
        description="Who can sign in, and what each role can see and do."
        actions={
          <Button variant="primary" icon={<UserPlus className="h-5 w-5" />} onClick={() => setModal({ kind: 'invite' })}>
            Add staff
          </Button>
        }
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'team', label: 'Team', count: team.length },
          { key: 'requests', label: 'Requests', count: requests.length },
          { key: 'inactive', label: 'Deactivated', count: inactive.length },
        ]}
      />
      <Card>
        <Table
          rows={rows}
          rowKey={s => s.id}
          empty={
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title={tab === 'requests' ? 'No requests waiting' : tab === 'inactive' ? 'Nobody is deactivated' : 'No staff yet'}
            />
          }
          columns={[
            {
              key: 'member',
              header: 'Member',
              primary: true,
              render: s => (
                <div className="flex items-center gap-3">
                  <Avatar name={s.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {s.full_name}
                      {s.id === me?.id && <span className="font-normal text-fg-4"> (you)</span>}
                    </p>
                    <p className="truncate text-fg-3">{s.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              header: tab === 'requests' ? 'Requested role' : 'Role',
              render: s => <Badge color={ROLE_COLORS[s.role]}>{ROLE_LABELS[s.role]}</Badge>,
            },
            ...(tab === 'requests'
              ? [{ key: 'note', header: 'Note', hideOnMobile: true, render: (s: StaffProfile) => <span className="line-clamp-2">{s.request_note || '—'}</span> }]
              : [{ key: 'phone', header: 'Phone', hideOnMobile: true, render: (s: StaffProfile) => s.phone || '—' }]),
            { key: 'since', header: tab === 'requests' ? 'Requested' : 'Joined', render: s => formatMaldivesDate(s.created_at) },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: s =>
                tab === 'requests' ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <select
                      aria-label="Approve as"
                      value={approveRole[s.id] || s.role}
                      onChange={e => setApproveRole(r => ({ ...r, [s.id]: e.target.value as StaffRole }))}
                      className="focus-ring h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" icon={<X className="h-4 w-4" />} onClick={() => reject.mutate(s.id)}>
                      Decline
                    </Button>
                    <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => approve.mutate({ id: s.id, role: approveRole[s.id] || s.role })}>
                      Approve
                    </Button>
                  </div>
                ) : isProtected(s) ? (
                  <span className="text-xs text-fg-4">{s.id === me?.id ? 'Your account' : 'Primary owner'}</span>
                ) : (
                  <Menu
                    items={[
                      { label: 'Change role', icon: <UserCog className="h-4 w-4" />, onSelect: () => setModal({ kind: 'role', member: s }), hidden: !s.is_active },
                      { label: 'Set new password', icon: <KeyRound className="h-4 w-4" />, onSelect: () => setModal({ kind: 'password', member: s }) },
                      {
                        label: s.is_active ? 'Deactivate' : 'Reactivate',
                        icon: <Power className="h-4 w-4" />,
                        onSelect: () => (s.approval_status === 'rejected' ? approve.mutate({ id: s.id, role: s.role }) : toggle.mutate(s.id)),
                      },
                      { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setModal({ kind: 'delete', member: s }) },
                    ]}
                    trigger={({ toggle: open }) => (
                      <Button size="sm" variant="tertiary" iconOnly icon={<MoreHorizontal className="h-5 w-5" />} onClick={open}>
                        Actions for {s.full_name}
                      </Button>
                    )}
                  />
                ),
            },
          ]}
        />
      </Card>

      <AccessSettings />

      {modal?.kind === 'invite' && <InviteModal onClose={() => setModal(null)} />}
      {modal?.kind === 'role' && modal.member && <RoleModal member={modal.member} onClose={() => setModal(null)} />}
      {modal?.kind === 'password' && modal.member && <ResetPasswordModal member={modal.member} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && modal.member && (
        <Modal
          open
          size="sm"
          onClose={() => setModal(null)}
          title={`Delete ${modal.member.full_name}?`}
          description="Their account and password are removed permanently. Orders and stock records they created stay in the system."
          footer={
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="destructive" loading={remove.isPending} onClick={() => remove.mutate(modal.member!.id)}>
                Delete account
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
