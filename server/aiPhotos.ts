import {
  buildGeneratePrompt,
  buildInspectPrompt,
  DEFAULT_SETTINGS,
  INSPECT_SCHEMA,
  VIEWS,
  type InspectResult,
  type StudioSettings,
  type ViewId,
} from './aiPhotoPrompt.ts';
import { saveProductImage } from './uploads.ts';

/**
 * AI studio product photos through the OpenAI API.
 * Settings (all server-side):
 *   OPENAI_API_KEY         required to switch the feature on
 *   OPENAI_IMAGE_MODEL     image model (default gpt-image-2.5-sunburst)
 *   OPENAI_IMAGE_QUALITY   low | medium | high | xhigh | max (default high)
 *   OPENAI_IMAGE_SIZE      WIDTHxHEIGHT, 4:5 portrait (default 1024x1280)
 *   OPENAI_VISION_MODEL    model that inspects the photo first (default gpt-6.1-sol)
 *   AI_PHOTO_DAILY_LIMIT   photos each staff member may generate per day (default 12)
 */
const OPENAI_BASE = 'https://api.openai.com/v1';
const env = (name: string, fallback: string) => (process.env[name] || '').trim() || fallback;

export const aiPhotoConfig = () => ({
  enabled: Boolean(process.env.OPENAI_API_KEY),
  imageModel: env('OPENAI_IMAGE_MODEL', 'gpt-image-2.5-sunburst'),
  quality: env('OPENAI_IMAGE_QUALITY', 'high'),
  size: env('OPENAI_IMAGE_SIZE', '1024x1280'),
  visionModel: env('OPENAI_VISION_MODEL', 'gpt-6.1-sol'),
  dailyLimit: Math.max(0, Number(env('AI_PHOTO_DAILY_LIMIT', '12')) || 0),
});

export class AiPhotoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function checkImage(dataUrl: unknown, what: string): string {
  const value = typeof dataUrl === 'string' ? dataUrl : '';
  if (!IMAGE_DATA_URL.test(value)) throw new AiPhotoError(400, `Please choose a JPG, PNG or WebP ${what}.`);
  if (value.length * 0.75 > MAX_INPUT_BYTES) throw new AiPhotoError(400, `The ${what} is too large.`);
  return value;
}

const clean = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : '') || fallback;

/** Reads and validates what the browser sent for either stage. */
export function parseStudioRequest(body: any) {
  const product = checkImage(body?.product, 'product photo');
  const reference = body?.reference ? checkImage(body.reference, 'style reference image') : undefined;
  const settings: StudioSettings = {
    productName: clean(body?.settings?.productName, 120),
    background: clean(body?.settings?.background, 160, DEFAULT_SETTINGS.background),
    lighting: clean(body?.settings?.lighting, 160, DEFAULT_SETTINGS.lighting),
    productFill: clean(body?.settings?.productFill, 20, DEFAULT_SETTINGS.productFill),
    hasReference: Boolean(reference),
  };
  return { product, reference, settings, images: reference ? [product, reference] : [product] };
}

async function openai(path: string, payload: unknown): Promise<any> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiPhotoError(503, 'AI photos are not set up yet. Add OPENAI_API_KEY to the server settings.');
  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AiPhotoError(502, 'Could not reach OpenAI. Please try again.');
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI error (${res.status})`;
    console.error(`[ai-photos] ${path} failed:`, res.status, message);
    if (res.status === 429) throw new AiPhotoError(429, 'OpenAI is busy or the account has hit its limit. Try again shortly.');
    if (res.status === 400 && /safety|moderation|policy/i.test(message)) {
      throw new AiPhotoError(400, 'OpenAI declined this image. Try a clearer photo of just the product.');
    }
    throw new AiPhotoError(502, `The AI service returned an error: ${message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Stage 1
// ---------------------------------------------------------------------------
export async function inspectProduct(input: ReturnType<typeof parseStudioRequest>): Promise<InspectResult> {
  const { visionModel } = aiPhotoConfig();
  const data = await openai('/responses', {
    model: visionModel,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: buildInspectPrompt(input.settings) },
          ...input.images.map(image_url => ({ type: 'input_image', image_url, detail: 'high' })),
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'product_inspection', schema: INSPECT_SCHEMA, strict: true } },
  });

  const text: string =
    data.output_text ||
    (data.output || [])
      .flatMap((item: any) => item?.content || [])
      .filter((c: any) => c?.type === 'output_text')
      .map((c: any) => c.text)
      .join('');
  try {
    return JSON.parse(text) as InspectResult;
  } catch {
    throw new AiPhotoError(502, 'The AI could not describe this photo. Please try again or use a clearer photo.');
  }
}

/** Accepts the (possibly edited) Stage 1 report back from the browser. */
export function parseApproved(raw: any): InspectResult {
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const approved: InspectResult = {
    product_description: clean(raw?.product_description, 2000),
    visible_text: list(raw?.visible_text)
      .slice(0, 40)
      .map((t: any) => ({ text: clean(t?.text, 300), placement: clean(t?.placement, 200) }))
      .filter(t => t.text),
    style_notes: clean(raw?.style_notes, 1500),
    plan: clean(raw?.plan, 1000),
    unclear: [],
  };
  if (!approved.product_description) throw new AiPhotoError(400, 'Please run the product check first.');
  return approved;
}

export function parseViews(raw: unknown): ViewId[] {
  const ids = new Set(VIEWS.map(v => v.id));
  const chosen = (Array.isArray(raw) ? raw : []).filter((v): v is ViewId => ids.has(v));
  const unique = [...new Set(chosen)];
  if (!unique.length) throw new AiPhotoError(400, 'Choose at least one view to generate.');
  return unique;
}

// ---------------------------------------------------------------------------
// Stage 2
// ---------------------------------------------------------------------------
export interface GeneratedPhoto {
  view: ViewId;
  label: string;
  url?: string;
  error?: string;
}

export async function generatePhotos(
  input: ReturnType<typeof parseStudioRequest>,
  approved: InspectResult,
  views: ViewId[]
): Promise<GeneratedPhoto[]> {
  const { imageModel, quality, size } = aiPhotoConfig();
  // input_fidelity only exists on the gpt-image-1 family and must be left out for gpt-image-2+
  const fidelity = /^gpt-image-1(\.5)?$/.test(imageModel) ? { input_fidelity: 'high' } : {};

  // One request per view, run side by side, so each photo gets its own brief
  return Promise.all(
    views.map(async (view): Promise<GeneratedPhoto> => {
      const meta = VIEWS.find(v => v.id === view)!;
      try {
        const data = await openai('/images/edits', {
          model: imageModel,
          images: input.images.map(image_url => ({ image_url })),
          prompt: buildGeneratePrompt(input.settings, approved, meta.brief),
          size,
          quality,
          n: 1,
          output_format: 'jpeg',
          output_compression: 92,
          ...fidelity,
        });
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) throw new AiPhotoError(502, 'No image came back.');
        const url = await saveProductImage(`data:image/jpeg;base64,${b64}`);
        return { view, label: meta.label, url };
      } catch (err: any) {
        return { view, label: meta.label, error: err?.message || 'This photo could not be made.' };
      }
    })
  );
}
