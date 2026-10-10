import type { StaffRole } from '../types';

/**
 * What each role may do. Mirrors the route guards in server.ts; the server is the
 * authority, this only decides which screens and buttons are shown.
 */
export const can = {
  seeCosts: (r: StaffRole) => r === 'owner',
  manageStaff: (r: StaffRole) => r === 'owner',
  loadSample: (r: StaffRole) => r === 'owner',
  viewOrders: (r: StaffRole) => r === 'owner' || r === 'sales' || r === 'inventory',
  createOrders: (r: StaffRole) => r === 'owner' || r === 'sales',
  processOrders: (r: StaffRole) => r === 'owner' || r === 'sales' || r === 'inventory',
  recordPayments: (r: StaffRole) => r === 'owner' || r === 'sales',
  returnStock: (r: StaffRole) => r === 'owner' || r === 'inventory',
  viewBuyers: (r: StaffRole) => r === 'owner' || r === 'sales' || r === 'inventory',
  editBuyers: (r: StaffRole) => r === 'owner' || r === 'sales',
  manageCatalog: (r: StaffRole) => r === 'owner' || r === 'inventory',
  manageCouriers: (r: StaffRole) => r === 'owner' || r === 'sales' || r === 'inventory',
  deleteCouriers: (r: StaffRole) => r === 'owner',
  viewSuppliers: (r: StaffRole) => r === 'owner' || r === 'inventory',
  planPosts: (r: StaffRole) => r === 'owner' || r === 'marketing',
  viewPricing: (r: StaffRole) => r === 'owner',
  viewReports: (r: StaffRole) => r === 'owner',
  uploadImages: (r: StaffRole) => r === 'owner' || r === 'inventory' || r === 'marketing',
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner / Admin',
  sales: 'Sales',
  inventory: 'Inventory lead',
  marketing: 'Marketing',
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: 'Everything, including wholesale costs, margins, reports and staff.',
  sales: 'Orders, buyers, payments and courier handovers. Costs are hidden.',
  inventory: 'Catalog, suppliers, stock batches, corrections and returns to stock.',
  marketing: 'Social post planning and the product catalog (view only).',
};
