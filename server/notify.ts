import type express from 'express';
import type { Order, StaffProfile } from '../src/types/index.ts';
import { db } from './db.ts';

/**
 * Owner email notifications, sent through Resend (https://resend.com).
 * Configure RESEND_API_KEY (and optionally NOTIFY_EMAIL / MAIL_FROM). Without a key,
 * notifications are skipped silently. A failed email never blocks the shop action.
 */
const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY || '';
  return Boolean(key) && !key.startsWith('your-');
}

function recipient(): string {
  return (process.env.NOTIFY_EMAIL || db.getOwnerEmail()).trim();
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const mvr = (n: number) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The app's own address, for "Open in Hali" links in owner emails. */
export function appUrl(req: express.Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function layout(title: string, rows: Array<[string, string]>, body: string, link?: { href: string; label: string }) {
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#667085;font-size:14px;width:140px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#101828;font-size:14px;font-weight:600">${v}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:#eb3a41"></td></tr>
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:13px;color:#667085">Hali e-shop</p><h1 style="margin:6px 0 0;font-size:20px;color:#0f1736">${esc(title)}</h1></td></tr>
<tr><td style="padding:12px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${table}</table>${body}</td></tr>
${link ? `<tr><td style="padding:8px 28px 28px"><a href="${esc(link.href)}" style="display:inline-block;background:#0f1736;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">${esc(link.label)}</a></td></tr>` : ''}
</table><p style="font-size:12px;color:#98a2b3;margin:16px 0 0">You receive this because you are the owner of this Hali e-shop console.</p>
</td></tr></table></body></html>`;
}

async function send(subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: 'Email is not set up (RESEND_API_KEY is missing).' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Hali e-shop <onboarding@resend.dev>',
        to: [recipient()],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[notify] Resend error', res.status, detail);
      return { ok: false, error: `Email service answered ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[notify] Email failed:', err?.message || err);
    return { ok: false, error: err?.name === 'AbortError' ? 'The email service timed out.' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function orderRows(order: Order): Array<[string, string]> {
  const labels: Record<string, string> = { instagram: 'Instagram', viber: 'Viber', whatsapp: 'WhatsApp', sms: 'SMS', direct: 'Walk-in / direct', other: 'Other' };
  const channel =
    order.channel === 'other' && order.channel_detail ? `Other (${esc(order.channel_detail)})` : esc(labels[order.channel] || order.channel);
  return [
    ['Order', esc(order.order_number)],
    ['Buyer', `${esc(order.buyer_name || '')}${order.buyer_phone ? ` · ${esc(order.buyer_phone)}` : ''}`],
    ['Channel', channel],
    ['Total', esc(mvr(order.total_amount))],
    ['Paid', esc(mvr(order.amount_received || 0))],
  ];
}

function itemsHtml(order: Order) {
  const rows = order.items
    .map(i => `<tr><td style="padding:6px 0;font-size:14px;color:#344054">${esc(i.quantity)} × ${esc(i.product_name)}</td><td style="padding:6px 0;font-size:14px;color:#101828;text-align:right">${esc(mvr(i.line_total))}</td></tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid #eaecf0">${rows}</table>`;
}

export async function notifyNewOrder(order: Order, createdBy: string, baseUrl: string) {
  const subject = `New order ${order.order_number} · ${mvr(order.total_amount)}`;
  const html = layout('New order placed', [...orderRows(order), ['Taken by', esc(createdBy)]], itemsHtml(order), {
    href: `${baseUrl}/orders/${order.id}`,
    label: 'Open order',
  });
  const text = `New order ${order.order_number} from ${order.buyer_name} (${mvr(order.total_amount)}), taken by ${createdBy}.\n${order.items
    .map(i => `${i.quantity} x ${i.product_name}`)
    .join('\n')}`;
  return send(subject, html, text);
}

export async function notifyDelivered(order: Order, baseUrl: string) {
  const subject = `Delivered: ${order.order_number} to ${order.buyer_name}`;
  const html = layout(
    'Order delivered',
    [...orderRows(order), ['Courier', esc(order.delivery_person_name || '—')]],
    itemsHtml(order),
    { href: `${baseUrl}/orders/${order.id}`, label: 'Open order' }
  );
  return send(subject, html, `${order.order_number} was delivered to ${order.buyer_name}. Total ${mvr(order.total_amount)}.`);
}

export async function notifyAccessRequest(staff: StaffProfile, baseUrl: string) {
  const pending = staff.approval_status === 'pending';
  const subject = pending ? `Access request from ${staff.full_name}` : `New staff account: ${staff.full_name}`;
  const html = layout(
    pending ? 'New access request' : 'New staff account created',
    [
      ['Name', esc(staff.full_name)],
      ['Email', esc(staff.email)],
      ['Phone', esc(staff.phone || '—')],
      ['Role', esc(staff.role)],
      ...(staff.request_note ? ([['Note', esc(staff.request_note)]] as Array<[string, string]>) : []),
    ],
    pending ? '<p style="font-size:14px;color:#475467">Approve or decline it on the Requests tab of Staff &amp; access.</p>' : '',
    { href: `${baseUrl}/staff`, label: pending ? 'Review request' : 'Open Staff & access' }
  );
  return send(subject, html, `${subject} (${staff.email}). ${pending ? 'Review it in Staff & access.' : ''}`);
}

export async function sendTestEmail(baseUrl: string) {
  return send(
    'Hali e-shop email notifications are working',
    layout('Email notifications are on', [['Sent to', esc(recipient())]], '<p style="font-size:14px;color:#475467">You will get an email for new orders, delivered orders and new staff access requests.</p>', {
      href: baseUrl,
      label: 'Open Hali e-shop',
    }),
    `Email notifications are working. Sent to ${recipient()}.`
  );
}

export const notificationRecipient = recipient;
