import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../app/auth';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../app/permissions';
import type { StaffRole } from '../../types';
import { Button, Input, Select, Textarea } from '../../ui';
import { AuthLayout } from './AuthLayout';

const ROLES: StaffRole[] = ['sales', 'inventory', 'marketing'];

export function RequestAccessPage() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'sales' as StaffRole, password: '', confirm: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
        request_note: form.note.trim(),
      });
      if (res.session) {
        await completeSignIn(res.session.token, res.session.staff);
        navigate('/', { replace: true });
      } else {
        setDone(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Request sent" subtitle="The shop owner will review it shortly.">
        <div className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          You can sign in with this email and password once your account is approved.
        </div>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/login')}>
          Back to log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Request access" subtitle="Ask the shop owner for a staff account.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Input label="Full name" required value={form.full_name} onChange={set('full_name')} autoComplete="name" />
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+960 7xx xxxx" autoComplete="tel" />
        <Select label="Role" value={form.role} onChange={set('role')} hint={ROLE_DESCRIPTIONS[form.role]}>
          {ROLES.map(r => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Input label="Password" type="password" required minLength={8} value={form.password} onChange={set('password')} hint="At least 8 characters." autoComplete="new-password" />
        <Input label="Confirm password" type="password" required minLength={8} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
        <Textarea label="Note for the owner" value={form.note} onChange={set('note')} rows={2} placeholder="Optional" />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-2 w-full">
          Send request
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-fg-3">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
