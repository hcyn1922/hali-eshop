import React, { useEffect, useState } from 'react';
import { Download, PackageCheck, Printer, Share2, Truck, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMVR } from '../../lib/formatters';
import { renderInvoice } from '../../lib/invoice';
import { ORDER_KEYS, useAction, useCouriers, useShopProfile } from '../../app/queries';
import type { Order, OrderStage, PaymentMethod } from '../../types';
import { Button, Input, Modal, Select, Spinner, Textarea, useToast } from '../../ui';
import { PAYMENT_METHODS, STAGES, balanceDue } from './meta';

export function HandoverModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const couriers = useCouriers();
  const [courierId, setCourierId] = useState(order.delivery_person_id || '');
  const [name, setName] = useState(order.delivery_person_name || '');
  const [phone, setPhone] = useState(order.delivery_person_phone || '');
  const [notes, setNotes] = useState('');
  const action = useAction(
    () => api.updateOrderStatus(order.id, 'handed_over', { delivery_person_name: name.trim(), delivery_person_phone: phone.trim(), notes: notes.trim() }),
    { invalidate: ORDER_KEYS, success: `${order.order_number} handed to ${name.trim()}.`, onSuccess: onClose }
  );

  const pick = (id: string) => {
    setCourierId(id);
    const c = couriers.data?.find(x => x.id === id);
    if (c) {
      setName(c.name);
      setPhone(c.phone);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Truck className="h-5 w-5" />}
      title="Hand over to courier"
      description="The courier's name is recorded with the handover time."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={action.isPending} disabled={!name.trim()} onClick={() => action.mutate(undefined)}>
            Confirm handover
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Courier service" value={courierId} onChange={e => pick(e.target.value)}>
          <option value="">Other / individual rider</option>
          {(couriers.data || [])
            .filter(c => c.is_active)
            .map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Input label="Delivery person" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmed - RedBox" />
        <Input label="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </Modal>
  );
}

