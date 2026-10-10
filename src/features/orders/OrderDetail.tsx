import React, { useState } from 'react';
import { CheckCircle2, Circle, FileText, MapPin, MoreHorizontal, Phone, Ship } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { formatMVR, formatMaldivesDateTime } from '../../lib/formatters';
import type { Order, OrderStage } from '../../types';
import { Badge, Button, DetailRow, Menu, SlideOver, type MenuItem } from '../../ui';
import { HandoverModal, InvoiceModal, PaymentModal, ReturnStockModal, StageModal } from './OrderActions';
import { CHANNELS, NEXT_STAGES, PAYMENT_METHODS, PAYMENT_STATUS, STAGES, awaitingReturn, balanceDue } from './meta';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function Timeline({ order }: { order: Order }) {
  const steps: Array<{ label: string; time?: string; done: boolean }> = [
    { label: 'Order created', time: order.created_at, done: true },
    { label: 'Packed', done: ['packed', 'handed_over', 'delivered', 'failed', 'returned'].includes(order.stage) },
    {
      label: order.delivery_person_name ? `Handed to ${order.delivery_person_name}` : 'Handed to courier',
      time: order.delivery_handover_time,
      done: Boolean(order.delivery_handover_time),
    },
    { label: 'Delivered', time: order.delivery_completed_time, done: order.stage === 'delivered' || Boolean(order.delivery_completed_time) },
  ];
  return (
    <ol className="flex flex-col gap-3">
      {steps.map(s => (
        <li key={s.label} className="flex items-start gap-3 text-sm">
          {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" />}
          <span className={s.done ? 'text-fg-2' : 'text-fg-4'}>{s.label}</span>
          {s.time && <span className="ml-auto shrink-0 text-xs text-fg-4">{formatMaldivesDateTime(s.time)}</span>}
        </li>
      ))}
    </ol>
  );
}

export function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const { role } = useAuth();
  const [modal, setModal] = useState<'handover' | 'payment' | 'return' | 'invoice' | null>(null);
  const [stage, setStage] = useState<OrderStage | null>(null);
  const next = can.processOrders(role) ? NEXT_STAGES[order.stage] : [];
  const due = balanceDue(order);
  const showCosts = can.seeCosts(role) && order.total_cost !== undefined;
  const productProfit = order.items.reduce((s, i) => s + (i.line_total - i.line_cost), 0);

  // Primary action for the current stage
  let primary: React.ReactNode = null;
  if (order.stage === 'new' && next.includes('packed')) primary = <Button variant="primary" onClick={() => setStage('packed')}>Mark packed</Button>;
  else if ((order.stage === 'packed' || order.stage === 'failed') && next.includes('handed_over'))
    primary = <Button variant="primary" onClick={() => setModal('handover')}>Hand over to courier</Button>;
  else if (order.stage === 'handed_over') primary = <Button variant="primary" onClick={() => setStage('delivered')}>Mark delivered</Button>;
  else if (awaitingReturn(order) && can.returnStock(role)) primary = <Button variant="primary" onClick={() => setModal('return')}>Return to stock</Button>;

  // Everything else goes in the "More actions" menu
  const menuItems: MenuItem[] = [
    ...(order.stage === 'new' && next.includes('handed_over') ? [{ label: 'Hand over to courier', onSelect: () => setModal('handover') }] : []),
    ...(awaitingReturn(order) && can.returnStock(role) && order.stage === 'failed'
      ? [{ label: 'Return to stock', onSelect: () => setModal('return') }]
      : []),
    ...next
      .filter(s => !(s === 'packed' && order.stage === 'new') && s !== 'handed_over' && s !== 'delivered')
      .map(s => ({
        label: s === 'new' ? 'Move back to new' : s === 'cancelled' ? 'Cancel order' : `Mark ${STAGES[s].label.toLowerCase()}`,
        danger: s === 'cancelled' || s === 'failed' || s === 'returned',
        onSelect: () => setStage(s),
      })),
  ];

  return (
    <>
      <SlideOver
        open
        onClose={onClose}
        title={order.order_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge color={STAGES[order.stage].color} dot>
              {STAGES[order.stage].label}
            </Badge>
            <Badge color={PAYMENT_STATUS[order.payment_status].color}>{PAYMENT_STATUS[order.payment_status].label}</Badge>
            <span>
              {CHANNELS[order.channel]} · {formatMaldivesDateTime(order.order_date || order.created_at)}
            </span>
          </span>
        }
        footer={
          <>
            <Button icon={<FileText className="h-4 w-4" />} onClick={() => setModal('invoice')}>
              Invoice
            </Button>
            {can.recordPayments(role) && due > 0 && order.stage !== 'cancelled' && (
              <Button onClick={() => setModal('payment')}>Record payment</Button>
            )}
            {menuItems.length > 0 && (
              <Menu
                direction="up"
                items={menuItems}
                trigger={({ toggle }) => (
                  <Button iconOnly icon={<MoreHorizontal className="h-5 w-5" />} onClick={toggle}>
                    More actions
                  </Button>
                )}
              />
            )}
            {primary}
          </>
        }
      >
        <div className="divide-y divide-line">
          {awaitingReturn(order) && (
            <div className="mb-5 rounded-lg border border-warning-200 bg-warning-50 p-3.5 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500">
              Stock for this order is still deducted. Return it to stock once the goods are physically back.
            </div>
          )}

          <Section title="Buyer">
            <p className="font-medium text-fg">{order.buyer_name}</p>
            <div className="mt-1.5 flex flex-col gap-1.5 text-sm text-fg-3">
              {order.buyer_phone && (
                <a href={`tel:${order.buyer_phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-fg">
                  <Phone className="h-4 w-4" /> {order.buyer_phone}
                </a>
              )}
              {order.buyer_instagram && <span>@{order.buyer_instagram.replace(/^@/, '')}</span>}
              {order.buyer_address && (
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span className="break-words">{order.buyer_address}</span>
                </span>
              )}
              {order.boat_name && (
                <span className="inline-flex items-start gap-2">
                  <Ship className="mt-0.5 h-4 w-4 shrink-0" /> {order.boat_name}
                  {order.boat_phone ? ` · ${order.boat_phone}` : ''}
                  {order.boat_jetty ? ` · ${order.boat_jetty}` : ''}
                </span>
              )}
            </div>
          </Section>

          <Section title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`}>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {order.items.map(i => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-3.5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{i.product_name}</p>
                    <p className="text-fg-3">
                      {i.quantity} × {formatMVR(i.unit_selling_price)}
                      {showCosts && <span className="text-fg-4"> · cost {formatMVR(i.unit_cost)}</span>}
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-medium text-fg">{formatMVR(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 divide-y divide-line">
              <DetailRow label="Subtotal">
                <span className="tabular">{formatMVR(order.subtotal_amount)}</span>
              </DetailRow>
              <DetailRow label="Delivery fee">
                <span className="tabular">{formatMVR(order.delivery_fee)}</span>
              </DetailRow>
              <DetailRow label={<span className="font-semibold text-fg">Total</span>}>
                <span className="tabular text-base font-semibold">{formatMVR(order.total_amount)}</span>
              </DetailRow>
              <DetailRow label={`Received (${PAYMENT_METHODS[order.payment_method]})`}>
                <span className="tabular">{formatMVR(order.amount_received || 0)}</span>
              </DetailRow>
              {due > 0 && (
                <DetailRow label="Balance due">
                  <span className="tabular text-warning-700 dark:text-warning-500">{formatMVR(due)}</span>
                </DetailRow>
              )}
              {showCosts && (
                <DetailRow label="Product profit">
                  <span className="tabular text-success-700 dark:text-success-500">{formatMVR(productProfit)}</span>
                </DetailRow>
              )}
            </dl>
          </Section>

          <Section title="Delivery">
            <Timeline order={order} />
            {order.delivery_person_phone && (
              <a href={`tel:${order.delivery_person_phone.replace(/\s/g, '')}`} className="mt-3 inline-flex items-center gap-2 text-sm text-fg-3 hover:text-fg">
                <Phone className="h-4 w-4" /> Courier: {order.delivery_person_phone}
              </a>
            )}
          </Section>

          {order.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-line text-sm text-fg-3">{order.notes}</p>
            </Section>
          )}
          <p className="pt-4 text-xs text-fg-4">Created by {order.created_by_name || 'staff'}</p>
        </div>
      </SlideOver>

      {modal === 'handover' && <HandoverModal order={order} open onClose={() => setModal(null)} />}
      {modal === 'payment' && <PaymentModal order={order} open onClose={() => setModal(null)} />}
      {modal === 'return' && <ReturnStockModal order={order} open onClose={() => setModal(null)} />}
      <InvoiceModal order={order} open={modal === 'invoice'} onClose={() => setModal(null)} />
      <StageModal order={order} stage={stage} onClose={() => setStage(null)} />
    </>
  );
}
