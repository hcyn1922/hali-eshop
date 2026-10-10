import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getAuthToken, getCachedStaffProfile, isSupabaseToken, setAuthToken } from '../lib/api';
import { supabase } from '../supabaseClient';
import type { StaffProfile, StaffRole } from '../types';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'recovery';

interface AuthContextValue {
  status: AuthStatus;
  staff: StaffProfile | null;
  role: StaffRole;
  primaryOwnerEmail: string;
  hasLocalPassword: boolean;
  /** Completes a sign-in with a token; the server supplies the profile and role. */
  completeSignIn: (token: string, staff?: StaffProfile) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
  const [status, setStatus] = useState<AuthStatus>(isRecoveryLink ? 'recovery' : getAuthToken() ? 'loading' : 'loading');
  const [staff, setStaff] = useState<StaffProfile | null>(() => getCachedStaffProfile());
  const [primaryOwnerEmail, setPrimaryOwnerEmail] = useState('');
  const [hasLocalPassword, setHasLocalPassword] = useState(true);

  const loadProfile = useCallback(async () => {
    const me = await api.getMe();
    setAuthToken(getAuthToken(), me.staff);
    setStaff(me.staff);
    setPrimaryOwnerEmail(me.primary_owner_email);
    setHasLocalPassword(me.has_local_password);
    return me.staff;
  }, []);

  const completeSignIn = useCallback(
    async (token: string, profile?: StaffProfile) => {
      setAuthToken(token, profile);
      try {
        await loadProfile();
      } catch (err) {
        setAuthToken('');
        throw err;
      }
      queryClient.clear();
      setStatus('signed-in');
    },
    [loadProfile, queryClient]
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The session may already be gone
    }
    try {
      await supabase?.auth.signOut();
    } catch {
      // ignore
    }
    setAuthToken('');
    setStaff(null);
    queryClient.clear();
    setStatus('signed-out');
  }, [queryClient]);

  // Restore an existing session on first load
  useEffect(() => {
    if (isRecoveryLink) return;
    let cancelled = false;
    (async () => {
      try {
        if (getAuthToken()) {
          await loadProfile();
          if (!cancelled) setStatus('signed-in');
          return;
        }
        const { data } = (await supabase?.auth.getSession()) ?? { data: null };
        if (data?.session) {
          await completeSignIn(data.session.access_token);
          return;
        }
      } catch {
        setAuthToken('');
      }
      if (!cancelled) setStatus('signed-out');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase session events (recovery links, token refresh, sign-out elsewhere)
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthToken('');
        setStatus('recovery');
        return;
      }
      const usingSupabase = isSupabaseToken(getAuthToken());
      if (event === 'TOKEN_REFRESHED' && session && usingSupabase) setAuthToken(session.access_token);
      if (event === 'SIGNED_OUT' && usingSupabase) {
        setAuthToken('');
        setStaff(null);
        setStatus('signed-out');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Any 401 from the API ends the session
  useEffect(() => {
    const onUnauthorized = () => {
      setStaff(null);
      queryClient.clear();
      setStatus(s => (s === 'recovery' ? s : 'signed-out'));
    };
    window.addEventListener('hali:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hali:unauthorized', onUnauthorized);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      staff,
      role: staff?.role || 'sales',
      primaryOwnerEmail,
      hasLocalPassword,
      completeSignIn,
      signOut,
      refreshProfile: async () => {
        await loadProfile();
      },
      finishRecovery: () => {
        window.history.replaceState(null, '', window.location.pathname);
        setStatus(getAuthToken() ? 'signed-in' : 'signed-out');
      },
    }),
    [status, staff, primaryOwnerEmail, hasLocalPassword, completeSignIn, signOut, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
