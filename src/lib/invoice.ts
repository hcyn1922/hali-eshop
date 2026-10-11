import type { Order, ShopProfile } from '../types';
import { formatMVR, formatMaldivesDate } from './formatters';
import { LOGO_ASPECT, LOGO_SRC } from '../ui/Logo';

const NAVY = '#0F1736';
const BRAND = '#EB3A41';
const TEXT = '#101828';
const MUTED = '#475467';
const SOFT = '#667085';
const LINE = '#EAECF0';
const PANEL = '#F9FAFB';
const FONT = 'Inter, -apple-system, "Segoe UI", Roboto, sans-serif';

const PAYMENT_LABELS: Record<string, string> = { bank_transfer: 'Bank transfer', cash: 'Cash' };
const STATUS_LABELS: Record<string, string> = { unpaid: 'Unpaid', partially_paid: 'Partly paid', paid: 'Paid' };

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Removes any web address (and a dangling "Map:" label) so invoices never show links. */
export function stripUrls(text: string | undefined, bareDomains = true): string {
  let out = (text || '').replace(/\b(?:https?:\/\/|www\.)\S+/gi, '');
  if (bareDomains) out = out.replace(/\b[\w-]+\.(?:com|net|org|mv|app|io|co|page|link|ly|me)(?:\/\S*)?/gi, '');
  return out
    .replace(/\bMap:\s*/gi, '')
    .replace(/\s*,\s*(,\s*)+/g, ', ')
    .replace(/(^[\s,·]+|[\s,·]+$)/g, '')
    .replace(/\s{2,}/g, ' ');
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of (text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draws a clean, shareable invoice for an order and returns it as a JPEG blob. */
export async function renderInvoice(rawOrder: Order, rawShop: ShopProfile): Promise<Blob> {
  await document.fonts?.ready;
  // Customers receive this image: strip every web address from the text we print
  const shop: ShopProfile = Object.fromEntries(
    Object.entries(rawShop).map(([k, v]) => [k, k === 'email' ? String(v || '') : stripUrls(String(v || ''), k !== 'instagram')])
  ) as unknown as ShopProfile;
  const order: Order = {
    ...rawOrder,
    buyer_name: stripUrls(rawOrder.buyer_name),
    buyer_address: stripUrls(rawOrder.buyer_address),
    buyer_instagram: stripUrls(rawOrder.buyer_instagram, false),
    delivery_person_name: stripUrls(rawOrder.delivery_person_name),
    items: rawOrder.items.map(i => ({ ...i, product_name: stripUrls(i.product_name) })),
  };
  const logo = await loadImage(LOGO_SRC);

  const W = 1000;
  const LOGO_W = 170;
  const P = 64;
  const scale = 2;
  // Measure pass to size the canvas
  const draw = (ctx: CanvasRenderingContext2D, measureOnly: boolean): number => {
    let y = P;
    const text = (t: string, x: number, yy: number, font: string, color: string, align: CanvasTextAlign = 'left') => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      if (!measureOnly) ctx.fillText(t, x, yy);
    };

    // Header
    if (!measureOnly) {
      ctx.fillStyle = BRAND;
      ctx.fillRect(0, 0, W, 6);
      // The logo file as supplied, scaled with its own proportions
      if (logo) ctx.drawImage(logo, P - 8, y - 16, LOGO_W, LOGO_W / LOGO_ASPECT);
    }
    // The logo carries the shop name, so only the tagline sits beside it
    if (shop.tagline) text(shop.tagline, P + LOGO_W + 8, y + 54, `400 15px ${FONT}`, SOFT);
    text('INVOICE', W - P, y + 26, `700 28px ${FONT}`, NAVY, 'right');
    text(order.order_number, W - P, y + 52, `500 16px ${FONT}`, MUTED, 'right');
    y += 100;

    const contact = [shop.address, shop.phone, shop.email, shop.instagram && `@${shop.instagram.replace(/^@/, '')}`].filter(Boolean).join('  ·  ');
    if (contact) {
      ctx.font = `400 14px ${FONT}`;
      for (const line of wrap(ctx, contact, W - 2 * P)) {
        text(line, P, y, `400 14px ${FONT}`, SOFT);
        y += 22;
      }
    }
    y += 16;
    if (!measureOnly) {
      ctx.fillStyle = LINE;
      ctx.fillRect(P, y, W - 2 * P, 1);
    }
    y += 36;

    // Billed to / details
    const colW = (W - 2 * P - 32) / 2;
    const top = y;
    text('BILLED TO', P, y, `600 12px ${FONT}`, SOFT);
    y += 26;
    text(order.buyer_name || 'Customer', P, y, `600 18px ${FONT}`, TEXT);
    y += 26;
    const buyerLines = [order.buyer_phone, order.buyer_instagram && `@${order.buyer_instagram.replace(/^@/, '')}`].filter(Boolean) as string[];
    for (const l of buyerLines) {
      text(l, P, y, `400 15px ${FONT}`, MUTED);
      y += 22;
    }
    ctx.font = `400 15px ${FONT}`;
    for (const l of wrap(ctx, order.buyer_address || '', colW)) {
      text(l, P, y, `400 15px ${FONT}`, MUTED);
      y += 22;
    }
    const leftBottom = y;

    y = top;
    const rx = P + colW + 32;
    const rows: Array<[string, string]> = [
      ['Date', formatMaldivesDate(order.order_date || order.created_at)],
      ['Payment', PAYMENT_LABELS[order.payment_method] || order.payment_method],
      ['Status', STATUS_LABELS[order.payment_status] || order.payment_status],
    ];
    if (order.delivery_person_name) rows.push(['Courier', order.delivery_person_name]);
    for (const [k, v] of rows) {
      text(k, rx, y + 8, `400 15px ${FONT}`, SOFT);
      text(v, W - P, y + 8, `600 15px ${FONT}`, TEXT, 'right');
      y += 28;
    }
    y = Math.max(leftBottom, y) + 28;

    // Items table
    const cQty = W - P - 330;
    const cPrice = W - P - 170;
    const cAmt = W - P;
    if (!measureOnly) {
      ctx.fillStyle = PANEL;
      ctx.fillRect(P, y, W - 2 * P, 44);
    }
    text('Item', P + 16, y + 28, `600 13px ${FONT}`, SOFT);
    text('Qty', cQty, y + 28, `600 13px ${FONT}`, SOFT, 'right');
    text('Price', cPrice, y + 28, `600 13px ${FONT}`, SOFT, 'right');
    text('Amount', cAmt - 16, y + 28, `600 13px ${FONT}`, SOFT, 'right');
    y += 44;
    for (const item of order.items || []) {
      ctx.font = `500 15px ${FONT}`;
      const nameLines = wrap(ctx, item.product_name, cQty - P - 80);
      const rowH = Math.max(56, 24 + nameLines.length * 20 + 12);
      nameLines.forEach((l, i) => text(l, P + 16, y + 30 + i * 20, `500 15px ${FONT}`, TEXT));
      text(String(item.quantity), cQty, y + 30, `400 15px ${FONT}`, MUTED, 'right');
      text(formatMVR(item.unit_selling_price), cPrice, y + 30, `400 15px ${FONT}`, MUTED, 'right');
      text(formatMVR(item.line_total), cAmt - 16, y + 30, `600 15px ${FONT}`, TEXT, 'right');
      y += rowH;
      if (!measureOnly) {
        ctx.fillStyle = LINE;
        ctx.fillRect(P, y, W - 2 * P, 1);
      }
    }
    y += 24;

    // Totals
    const balance = Math.max(0, order.total_amount - (order.amount_received || 0));
    const totals: Array<[string, string, boolean]> = [
      ['Subtotal', formatMVR(order.subtotal_amount), false],
      ['Delivery', formatMVR(order.delivery_fee), false],
      ['Total', formatMVR(order.total_amount), true],
      ['Paid', formatMVR(order.amount_received || 0), false],
      ['Balance due', formatMVR(balance), true],
    ];
    const tx = W - P - 320;
    for (const [k, v, strong] of totals) {
      if (k === 'Total' && !measureOnly) {
        ctx.fillStyle = LINE;
        ctx.fillRect(tx, y - 8, 320, 1);
      }
      text(k, tx, y + 18, `${strong ? 600 : 400} ${strong ? 17 : 15}px ${FONT}`, strong ? TEXT : MUTED);
      text(v, W - P, y + 18, `${strong ? 700 : 500} ${strong ? 17 : 15}px ${FONT}`, k === 'Balance due' && balance > 0 ? BRAND : TEXT, 'right');
      y += k === 'Total' ? 40 : 32;
    }
    y += 24;

    // Bank details & note
    if (shop.bank_details) {
      ctx.font = `400 14px ${FONT}`;
      const lines = wrap(ctx, shop.bank_details, W - 2 * P - 40);
      const h = 44 + lines.length * 22;
      if (!measureOnly) {
        ctx.fillStyle = PANEL;
        ctx.fillRect(P, y, W - 2 * P, h);
      }
      text('PAYMENT DETAILS', P + 20, y + 28, `600 12px ${FONT}`, SOFT);
      lines.forEach((l, i) => text(l, P + 20, y + 52 + i * 22, `400 14px ${FONT}`, TEXT));
      y += h + 24;
    }
    if (shop.invoice_note) {
      ctx.font = `500 15px ${FONT}`;
      for (const l of wrap(ctx, shop.invoice_note, W - 2 * P)) {
        text(l, W / 2, y + 12, `500 15px ${FONT}`, NAVY, 'center');
        y += 24;
      }
    }
    if (shop.gst_tin) {
      text(`GST TIN ${shop.gst_tin}`, W / 2, y + 16, `400 13px ${FONT}`, SOFT, 'center');
      y += 24;
    }
    return y + P;
  };

  const measure = document.createElement('canvas').getContext('2d')!;
  const H = Math.ceil(draw(measure, true));
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  draw(ctx, false);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the invoice image.'))), 'image/jpeg', 0.92)
  );
}
