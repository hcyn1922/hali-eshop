import type { Order, Product, Shop } from '../../types';

/** product id → shop id, from the products list. */
export function productShopMap(products: Product[] | undefined): Map<string, string | undefined> {
  return new Map((products || []).map(p => [p.id, p.shop_id]));
}

/** The shop an order belongs to: the one with the most of its value (first shop if unknown). */
export function shopForOrder(order: Order, products: Product[] | undefined, shops: Shop[] | undefined): Shop | undefined {
  const list = shops || [];
  const byProduct = productShopMap(products);
  const totals = new Map<string, number>();
  for (const i of order.items) {
    const shopId = byProduct.get(i.product_id);
    if (shopId) totals.set(shopId, (totals.get(shopId) || 0) + (i.line_total || 0) + 0.0001);
  }
  const best = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return list.find(s => s.id === best) || list[0];
}

/**
 * The part of an order that belongs to one shop: only that shop's lines, with delivery,
 * payments and totals split by the shop's share of the product value.
 */
export function orderForShop(order: Order, shopId: string, byProduct: Map<string, string | undefined>): Order | null {
  const items = order.items.filter(i => byProduct.get(i.product_id) === shopId);
  if (!items.length) return null;
  if (items.length === order.items.length) return order;
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const share = order.subtotal_amount > 0 ? subtotal / order.subtotal_amount : items.length / order.items.length;
  return {
    ...order,
    items,
    subtotal_amount: subtotal,
    delivery_fee: (order.delivery_fee || 0) * share,
    delivery_rate: (order.delivery_rate || 0) * share,
    total_amount: order.total_amount * share,
    amount_received: (order.amount_received || 0) * share,
  };
}
