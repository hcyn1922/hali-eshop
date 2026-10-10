import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../app/auth';
import { Button, Input } from '../../ui';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // 1. Shop password (set by the owner)
      try {
        const res = await api.login({ email: email.trim(), password });
        await completeSignIn(res.token, res.staff);
        navigate('/', { replace: true });
        return;
      } catch (shopErr: any) {
        // Pending / declined / deactivated accounts get a definitive answer
        if (shopErr?.message !== 'Invalid email or password.' || !supabase) throw shopErr;
      }
      // 2. Supabase Auth account with the same email
      const { data, error: sbError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (sbError || !data.session) throw new Error('Invalid email or password.');
      try {
        await completeSignIn(data.session.access_token);
        navigate('/', { replace: true });
      } catch (profileErr) {
        await supabase.auth.signOut();
        throw profileErr;
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Log in" subtitle="Welcome back. Sign in to the operations console.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-fg-2 hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-fg-3">
        New to the team?{' '}
        <Link to="/request-access" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Request access
        </Link>
      </p>
    </AuthLayout>
  );
}
