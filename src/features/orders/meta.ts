import type { BadgeColor } from '../../ui';
import type { Order, OrderChannel, OrderStage, PaymentMethod, PaymentStatus } from '../../types';

export const STAGES: Record<OrderStage, { label: string; color: BadgeColor }> = {
  new: { label: 'New', color: 'blue' },
  packed: { label: 'Packed', color: 'purple' },
  handed_over: { label: 'With courier', color: 'warning' },
  delivered: { label: 'Delivered', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'gray' },
  returned: { label: 'Returned', color: 'gray' },
};

/** Columns of the order board, left to right. */
export const BOARD_COLUMNS: Array<{ key: string; label: string; stages: OrderStage[] }> = [
  { key: 'new', label: 'New', stages: ['new'] },
  { key: 'packed', label: 'Packed', stages: ['packed'] },
  { key: 'courier', label: 'With courier', stages: ['handed_over'] },
  { key: 'done', label: 'Delivered', stages: ['delivered'] },
  { key: 'closed', label: 'Failed & cancelled', stages: ['failed', 'cancelled', 'returned'] },
];

export const CHANNELS: Record<OrderChannel, string> = {
  instagram: 'Instagram',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  direct: 'Walk-in / direct',
};

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; color: BadgeColor }> = {
  unpaid: { label: 'Unpaid', color: 'error' },
  partially_paid: { label: 'Part paid', color: 'warning' },
  paid: { label: 'Paid', color: 'success' },
};

/** Allowed next stages (mirrors ORDER_STAGE_TRANSITIONS on the server). */
export const NEXT_STAGES: Record<OrderStage, OrderStage[]> = {
  new: ['packed', 'handed_over', 'cancelled'],
  packed: ['new', 'handed_over', 'cancelled'],
  handed_over: ['delivered', 'failed', 'returned', 'cancelled'],
  failed: ['handed_over', 'returned', 'cancelled'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
};

export const balanceDue = (o: Order) => Math.max(0, Number((o.total_amount - (o.amount_received || 0)).toFixed(2)));

/** Failed/cancelled/returned orders whose goods have not been confirmed back on the shelf. */
export const awaitingReturn = (o: Order) => ['failed', 'cancelled', 'returned'].includes(o.stage) && !o.stock_returned;
