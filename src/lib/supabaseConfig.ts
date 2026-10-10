/**
 * Supabase project settings. Supabase is optional: without it the server keeps data
 * in a local JSON file and staff sign in with shop passwords only.
 * The publishable (anon) key is safe to ship to browsers; the service-role key never is
 * and is only read from the SUPABASE_SERVICE_ROLE_KEY server environment variable.
 */

/** Strips any path such as /rest/v1 so the client always receives the project origin. */
export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }
}

export function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes('your-project') || value.startsWith('your-');
}

export function resolveSupabaseConfig(url: string | undefined, key: string | undefined): { url: string; key: string } | null {
  if (isPlaceholder(url) || isPlaceholder(key)) return null;
  return { url: sanitizeSupabaseUrl(url!), key: key! };
}
