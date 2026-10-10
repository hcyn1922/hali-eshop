import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from '../src/lib/supabaseConfig.ts';

/**
 * File storage.
 * - Product photos: public (Supabase bucket "product-images", or local /uploads).
 * - Payment slips: PRIVATE (Supabase bucket "payment-slips", or a local folder that is
 *   never served statically). Slips are only streamed to signed-in staff through the API.
 * Only paths/URLs are stored in the shop database, keeping it small.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const SLIP_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_ROOT = isServerless ? path.resolve('/tmp', 'hali-shop-data') : path.resolve(process.cwd(), 'data');
export const LOCAL_UPLOAD_DIR = path.join(LOCAL_ROOT, 'uploads');
const LOCAL_SLIP_DIR = path.join(LOCAL_ROOT, 'private');

const IMAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const SLIP_BUCKET = 'payment-slips';

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

function decode(dataUrl: string, allowed: Record<string, string>, what: string) {
  const match = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl || '');
  const contentType = match?.[1].toLowerCase() || '';
  const extension = allowed[contentType];
  if (!match || !extension) throw new Error(`Please choose a ${what}.`);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('Files must be 5 MB or smaller.');
  return { buffer, contentType, extension };
}

/** Uploads to a Supabase bucket, creating the bucket the first time if needed. */
async function uploadToBucket(client: SupabaseClient, bucket: string, isPublic: boolean, objectPath: string, buffer: Buffer, contentType: string) {
  let { error } = await client.storage.from(bucket).upload(objectPath, buffer, { contentType, upsert: false });
  if (error && /not found/i.test(error.message)) {
    await client.storage.createBucket(bucket, { public: isPublic });
    ({ error } = await client.storage.from(bucket).upload(objectPath, buffer, { contentType, upsert: false }));
  }
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
}

export async function saveProductImage(dataUrl: string): Promise<string> {
  const { buffer, contentType, extension } = decode(dataUrl, IMAGE_TYPES, 'JPG, PNG, WebP or GIF image');
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const client = getStorageClient();
  if (client) {
    const objectPath = `products/${fileName}`;
    await uploadToBucket(client, IMAGE_BUCKET, true, objectPath, buffer, contentType);
    return client.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  }
  await fs.promises.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(LOCAL_UPLOAD_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}

/** Stores a bank transfer slip privately and returns its storage path (not a URL). */
export async function savePaymentSlip(dataUrl: string): Promise<{ path: string; type: string }> {
  const { buffer, contentType, extension } = decode(dataUrl, SLIP_TYPES, 'photo, screenshot or PDF of the slip');
  const objectPath = `slips/${crypto.randomUUID()}.${extension}`;
  const client = getStorageClient();
  if (client) {
    await uploadToBucket(client, SLIP_BUCKET, false, objectPath, buffer, contentType);
  } else {
    await fs.promises.mkdir(path.join(LOCAL_SLIP_DIR, 'slips'), { recursive: true });
    await fs.promises.writeFile(path.join(LOCAL_SLIP_DIR, objectPath), buffer);
  }
  return { path: objectPath, type: contentType };
}

/** Reads a private slip for streaming to an authorised staff member. */
export async function readPaymentSlip(objectPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!/^slips\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(objectPath)) throw new Error('Slip not found.');
  const contentType = EXT_TYPES[objectPath.split('.').pop()!];
  const client = getStorageClient();
  if (client) {
    const { data, error } = await client.storage.from(SLIP_BUCKET).download(objectPath);
    if (error || !data) throw new Error('Slip not found.');
    return { buffer: Buffer.from(await data.arrayBuffer()), contentType };
  }
  return { buffer: await fs.promises.readFile(path.join(LOCAL_SLIP_DIR, objectPath)), contentType };
}
