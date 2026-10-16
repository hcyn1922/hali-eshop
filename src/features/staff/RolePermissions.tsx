import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, RotateCcw, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import {
  CONFIGURABLE_ROLES,
  PERMISSIONS,
  dependents,
  normalizePermissions,
  type ConfigurableRole,
  type Permission,
  type PermissionInfo,
} from '../../lib/permissions';
import { ROLE_LABELS } from '../../app/permissions';
import { useStatus } from '../../app/queries';
import { Badge, Button, Card, CardHeader, Modal, Segmented, Skeleton, Toggle, useToast } from '../../ui';

const GROUPS: PermissionInfo['group'][] = ['Orders', 'Buyers & delivery', 'Catalog & stock', 'Business', 'Notifications'];
const label = (key: Permission) => PERMISSIONS.find(p => p.key === key)?.label || key;

/** Owner screen: switch features on or off for each staff role. */
export function RolePermissions() {
  const queryClient = useQueryClient();
  const status = useStatus();
  const toast = useToast();
  const matrix = useQuery({ queryKey: ['role-permissions'], queryFn: api.getRolePermissions });
  const [role, setRole] = useState<ConfigurableRole>('sales');
  const [draft, setDraft] = useState<Permission[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const saved = matrix.data?.[role] || [];
  const current = draft ?? saved;
  const dirty = draft !== null && JSON.stringify([...draft].sort()) !== JSON.stringify([...saved].sort());

  // Start fresh when switching roles or after the server copy changes
  useEffect(() => setDraft(null), [role, matrix.data]);

  const toggle = (key: Permission, on: boolean) => {
    const set = new Set(current);
    if (on) set.add(key);
    else {
      set.delete(key);
      for (const d of dependents(key)) set.delete(d);
    }
    setDraft(normalizePermissions([...set]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await api.updateRolePermissions(role, current);
      queryClient.setQueryData(['role-permissions'], next);
      toast(`${ROLE_LABELS[role]} permissions saved. Staff see the change the next time they open the app.`);
      setDraft(null);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      const next = await api.resetRolePermissions();
      queryClient.setQueryData(['role-permissions'], next);
      toast('All roles are back to their standard permissions.');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setConfirmReset(false);
    }
  };

  const counts = useMemo(
    () => Object.fromEntries(CONFIGURABLE_ROLES.map(r => [r, (matrix.data?.[r] || []).length])) as Record<ConfigurableRole, number>,
    [matrix.data]
  );

  if (matrix.isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <>
      <Card>
        <CardHeader
          title="Roles & permissions"
          description="Choose what each role can see and do. The owner always has everything; staff, settings and shop details stay owner-only."
          actions={
            <Button size="sm" variant="tertiary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmReset(true)}>
              Reset to standard
            </Button>
          }
        />
        <div className="border-b border-line px-5 py-4">
          <div className="overflow-x-auto">
            <Segmented
              items={CONFIGURABLE_ROLES.map(r => ({ key: r, label: `${ROLE_LABELS[r]} · ${counts[r]}` }))}
              value={role}
              onChange={r => {
                if (dirty && !window.confirm('Discard the unsaved changes for this role?')) return;
                setRole(r);
              }}
            />
          </div>
        </div>

        <div className="divide-y divide-line">
          {GROUPS.map(group => (
            <section key={group} className="px-5 py-5">
              <h3 className="mb-4 text-sm font-semibold text-fg">{group}</h3>
              <div className="grid gap-5 lg:grid-cols-2">
                {PERMISSIONS.filter(p => p.group === group).map(p => {
                  const on = current.includes(p.key);
                  const needs = (p.requires || []).filter(r => !current.includes(r));
                  return (
                    <div key={p.key} className="flex items-start justify-between gap-4">
                      <Toggle
                        checked={on}
                        onChange={v => toggle(p.key, v)}
                        label={
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {p.label}
                            {p.sensitive && <Badge color="warning">Money</Badge>}
                          </span>
                        }
                        hint={
                          <>
                            {p.description}
                            {!on && needs.length > 0 && <span className="block text-fg-4">Also turns on: {needs.map(label).join(', ')}.</span>}
                            {p.key === 'alerts.email' && status.data && !status.data.staffEmailReady && (
                              <span className="mt-1 block text-warning-700 dark:text-warning-500">
                                {status.data.emailConfigured
                                  ? 'Staff emails start once a sending domain is verified in Resend and MAIL_FROM is set in Vercel. Until then only you get them.'
                                  : 'Emails start once RESEND_API_KEY is added in Vercel.'}
                              </span>
                            )}
                          </>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <section className="flex items-start gap-3 bg-subtle px-5 py-4 text-sm text-fg-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" />
            Always owner-only: Staff &amp; access, sign-up approvals, shop details, email setup, sample data and deleting couriers.
          </section>
        </div>

        <div className={`flex flex-col gap-3 border-t border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${dirty ? 'sticky bottom-16 z-10 shadow-lg lg:bottom-0' : ''}`}>
          <p className="text-sm text-fg-3">
            {dirty ? (
              <span className="inline-flex items-center gap-2 font-medium text-warning-700 dark:text-warning-500">
                <ShieldAlert className="h-4 w-4" /> Unsaved changes for {ROLE_LABELS[role]}
              </span>
            ) : (
              `${current.length} of ${PERMISSIONS.length} permissions on for ${ROLE_LABELS[role]}.`
            )}
          </p>
          <div className="flex gap-3">
            <Button disabled={!dirty || saving} onClick={() => setDraft(null)}>
              Discard
            </Button>
            <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>
              Save {ROLE_LABELS[role]} permissions
            </Button>
          </div>
        </div>
      </Card>

      {confirmReset && (
        <Modal
          open
          size="sm"
          onClose={() => setConfirmReset(false)}
          title="Reset every role?"
          description="Sales, Inventory lead and Marketing go back to the standard permissions the app started with."
          footer={
            <>
              <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button variant="primary" onClick={reset}>
                Reset permissions
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

/** One-line summary of what a role can currently do (used in the invite and role dialogs). */
export function RoleSummary({ role }: { role: string }) {
  const matrix = useQuery({ queryKey: ['role-permissions'], queryFn: api.getRolePermissions });
  if (role === 'owner') return <>Everything, including costs, reports, staff and settings.</>;
  const list = matrix.data?.[role as ConfigurableRole];
  if (!list) return null;
  return <>{list.length ? `Can: ${list.map(label).join(', ')}.` : 'No features switched on yet.'}</>;
}
