import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from '../src/lib/supabaseConfig.ts';

/**
 * Raised when another server instance saved newer data between our load and save.
 * The in-memory state is discarded and reloaded; the client is asked to retry.
 */
export class StoreConflictError extends Error {
  status = 409;
  constructor() {
    super('The data was updated by another staff member at the same moment. Please retry.');
  }
}

export interface StoreSnapshot<T> {
  data: T;
  version: number;
}

/**
 * Persistence backend for the whole operations database snapshot.
 * Saves use optimistic concurrency: a save only succeeds if nobody else
 * saved since `expectedVersion` was loaded, which makes each API mutation
 * all-or-nothing across serverless instances.
 */
export interface StateStore<T> {
  readonly name: string;
  /** Returns the stored version number without downloading the data (null if empty). */
  peekVersion(): Promise<number | null>;
  load(): Promise<StoreSnapshot<T> | null>;
  /** Persists data and returns the new version. Throws StoreConflictError on a version mismatch. */
  save(data: T, expectedVersion: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// Local JSON file (development / single long-running server)
// ---------------------------------------------------------------------------
export class FileStore<T> implements StateStore<T> {
  readonly name = 'local-file';
  private version = 0;

  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  async peekVersion(): Promise<number | null> {
    return fs.existsSync(this.file) ? this.version : null;
  }

  async load(): Promise<StoreSnapshot<T> | null> {
    if (!fs.existsSync(this.file)) return null;
    const raw = await fs.promises.readFile(this.file, 'utf-8');
    return { data: JSON.parse(raw) as T, version: this.version };
  }

  async save(data: T, _expectedVersion: number): Promise<number> {
    const tempPath = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.promises.rename(tempPath, this.file);
    this.version += 1;
    return this.version;
  }
}

// ---------------------------------------------------------------------------
// Supabase Postgres (production / Vercel serverless)
// Table created by supabase/migrations/20261010_app_state.sql
// ---------------------------------------------------------------------------
const STATE_ROW_ID = 'main';

export class SupabaseStore<T> implements StateStore<T> {
  readonly name = 'supabase';
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async peekVersion(): Promise<number | null> {
    const { data, error } = await this.client
      .from('app_state')
      .select('version')
      .eq('id', STATE_ROW_ID)
      .maybeSingle();
    if (error) throw new Error(`Supabase app_state read failed: ${error.message}`);
    return data ? Number(data.version) : null;
  }

  async load(): Promise<StoreSnapshot<T> | null> {
    const { data, error } = await this.client
      .from('app_state')
      .select('data, version')
      .eq('id', STATE_ROW_ID)
      .maybeSingle();
    if (error) throw new Error(`Supabase app_state read failed: ${error.message}`);
    if (!data) return null;
    return { data: data.data as T, version: Number(data.version) };
  }

  async save(data: T, expectedVersion: number): Promise<number> {
    const nextVersion = expectedVersion + 1;
    const now = new Date().toISOString();

    if (expectedVersion === 0) {
      const { error } = await this.client
        .from('app_state')
        .insert({ id: STATE_ROW_ID, data, version: nextVersion, updated_at: now });
      if (error) {
        // 23505 = unique_violation: another instance initialised the row first
        if (error.code === '23505') throw new StoreConflictError();
        throw new Error(`Supabase app_state insert failed: ${error.message}`);
      }
      return nextVersion;
    }

    const { data: rows, error } = await this.client
      .from('app_state')
      .update({ data, version: nextVersion, updated_at: now })
      .eq('id', STATE_ROW_ID)
      .eq('version', expectedVersion)
      .select('version');
    if (error) throw new Error(`Supabase app_state update failed: ${error.message}`);
    if (!rows || rows.length === 0) throw new StoreConflictError();
    return nextVersion;
  }
}

export function createStateStore<T>(): StateStore<T> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  const config = resolveSupabaseConfig(url, serviceKey);
  if (config) {
    return new SupabaseStore<T>(config.url, config.key);
  }

  if (isServerless) {
    console.warn(
      '[DB] SUPABASE_SERVICE_ROLE_KEY is not set: data is stored in /tmp and WILL BE LOST between serverless invocations.'
    );
  }

  const dataDir = isServerless ? path.resolve('/tmp', 'hali-shop-data') : path.resolve(process.cwd(), 'data');
  return new FileStore<T>(path.join(dataDir, 'hali_shop_db.json'));
}
