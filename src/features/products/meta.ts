import type { BadgeColor } from '../../ui';
import type { MovementType, Product } from '../../types';

export const MOVEMENTS: Record<MovementType, { label: string; color: BadgeColor }> = {
  received: { label: 'Received', color: 'success' },
  sold: { label: 'Sold', color: 'blue' },
  returned: { label: 'Returned to stock', color: 'purple' },
  corrected: { label: 'Correction', color: 'warning' },
  opening_balance: { label: 'Opening balance', color: 'gray' },
};

export function stockState(p: Product): { label: string; color: BadgeColor } {
  if (!p.is_active) return { label: 'Inactive', color: 'gray' };
  if (p.available_stock <= 0) return { label: 'Out of stock', color: 'error' };
  if (p.available_stock <= p.low_stock_threshold) return { label: `${p.available_stock} left`, color: 'warning' };
  return { label: `${p.available_stock} in stock`, color: 'success' };
}

export const primaryImage = (p: Product) => p.images?.find(i => i.is_primary)?.url || p.images?.[0]?.url;
