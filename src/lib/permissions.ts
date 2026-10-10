/**
 * Feature permissions the owner can switch on or off per role.
 * Shared by the server (which enforces them on every request) and the browser
 * (which only uses them to decide what to show).
 * The owner always has every permission; staff management, shop settings and
 * sign-up approval always stay owner-only.
 */
export type Permission =
  | 'orders.view'
  | 'orders.create'
  | 'orders.process'
  | 'payments.record'
  | 'stock.return'
  | 'buyers.view'
  | 'buyers.edit'
  | 'couriers.manage'
  | 'catalog.manage'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'posts.manage'
  | 'sales.view'
  | 'costs.view'
  | 'pricing.manage'
  | 'reports.view';

export type ConfigurableRole = 'sales' | 'inventory' | 'marketing';
export const CONFIGURABLE_ROLES: ConfigurableRole[] = ['sales', 'inventory', 'marketing'];

export interface PermissionInfo {
  key: Permission;
  group: 'Orders' | 'Buyers & delivery' | 'Catalog & stock' | 'Business';
  label: string;
  description: string;
  /** Permissions that are switched on automatically with this one. */
  requires?: Permission[];
  /** Shows a caution note: this exposes money figures. */
  sensitive?: boolean;
}

export const PERMISSIONS: PermissionInfo[] = [
  { key: 'orders.view', group: 'Orders', label: 'See orders', description: 'Order board and list, order details and delivery handovers.' },
  { key: 'orders.create', group: 'Orders', label: 'Create orders', description: 'Take new orders from Instagram, Viber, WhatsApp and SMS.', requires: ['orders.view', 'buyers.view'] },
  { key: 'orders.process', group: 'Orders', label: 'Process orders', description: 'Pack, hand over to couriers, mark delivered, failed or cancelled.', requires: ['orders.view'] },
  { key: 'payments.record', group: 'Orders', label: 'Record payments', description: 'Record payments and attach or open bank transfer slips.', requires: ['orders.view'] },
  { key: 'stock.return', group: 'Orders', label: 'Return goods to stock', description: 'Confirm failed or cancelled goods are back on the shelf.', requires: ['orders.view'] },
  { key: 'buyers.view', group: 'Buyers & delivery', label: 'See buyers', description: 'Buyer names, phone numbers, addresses and order history.' },
  { key: 'buyers.edit', group: 'Buyers & delivery', label: 'Add and edit buyers', description: 'Create buyers and change their details.', requires: ['buyers.view'] },
  { key: 'couriers.manage', group: 'Buyers & delivery', label: 'Manage couriers', description: 'Add couriers and change their usual charges.' },
  { key: 'catalog.manage', group: 'Catalog & stock', label: 'Manage products & stock', description: 'Add and edit products and categories, upload photos, receive stock and correct counts.' },
  { key: 'suppliers.view', group: 'Catalog & stock', label: 'See suppliers', description: 'Supplier contacts and payment details.' },
  { key: 'suppliers.manage', group: 'Catalog & stock', label: 'Manage suppliers', description: 'Add and edit suppliers.', requires: ['suppliers.view'] },
  { key: 'posts.manage', group: 'Business', label: 'Plan social posts', description: 'Create and edit social posts and upload their images.' },
  { key: 'sales.view', group: 'Business', label: 'See shop sales totals', description: 'Recorded sales and the sales chart on the dashboard.', sensitive: true },
  { key: 'costs.view', group: 'Business', label: 'See costs & profit', description: 'Wholesale costs, batch costs, markups, margins and profit.', sensitive: true },
  { key: 'pricing.manage', group: 'Business', label: 'Pricing', description: 'The pricing page: set rules and change prices in bulk.', requires: ['costs.view'], sensitive: true },
  { key: 'reports.view', group: 'Business', label: 'Reports', description: 'Sales and profit reports, CSV export and the GST estimate.', requires: ['costs.view', 'sales.view', 'orders.view'], sensitive: true },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map(p => p.key);

/** How the roles worked before permissions became configurable. */
export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, Permission[]> = {
  sales: ['orders.view', 'orders.create', 'orders.process', 'payments.record', 'buyers.view', 'buyers.edit', 'couriers.manage'],
  inventory: ['orders.view', 'orders.process', 'stock.return', 'buyers.view', 'couriers.manage', 'catalog.manage', 'suppliers.view', 'suppliers.manage', 'sales.view'],
  marketing: ['posts.manage', 'sales.view'],
};

/** Keeps only known permissions and switches on anything they depend on. */
export function normalizePermissions(list: unknown): Permission[] {
  const set = new Set<Permission>((Array.isArray(list) ? list : []).filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const info of PERMISSIONS) {
      if (!set.has(info.key)) continue;
      for (const dep of info.requires || []) {
        if (!set.has(dep)) {
          set.add(dep);
          changed = true;
        }
      }
    }
  }
  return ALL_PERMISSIONS.filter(p => set.has(p));
}

/** Permissions that would also be switched off when `key` is switched off. */
export function dependents(key: Permission): Permission[] {
  const out = new Set<Permission>();
  const visit = (k: Permission) => {
    for (const info of PERMISSIONS) {
      if (info.requires?.includes(k) && !out.has(info.key)) {
        out.add(info.key);
        visit(info.key);
      }
    }
  };
  visit(key);
  return [...out];
}
