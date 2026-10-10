import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from '../src/lib/supabaseConfig.ts';

/**
 * Product photo storage. Photos go to the public Supabase Storage bucket when the
 * service-role key is configured, otherwise to a local folder served at /uploads.
 * Only the resulting URL is stored in the shop database, keeping it small.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const LOCAL_UPLOAD_DIR = isServerless
  ? path.resolve('/tmp', 'hali-shop-data', 'uploads')
  : path.resolve(process.cwd(), 'data', 'uploads');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

let storageClient: SupabaseClient | null | undefined;
function getStorageClient(): SupabaseClient | null {
  if (storageClient === undefined) {
    const config = resolveSupabaseConfig(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    storageClient = config
      ? createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  }
  return storageClient;
}

export async function saveProductImage(dataUrl: string): Promise<string> {
  const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Please choose a JPG, PNG, WebP or GIF image.');
  const contentType = match[1].toLowerCase();
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) throw new Error('Please choose a JPG, PNG, WebP or GIF image.');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('The image file is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('Images must be 5 MB or smaller.');

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const client = getStorageClient();

  if (client) {
    const objectPath = `products/${fileName}`;
    const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return client.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  }

  await fs.promises.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(LOCAL_UPLOAD_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}
