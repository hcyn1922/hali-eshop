import React, { useEffect, useState } from 'react';
import { Download, FileText, PackageCheck, Paperclip, Printer, Share2, Trash2, Truck, Wallet } from 'lucide-react';
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
  const [slip, setSlip] = useState<File | null>(null);
  const toast = useToast();
  const action = useAction(
    async () => {
      let attached: { path: string; name: string; type: string } | undefined;
      if (slip) {
        const uploaded = await api.uploadSlip(await slipToDataUrl(slip));
        attached = { ...uploaded, name: slip.name };
      }
      return api.recordPayment(order.id, {
        amount: Number(amount),
        paymentMethod: method,
        transactionRef: reference.trim(),
        notes: notes.trim(),
        slip: attached,
      });
    },
    { invalidate: [...ORDER_KEYS, ['payments', order.id]], success: p => `Payment of ${formatMVR(p.amount)} recorded${p.slip_path ? ' with the slip' : ''}.`, onSuccess: onClose }
  );
  const pickSlip = (file: File | undefined) => {
    if (!file) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) return toast('Attach a photo, screenshot or PDF of the slip.', 'error');
    if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) return toast('PDF slips must be 5 MB or smaller.', 'error');
    setSlip(file);
  };

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
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-fg-2">Transfer slip</p>
          {slip ? (
            <div className="flex items-center gap-3 rounded-lg border border-line p-3">
              <FileText className="h-5 w-5 shrink-0 text-fg-4" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{slip.name}</span>
              <Button size="sm" variant="tertiary" iconOnly icon={<Trash2 className="h-4 w-4" />} onClick={() => setSlip(null)}>
                Remove slip
              </Button>
            </div>
          ) : (
            <label className="focus-within:ring-ring flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm font-semibold text-fg-3 hover:bg-hover">
              <Paperclip className="h-4 w-4" /> Attach slip (photo, screenshot or PDF)
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={e => pickSlip(e.target.files?.[0])} />
            </label>
          )}
          <p className="mt-1.5 text-sm text-fg-4">Stored privately; only staff who handle payments can open it.</p>
        </div>
        <Textarea label="Notes" containerClassName="sm:col-span-2" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

/** Photos are shrunk to keep uploads quick; PDFs are sent as they are. */
function slipToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the slip.'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (file.type === 'application/pdf') return resolve(dataUrl);
      const img = new Image();
      img.onerror = () => reject(new Error('That slip image could not be read.'));
      img.onload = () => {
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
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
