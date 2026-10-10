/**
 * The master prompt for making studio photos by hand in ChatGPT (free route, no API key).
 * Staff copy it, paste it into ChatGPT with the product photo attached, review ChatGPT's
 * Stage 1 feedback, reply "Proceed", then upload the result with "Add photo".
 */
export interface ChatGptPromptOptions {
  productName: string;
  background: string;
  lighting: string;
  productFill: string;
  layout: 'grid' | 'single';
}

export const CHATGPT_DEFAULTS: ChatGptPromptOptions = {
  productName: '',
  background: 'warm beige, subtle matte texture',
  lighting: 'soft directional studio lighting',
  productFill: '60–70%',
  layout: 'grid',
};

export function buildChatGptPrompt(o: ChatGptPromptOptions): string {
  const grid = o.layout === 'grid';
  const layoutLine = grid ? 'four photos combined in one equal 2×2 grid' : 'four separate photos, one image at a time';
  return `Create professional product photography using the uploaded images.
Inputs

* Product image: the first attached image
* Photography style reference: the second attached image, if one is attached (otherwise use the background and lighting below)
* Product name: ${o.productName || '[product name]'}
* Background colour and texture: ${o.background}
* Lighting style: ${o.lighting}
* Aspect ratio: 4:5
* Output layout: ${layoutLine}

Stage 1 — Inspect and confirm understanding
Before generating anything, carefully inspect the original product and the reference image.
Give brief feedback describing:

* The product's shape, proportions, colours, materials, texture, packaging and distinctive features.
* All visible branding, wording, typography, symbols and their placement.
* The reference photo's lighting, background, camera angle, shadows and composition.
* How you will apply that photographic style to the original product.

State: "I have understood the product and the photography style. I will preserve its original features and visible text. Reply 'Proceed' when you want me to generate the four photos."
If essential text or details are unclear, identify them and request clarification rather than inventing them.
Stop after this feedback. Do not generate images until the user explicitly says "Proceed" or gives an equivalent instruction.
Stage 2 — Generate only after approval
Create four distinct, photorealistic studio photographs of the original product, ${grid ? 'combined in the specified layout' : 'as four separate images, generating them one after another'}.
Use these variations:

1. Front-facing hero photograph with balanced soft lighting.
2. Subtle three-quarter view showing the front and a visible side.
3. Front-facing photograph with a different soft lighting direction and shadow.
4. Slightly elevated three-quarter view, keeping the branding readable.

Adapt these views to the product and available source images. Do not invent unseen product details.
Product preservation

* Preserve the original shape, proportions, construction, colours, materials, finish and every visible feature.
* Preserve all product text exactly, including spelling, typography, logos, symbols, label layout and placement.
* Do not rename, redesign, simplify or embellish the product.
* Use the reference only for photographic style; do not transfer its product features or branding.

Photography and composition

* Use the specified background and lighting, guided by the reference.
* Create realistic material textures, controlled reflections, crisp product details and natural contact shadows.
* Keep the entire product visible and uncropped.
* Leave generous room above, below and beside the product. Aim for the product to occupy approximately ${o.productFill} of each photo's height.
* Keep scale and visual treatment consistent across all four photos.
* Make each photo's aspect ratio 4:5.${grid ? ' An equal 2×2 grid should also have an overall 4:5 aspect ratio.\n* Use minimal, clean seams between photos.' : ''}

Restrictions
Show only the original product on the studio surface and background. Remove surrounding props and external promotional overlays from the source image while preserving branding printed or engraved on the product.
Do not add separate objects, decorative elements, ingredients, flowers, fruit, stands, platforms, captions, panel numbers, borders, watermarks or extra logos.
Generate at the highest available quality. Check all four photos for product consistency and accurate visible wording before presenting the result.`;
}
