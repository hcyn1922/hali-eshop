import {
  BarChart3,
  Boxes,
  Calculator,
  History,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { StaffRole } from '../types';
import { can } from './permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  allowed: (role: StaffRole) => boolean;
  /** Shown in the phone bottom bar (others go under "More"). */
  mobilePrimary?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const everyone = () => true;

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, allowed: everyone, mobilePrimary: true },
      { to: '/orders', label: 'Orders', icon: ShoppingBag, allowed: can.viewOrders, mobilePrimary: true },
      { to: '/buyers', label: 'Buyers', icon: UsersRound, allowed: can.viewBuyers },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Boxes, allowed: everyone, mobilePrimary: true },
      { to: '/stock', label: 'Stock ledger', icon: History, allowed: everyone },
      { to: '/suppliers', label: 'Suppliers & couriers', icon: Truck, allowed: r => can.viewSuppliers(r) || can.manageCouriers(r) },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/social', label: 'Social posts', icon: Megaphone, allowed: can.planPosts },
      { to: '/pricing', label: 'Pricing', icon: Calculator, allowed: can.viewPricing },
      { to: '/reports', label: 'Reports', icon: BarChart3, allowed: can.viewReports },
    ],
  },
  {
    title: 'Admin',
    items: [{ to: '/staff', label: 'Staff & access', icon: Users, allowed: can.manageStaff }],
  },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings, allowed: everyone };

export function visibleSections(role: StaffRole): NavSection[] {
  return NAV_SECTIONS.map(s => ({ ...s, items: s.items.filter(i => i.allowed(role)) })).filter(s => s.items.length > 0);
}
