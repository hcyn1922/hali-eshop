import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './lib/supabaseConfig';

/**
 * Supabase Auth client for staff sign-in and password-reset emails.
 * It is null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured;
 * the app then works with shop passwords only. Roles never come from Supabase.
 */
const config = resolveSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = config ? createClient(config.url, config.key) : null;
