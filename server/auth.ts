import type express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from './db.ts';
import type { Permission } from '../src/lib/permissions.ts';
import { appUrl, notifyAccessRequest } from './notify.ts';
import type { StaffProfile, StaffRole } from '../src/types/index.ts';
import { resolveSupabaseConfig } from '../src/lib/supabaseConfig.ts';

export interface AuthContext {
  staff: StaffProfile;
  role: StaffRole;
  staffId: string;
  token: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Supabase Auth access-token verification
// ---------------------------------------------------------------------------
let supabaseAuthClient: SupabaseClient | null = null;

function getSupabaseAuthClient(): SupabaseClient | null {
  if (process.env.HALI_DISABLE_SUPABASE_AUTH === 'true') return null;
  if (!supabaseAuthClient) {
    const config = resolveSupabaseConfig(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    // Supabase Auth is optional; without it only shop-password sessions are accepted
    if (!config) return null;
    supabaseAuthClient = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabaseAuthClient;
}

interface VerifiedIdentity {
  email: string;
  full_name?: string;
  phone?: string;
  requested_role?: string;
}

const identityCache = new Map<string, { identity: VerifiedIdentity; expiresAt: number }>();
const IDENTITY_CACHE_MS = 60_000;

/** Asks Supabase Auth whether the access token is genuine. Returns null for invalid tokens. */
async function verifySupabaseAccessToken(token: string): Promise<VerifiedIdentity | null> {
  // Supabase access tokens are JWTs (three dot-separated segments)
  if (token.split('.').length !== 3) return null;

  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;

  const client = getSupabaseAuthClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.email) return null;

  const meta = data.user.user_metadata || {};
  const identity: VerifiedIdentity = {
    email: data.user.email,
    full_name: typeof meta.full_name === 'string' ? meta.full_name : undefined,
    phone: typeof meta.phone === 'string' ? meta.phone : undefined,
    requested_role: typeof meta.role === 'string' ? meta.role : undefined,
  };

  if (identityCache.size > 500) identityCache.clear();
  identityCache.set(token, { identity, expiresAt: Date.now() + IDENTITY_CACHE_MS });
  return identity;
}

export function extractToken(req: express.Request): string {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) return header.substring(7).trim();
  return '';
}

/**
 * Resolves who is calling. Accepts either a shop session token (email + password sign-in)
 * or a Supabase Auth access token. The role is always read from the server-side staff
 * profile; nothing the browser sends can choose or elevate it.
 */
export async function resolveAuth(req: express.Request): Promise<AuthContext> {
  const token = extractToken(req);
  if (!token) throw new HttpError(401, 'Please sign in to continue.');

  const session = db.verifySession(token);
  if (session) {
    return { staff: session.staff, role: session.role, staffId: session.staff.id, token };
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) throw new HttpError(401, 'Your session has expired. Please sign in again.');

  const created = await db.ensureExternalProfile(identity);
  if (created) await notifyAccessRequest(created, appUrl(req));
  try {
    const resolved = await db.resolveExternalIdentity(identity);
    return { staff: resolved.staff, role: resolved.role, staffId: resolved.staff.id, token };
  } catch (err: any) {
    // Pending, rejected or deactivated accounts
    throw new HttpError(403, err.message);
  }
}

export function getAuth(req: express.Request): AuthContext {
  const auth = (req as any).auth as AuthContext | undefined;
  if (!auth) throw new HttpError(401, 'Please sign in to continue.');
  return auth;
}

export const requireAuth: express.RequestHandler = (req, res, next) => {
  resolveAuth(req)
    .then(auth => {
      (req as any).auth = auth;
      next();
    })
    .catch(next);
};

/** Route guard: the caller's role must have this permission (the owner always does). */
export function need(...permissions: Permission[]): express.RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuth(req);
    if (!permissions.some(p => db.can(role, p))) {
      return next(new HttpError(403, 'Your role does not have access to this. Ask the shop owner if you need it.'));
    }
    next();
  };
}

/** Route guard: only the listed roles may continue. */
export function allow(...roles: StaffRole[]): express.RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuth(req);
    if (!roles.includes(role)) {
      return next(new HttpError(403, `Your role (${role}) is not allowed to do this.`));
    }
    next();
  };
}
