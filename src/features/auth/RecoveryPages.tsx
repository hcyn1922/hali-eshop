import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../app/auth';
import { Button, Input } from '../../ui';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const back = (
    <Link to="/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-fg-3 hover:text-fg">
      <ArrowLeft className="h-4 w-4" /> Back to log in
    </Link>
  );

  if (!supabase) {
    return (
      <AuthLayout title="Forgot password?" subtitle="Ask the shop owner to set a new password for you from Staff & access.">
        {back}
      </AuthLayout>
    );
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={<>If an account exists for <b className="text-fg-2">{email}</b>, a reset link is on its way.</>}>
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-line text-fg-2 shadow-xs">
          <Mail className="h-6 w-6" />
        </div>
        <p className="mt-6 text-sm text-fg-3">Open the link on this device to choose a new password.</p>
        {back}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="No worries, we'll email you a reset link.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Send reset link
        </Button>
        <p className="text-sm text-fg-3">
          Was your password set by the owner? Ask them to reset it from <b className="text-fg-2">Staff &amp; access</b>.
        </p>
      </form>
      {back}
    </AuthLayout>
  );
}

/** Shown after opening a Supabase password-reset email. */
export function SetNewPasswordPage() {
  const { completeSignIn, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      const { data } = await supabase.auth.getSession();
      finishRecovery();
      if (data.session) await completeSignIn(data.session.access_token);
    } catch (err: any) {
      setError(err.message || 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Must be at least 8 characters.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Input label="Password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
        <Input label="Confirm password" type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
