import type { StaffRole } from '../types';
import type { Permission } from '../lib/permissions';

/**
 * What the signed-in staff member may do, as decided by the owner in
 * Staff & access → Roles & permissions. The server enforces the same rules on every
 * request; this only decides which screens and buttons are shown.
 */
let current = new Set<Permission>();

export function setCurrentPermissions(list: Permission[] | undefined) {
  current = new Set(list || []);
}

const has = (role: StaffRole, p: Permission) => role === 'owner' || current.has(p);
const ownerOnly = (role: StaffRole) => role === 'owner';

export const can = {
  seeCosts: (r: StaffRole) => has(r, 'costs.view'),
  viewSales: (r: StaffRole) => has(r, 'sales.view'),
  manageStaff: ownerOnly,
  loadSample: ownerOnly,
  viewOrders: (r: StaffRole) => has(r, 'orders.view'),
  createOrders: (r: StaffRole) => has(r, 'orders.create'),
  processOrders: (r: StaffRole) => has(r, 'orders.process'),
  recordPayments: (r: StaffRole) => has(r, 'payments.record'),
  returnStock: (r: StaffRole) => has(r, 'stock.return'),
  viewBuyers: (r: StaffRole) => has(r, 'buyers.view'),
  editBuyers: (r: StaffRole) => has(r, 'buyers.edit'),
  manageCatalog: (r: StaffRole) => has(r, 'catalog.manage'),
  manageCouriers: (r: StaffRole) => has(r, 'couriers.manage'),
  deleteCouriers: ownerOnly,
  viewSuppliers: (r: StaffRole) => has(r, 'suppliers.view'),
  manageSuppliers: (r: StaffRole) => has(r, 'suppliers.manage'),
  planPosts: (r: StaffRole) => has(r, 'posts.manage'),
  viewPricing: (r: StaffRole) => has(r, 'pricing.manage'),
  viewReports: (r: StaffRole) => has(r, 'reports.view'),
  uploadImages: (r: StaffRole) => has(r, 'catalog.manage') || has(r, 'posts.manage'),
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner / Admin',
  sales: 'Sales',
  inventory: 'Inventory lead',
  marketing: 'Marketing',
};

/** Short role summaries for people requesting access (the owner can change what each role does). */
export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: 'Everything, including costs, reports, staff and settings.',
  sales: 'Usually: orders, buyers, payments and courier handovers.',
  inventory: 'Usually: catalog, suppliers, stock batches and returns to stock.',
  marketing: 'Usually: social post planning and the product catalog.',
};
