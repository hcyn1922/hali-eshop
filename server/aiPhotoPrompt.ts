/**
 * The "master prompt" for AI studio product photos, split into its two stages.
 *
 * Stage 1 (inspect): a vision model studies the product photo (and the optional style
 * reference) and reports back what it sees, including every piece of visible text.
 * Staff review and correct that report before anything is generated.
 *
 * Stage 2 (generate): after staff click "Proceed", the image model receives the
 * approved report plus the photography brief and makes one photo per chosen view.
 *
 * Edit the wording here to change how every AI photo is made. Keep it server-side.
 */

export interface StudioSettings {
  productName: string;
  background: string;
  lighting: string;
  /** e.g. "60–70%" */
  productFill: string;
  hasReference: boolean;
}

export const DEFAULT_SETTINGS: Omit<StudioSettings, 'productName' | 'hasReference'> = {
  background: 'warm beige, subtle matte texture',
  lighting: 'soft directional studio lighting',
  productFill: '60–70%',
};

/** The shots staff can choose from. Each one becomes a separate 4:5 photo. */
export const VIEWS = [
  { id: 'hero', label: 'Front hero', brief: 'Front-facing hero photograph with balanced soft lighting.' },
  { id: 'three_quarter', label: 'Three-quarter view', brief: 'Subtle three-quarter view showing the front and a visible side.' },
  { id: 'alt_light', label: 'Front, alternate light', brief: 'Front-facing photograph with a different soft lighting direction and shadow.' },
  { id: 'elevated', label: 'Elevated three-quarter', brief: 'Slightly elevated three-quarter view, keeping the branding readable.' },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

// ---------------------------------------------------------------------------
// Stage 1 — Inspect and confirm understanding
// ---------------------------------------------------------------------------

export function buildInspectPrompt(s: StudioSettings): string {
  return `You are preparing professional studio product photography for an online shop.

Image 1 is the ORIGINAL PRODUCT photo.${s.hasReference ? '\nImage 2 is a PHOTOGRAPHY STYLE REFERENCE. Use it only to understand lighting, background, camera angle, shadows and composition. Never describe its product or branding as part of our product.' : ''}

Product name given by the shop: ${s.productName || '(not given)'}
Planned background: ${s.background}
Planned lighting: ${s.lighting}

Carefully inspect the original product${s.hasReference ? ' and the reference image' : ''} and report:
- product_description: the product's shape, proportions, colours, materials, texture, packaging and distinctive features. Brief but precise.
- visible_text: EVERY piece of visible branding, wording, numbers and symbols on the product, copied exactly character by character (keep capitalisation and line breaks as " / "), each with its typography and placement.
- style_notes: ${s.hasReference ? "the reference photo's lighting, background, camera angle, shadows and composition." : 'how the planned background and lighting will look (there is no reference image).'}
- plan: one or two sentences on how you will apply that photographic style to this product while preserving it exactly.
- unclear: anything essential you cannot read or see clearly (blurred, cut-off or hidden text, unseen sides). Do not guess or invent; list it here instead. Empty list if everything is clear.

Ignore props, hands, surroundings and promotional overlays that are not part of the product itself.`;
}

/** JSON schema for the Stage 1 answer (OpenAI structured output). */
export const INSPECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['product_description', 'visible_text', 'style_notes', 'plan', 'unclear'],
  properties: {
    product_description: { type: 'string' },
    visible_text: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'placement'],
        properties: { text: { type: 'string' }, placement: { type: 'string' } },
      },
    },
    style_notes: { type: 'string' },
    plan: { type: 'string' },
    unclear: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface InspectResult {
  product_description: string;
  visible_text: { text: string; placement: string }[];
  style_notes: string;
  plan: string;
  unclear: string[];
}

// ---------------------------------------------------------------------------
// Stage 2 — Generate (only after staff approve the Stage 1 report)
// ---------------------------------------------------------------------------

export function buildGeneratePrompt(s: StudioSettings, approved: InspectResult, viewBrief: string): string {
  const text = approved.visible_text.length
    ? approved.visible_text.map(t => `  - "${t.text}" (${t.placement})`).join('\n')
    : '  - (no visible text)';

  return `Create one professional, photorealistic studio photograph of the original product.

Image 1 is the ORIGINAL PRODUCT.${s.hasReference ? ' Image 2 is a PHOTOGRAPHY STYLE REFERENCE only: use its lighting, background treatment, camera feel and shadows, but do not transfer any of its products, features or branding.' : ''}

Product name: ${s.productName || '(see image)'}
Confirmed product description: ${approved.product_description}
Confirmed visible text (must appear exactly like this, same spelling, typography and placement):
${text}
Photography plan: ${approved.plan}

This photo: ${viewBrief}
Adapt the view to the product and what the source image shows. Do not invent unseen product details.

Product preservation
- Preserve the original shape, proportions, construction, colours, materials, finish and every visible feature.
- Preserve all product text exactly, including spelling, typography, logos, symbols, label layout and placement.
- Do not rename, redesign, simplify or embellish the product.

Photography and composition
- Background: ${s.background}. Lighting: ${s.lighting}${s.hasReference ? ', guided by the reference' : ''}.
- Realistic material textures, controlled reflections, crisp product details and natural contact shadows.
- Keep the entire product visible and uncropped, with generous room above, below and beside it.
- The product should occupy approximately ${s.productFill} of the photo's height.
- Portrait 4:5 frame, a single photo (not a grid or collage).

Restrictions
- Show only the original product on the studio surface and background.
- Remove surrounding props and external promotional overlays from the source image, but keep branding printed or engraved on the product.
- Do not add separate objects, decorative elements, ingredients, flowers, fruit, stands, platforms, captions, numbers, borders, watermarks or extra logos.`;
}
