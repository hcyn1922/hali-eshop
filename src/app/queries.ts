import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../ui';
import { useAuth } from './auth';
import { can } from './permissions';

/** Query keys. Mutations invalidate the lists they affect. */
export const keys = {
  status: ['status'] as const,
  metrics: ['metrics'] as const,
  orders: ['orders'] as const,
  products: ['products'] as const,
  categories: ['categories'] as const,
  suppliers: ['suppliers'] as const,
  couriers: ['couriers'] as const,
  buyers: ['buyers'] as const,
  staff: ['staff'] as const,
  posts: ['posts'] as const,
  movements: (productId?: string) => ['movements', productId || 'all'] as const,
  batches: (productId: string) => ['batches', productId] as const,
  authSettings: ['auth-settings'] as const,
  addresses: ['addresses'] as const,
  shop: ['shop-profile'] as const,
};

export function useStatus() {
  return useQuery({ queryKey: keys.status, queryFn: api.getStatus });
}
export function useMetrics() {
  return useQuery({ queryKey: keys.metrics, queryFn: api.getMetrics });
}
export function useOrders() {
  const { role } = useAuth();
  return useQuery({ queryKey: keys.orders, queryFn: api.getOrders, enabled: can.viewOrders(role) });
}
export function useProducts() {
  return useQuery({ queryKey: keys.products, queryFn: api.getProducts });
}
export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: api.getCategories });
}
export function useSuppliers() {
  return useQuery({ queryKey: keys.suppliers, queryFn: api.getSuppliers });
}
export function useCouriers() {
  return useQuery({ queryKey: keys.couriers, queryFn: api.getDeliveryServices });
}
export function useBuyers() {
  const { role } = useAuth();
  return useQuery({ queryKey: keys.buyers, queryFn: api.getBuyers, enabled: can.viewBuyers(role) });
}
export function useStaff() {
  return useQuery({ queryKey: keys.staff, queryFn: api.getStaff });
}
export function usePosts() {
  return useQuery({ queryKey: keys.posts, queryFn: api.getSocialPosts });
}
export function useMovements(productId?: string) {
  return useQuery({ queryKey: keys.movements(productId), queryFn: () => api.getStockMovements(productId) });
}
export function useBatches(productId: string | undefined) {
  return useQuery({
    queryKey: keys.batches(productId || ''),
    queryFn: () => api.getBatches(productId!),
    enabled: Boolean(productId),
  });
}
export function useShopProfile() {
  return useQuery({ queryKey: keys.shop, queryFn: api.getShopProfile, staleTime: 5 * 60_000 });
}
export function useAuthSettings() {
  return useQuery({ queryKey: keys.authSettings, queryFn: api.getAuthSettings });
}
export function useExistingAddresses() {
  const { role } = useAuth();
  return useQuery({ queryKey: keys.addresses, queryFn: api.getExistingAddresses, enabled: can.createOrders(role) });
}

/**
 * Runs a write, shows a toast and refreshes the affected lists.
 * `success` may be a message or a function of the result.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options: {
    invalidate: ReadonlyArray<readonly unknown[]>;
    success?: string | ((result: TResult) => string);
    onSuccess?: (result: TResult) => void;
  }
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async result => {
      await Promise.all(options.invalidate.map(key => queryClient.invalidateQueries({ queryKey: key })));
      if (options.success) toast(typeof options.success === 'function' ? options.success(result) : options.success);
      options.onSuccess?.(result);
    },
    onError: (err: Error) => toast(err.message || 'Something went wrong.', 'error'),
  });
}

/** Everything an order change can affect. */
export const ORDER_KEYS = [keys.orders, keys.products, keys.metrics, keys.buyers, keys.movements(), ['movements'], ['batches']] as const;
/** Everything a stock change can affect. */
export const STOCK_KEYS = [keys.products, keys.metrics, ['movements'], ['batches'], keys.status] as const;
