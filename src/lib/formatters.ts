import { PricingRule } from '../types';

/**
 * Maldivian Rufiyaa currency sign (Unicode U+20C2: ⃂)
 */
export const MALDIVIAN_RUFIYAA_SIGN = '\u20C2';

/**
 * Format currency in Maldivian Rufiyaa (MVR)
 */
export function formatMVR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'MVR 0.00';
  }
  return `MVR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format currency with the official Maldivian Rufiyaa symbol (U+20C2)
 */
export function formatWithRufiyaaSign(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${MALDIVIAN_RUFIYAA_SIGN} 0.00`;
  }
  return `${MALDIVIAN_RUFIYAA_SIGN} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculate suggested retail price based on pricing rule
 * 1. Markup on cost: unitCost * (1 + percentage / 100)
 * 2. Gross margin on selling price: unitCost / (1 - percentage / 100)
 */
export function calculateSuggestedPrice(
  unitCost: number,
  percentage: number,
  rule: PricingRule
): number {
  if (unitCost <= 0 || isNaN(unitCost)) return 0;
  if (isNaN(percentage)) return unitCost;

  if (rule === 'markup_on_cost') {
    const raw = unitCost * (1 + percentage / 100);
    return Math.round(raw * 100) / 100;
  } else {
    // gross margin on selling price
    if (percentage >= 100) return unitCost;
    const raw = unitCost / (1 - percentage / 100);
    return Math.round(raw * 100) / 100;
  }
}

/**
 * Calculate the resulting gross margin % when given cost and selling price
 */
export function calculateActualMargin(sellingPrice: number, cost: number): number {
  if (sellingPrice <= 0 || cost <= 0 || sellingPrice < cost) return 0;
  return Math.round(((sellingPrice - cost) / sellingPrice) * 10000) / 100;
}

/**
 * Calculate the resulting markup on cost % when given cost and selling price
 */
export function calculateActualMarkup(sellingPrice: number, cost: number): number {
  if (cost <= 0) return 0;
  return Math.round(((sellingPrice - cost) / cost) * 10000) / 100;
}

/**
 * Format date in Maldives local time (UTC+5)
 */
export function formatMaldivesDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Indian/Maldives',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Format datetime in Maldives local time (UTC+5)
 */
export function formatMaldivesDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Indian/Maldives',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return String(dateString);
  }
}