export function PaymentModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const due = balanceDue(order);
  const [amount, setAmount] = useState(due > 0 ? due.toFixed(2) : '');
  const [method, setMethod] = useState<PaymentMethod>(order.payment_method || 'bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const action = useAction(
    () => api.recordPayment(order.id, { amount: Number(amount), paymentMethod: method, transactionRef: reference.trim(), notes: notes.trim() }),
    { invalidate: ORDER_KEYS, success: p => `Payment of ${formatMVR(p.amount)} recorded.`, onSuccess: onClose }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Wallet className="h-5 w-5" />}
      title="Record payment"
      description={`${formatMVR(order.amount_received || 0)} received of ${formatMVR(order.total_amount)}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={action.isPending} disabled={!(Number(amount) > 0)} onClick={() => action.mutate(undefined)}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          required
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          leading={<span className="text-xs">MVR</span>}
        />
        <Select label="Method" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map(m => (
            <option key={m} value={m}>
              {PAYMENT_METHODS[m]}
            </option>
          ))}
        </Select>
        <Input
          label={method === 'bank_transfer' ? 'Transfer reference' : 'Receipt reference'}
          containerClassName="sm:col-span-2"
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder={method === 'bank_transfer' ? 'e.g. BML transaction reference' : 'Optional'}
        />
        <Textarea label="Notes" containerClassName="sm:col-span-2" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

export function ReturnStockModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const action = useAction(() => api.returnOrderStock(order.id, reason.trim()), {
    invalidate: ORDER_KEYS,
    success: r => r.message,
    onSuccess: onClose,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<PackageCheck className="h-5 w-5" />}
      title="Return goods to stock"
      description="Only confirm once the items are physically back in the shop. Each item is added back to available stock and recorded in the ledger."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={action.isPending} onClick={() => action.mutate(undefined)}>
            Confirm return
          </Button>
        </>
      }
    >
      <ul className="mb-4 divide-y divide-line rounded-lg border border-line text-sm">
        {order.items.map(i => (
          <li key={i.id} className="flex justify-between px-3.5 py-2.5">
            <span className="text-fg-2">{i.product_name}</span>
            <span className="tabular font-medium text-fg">+{i.quantity}</span>
          </li>
        ))}
      </ul>
      <Textarea label="Notes" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Courier returned the parcel unopened" />
    </Modal>
  );
}

/** Confirmation for simple stage moves (packed, delivered, failed, cancelled, returned). */
export function StageModal({
  order,
  stage,
  onClose,
}: {
  order: Order;
  stage: OrderStage | null;
  onClose: () => void;
}) {
  const action = useAction((s: OrderStage) => api.updateOrderStatus(order.id, s), {
    invalidate: ORDER_KEYS,
    success: o => `${o.order_number} is now ${STAGES[o.stage].label.toLowerCase()}.`,
    onSuccess: onClose,
  });
  if (!stage) return null;
  const copy: Partial<Record<OrderStage, { title: string; body: string; cta: string; danger?: boolean }>> = {
    packed: { title: 'Mark as packed?', body: 'The order is ready for a courier.', cta: 'Mark packed' },
    new: { title: 'Move back to new?', body: 'Use this if the order needs changes before packing.', cta: 'Move to new' },
    delivered: { title: 'Mark as delivered?', body: 'Confirm the courier has dropped the parcel off.', cta: 'Mark delivered' },
    failed: {
      title: 'Mark delivery as failed?',
      body: 'Stock stays deducted until someone confirms the goods are back on the shelf.',
      cta: 'Mark failed',
      danger: true,
    },
    cancelled: {
      title: 'Cancel this order?',
      body: 'This cannot be undone. Stock stays deducted until the goods are confirmed back in the shop.',
      cta: 'Cancel order',
      danger: true,
    },
    returned: {
      title: 'Mark as returned?',
      body: 'Use this when the buyer sent the goods back. Confirm the return to stock separately.',
      cta: 'Mark returned',
      danger: true,
    },
  };
  const c = copy[stage]!;
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={c.title}
      description={c.body}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant={c.danger ? 'destructive' : 'primary'} loading={action.isPending} onClick={() => action.mutate(stage)}>
            {c.cta}
          </Button>
        </>
      }
    />
  );
}

export function InvoiceModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const shop = useShopProfile();
  const toast = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shop.data) return;
    let objectUrl: string | null = null;
    renderInvoice(order, shop.data)
      .then(b => {
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(err => toast(err.message, 'error'));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setBlob(null);
    };
  }, [open, order, shop.data, toast]);

  const fileName = `Invoice-${order.order_number}.jpg`;
  const file = blob ? new File([blob], fileName, { type: 'image/jpeg' }) : null;
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };
  const print = () => {
    if (!url) return;
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups to print the invoice.', 'error');
    w.document.write(
      `<title>${fileName}</title><style>@page{margin:12mm}body{margin:0}img{width:100%}</style><img src="${url}" onload="setTimeout(()=>{window.print()},200)">`
    );
    w.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Invoice ${order.order_number}`}
      description="Send it to the buyer on Instagram, Viber or WhatsApp, or print it."
      footer={
        <>
          <Button icon={<Printer className="h-4 w-4" />} onClick={print} disabled={!url}>
            Print
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={download} disabled={!url}>
            Download
          </Button>
          {canShare && (
            <Button variant="primary" icon={<Share2 className="h-4 w-4" />} onClick={() => navigator.share({ files: [file!], title: fileName }).catch(() => {})}>
              Share
            </Button>
          )}
        </>
      }
    >
      <div className="flex min-h-[300px] items-start justify-center rounded-lg border border-line bg-subtle p-2">
        {url ? <img src={url} alt={`Invoice ${order.order_number}`} className="w-full rounded shadow-sm" /> : <Spinner className="mt-20" />}
      </div>
    </Modal>
  );
}
