import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Landmark, Mail, MapPin, Pencil, Phone, Trash2, AtSign, Receipt } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { STOCK_KEYS, keys, useAction, useShops } from '../../app/queries';
import { api } from '../../lib/api';
import { Badge, Button, Card, CardHeader, DetailRow, EmptyState, PageHeader, Skeleton } from '../../ui';
import { BANK_NAMES, ShopLogo } from './ShopDetailsForm';
import { ShopModal, isGstRegistered } from './ShopsPage';

/** Everything about one shop: logo, contacts, GST and the accounts printed on its invoices. */
export function ShopInfoPage() {
  const { shopId } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const shops = useShops();
  const [editing, setEditing] = useState(false);
  const shop = (shops.data || []).find(s => s.id === shopId);
  const remove = useAction(() => api.deleteShop(shopId!), { invalidate: [keys.shops, ...STOCK_KEYS], success: 'Shop removed.', onSuccess: () => navigate('/shops') });

  if (shops.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!shop)
    return (
      <Card>
        <EmptyState title="Shop not found" description="It may have been removed." action={<Button onClick={() => navigate('/shops')}>Back to shops</Button>} />
      </Card>
    );

  const contact = [
    { icon: Phone, label: 'Phone', value: shop.phone },
    { icon: Mail, label: 'Email', value: shop.email },
    { icon: AtSign, label: 'Instagram', value: shop.instagram && `@${shop.instagram.replace(/^@/, '')}` },
    { icon: MapPin, label: 'Address', value: shop.address },
  ];
  const accounts = shop.bank_accounts || [];
  const canDelete = (shop.product_count || 0) === 0 && (shops.data || []).length > 1;

  return (
    <>
      <Link to="/shops" className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-fg-3 hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All shops
      </Link>
      <PageHeader
        title={shop.name}
        description={shop.tagline || 'Shop details used on invoices, reports and pricing.'}
        actions={
          <>
            <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/products?shop=${shop.id}`)}>
              View products
            </Button>
            <Button variant="primary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit shop
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-4 p-6 lg:row-span-2">
          <ShopLogo shop={shop} className="h-36 w-full max-w-[260px]" />
          <div className="flex flex-wrap justify-center gap-2">
            {isGstRegistered(shop) ? <Badge color="success">GST registered</Badge> : <Badge>Not GST registered</Badge>}
            <Badge>{shop.product_count ?? 0} products</Badge>
            <Badge>{shop.units_in_stock ?? 0} units in stock</Badge>
          </div>
        </Card>

        <Card>
          <CardHeader title="Contact details" />
          <ul className="divide-y divide-line px-5">
            {contact.map(c => (
              <li key={c.label} className="flex items-start gap-3 py-3 text-sm">
                <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" />
                <span className="w-20 shrink-0 text-fg-3">{c.label}</span>
                <span className="min-w-0 break-words font-medium text-fg">{c.value || <span className="font-normal text-fg-4">Not added</span>}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="GST" />
          <dl className="divide-y divide-line px-5 py-1">
            <DetailRow label="GST TIN">{shop.gst_tin || <span className="text-fg-4">Not registered</span>}</DetailRow>
            <DetailRow label="On invoices">{shop.gst_tin ? 'TIN printed at the bottom' : 'No GST line'}</DetailRow>
            <DetailRow label="In reports">{shop.gst_tin ? '8% GST worked out' : 'No GST worked out'}</DetailRow>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Bank accounts" description="Printed on this shop's invoices so buyers know where to pay." />
          {accounts.length ? (
            <ul className="grid gap-3 p-5 sm:grid-cols-2">
              {accounts.map((a, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-subtle p-4 ring-1 ring-inset ring-line">
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-fg-3" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg">{BANK_NAMES[a.bank] || a.bank}</p>
                    <p className="tabular mt-1 break-all font-mono text-[15px] text-fg">{a.account_number}</p>
                    {a.account_name && <p className="mt-0.5 text-sm text-fg-3">{a.account_name}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-fg-3">No bank accounts yet.{role === 'owner' ? ' Add your BML or MIB account with Edit shop.' : ''}</p>
          )}
          {shop.bank_details && <p className="border-t border-line px-5 py-4 text-sm text-fg-3">{shop.bank_details}</p>}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Invoice footer note" />
          <p className="flex items-start gap-3 px-5 pb-5 text-sm text-fg-2">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" />
            {shop.invoice_note || <span className="text-fg-4">None</span>}
          </p>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          variant="tertiary"
          icon={<Trash2 className="h-4 w-4" />}
          disabled={!canDelete}
          title={canDelete ? undefined : (shop.product_count || 0) > 0 ? 'Move its products to another shop first' : 'Keep at least one shop'}
          onClick={() => window.confirm(`Remove the shop "${shop.name}"?`) && remove.mutate(undefined)}
        >
          Remove shop
        </Button>
      </div>

      {editing && <ShopModal shop={shop} onClose={() => setEditing(false)} />}
    </>
  );
}
