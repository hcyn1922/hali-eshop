import {
  StaffProfile,
  Category,
  Supplier,
  DeliveryService,
  Product,
  PurchaseBatch,
  StockMovement,
  Buyer,
  Order,
  DeliveryHandover,
  PaymentRecord,
  SocialPost,
  DashboardMetrics,
  StaffRole,
  RegisterRequestData,
  RegisterResult,
  AuthSettings,
  ShopProfile,
  AiStudioInput,
  AiInspection,
  AiPhotoResult,
} from '../types';
import { supabase } from '../supabaseClient';
import type { ConfigurableRole, Permission } from './permissions';

const TOKEN_KEY = 'hali_auth_token';
const PROFILE_KEY = 'hali_staff_profile';

let currentAuthToken = localStorage.getItem(TOKEN_KEY) || '';

/** Supabase access tokens are JWTs; shop session tokens are opaque hex strings. */
export function isSupabaseToken(token: string): boolean {
  return token.split('.').length === 3;
}

export function setAuthToken(token: string, staff?: StaffProfile) {
  currentAuthToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (staff) localStorage.setItem(PROFILE_KEY, JSON.stringify(staff));
    else if (!token) localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the in-memory token still works
  }
}

export function getAuthToken(): string {
  return currentAuthToken;
}

/** Last known profile, only used to paint the UI before /api/auth/me answers. */
export function getCachedStaffProfile(): StaffProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StaffProfile) : null;
  } catch {
    return null;
  }
}

/** Supabase access tokens expire hourly; the Supabase client refreshes them for us. */
async function freshToken(): Promise<string> {
  if (supabase && currentAuthToken && isSupabaseToken(currentAuthToken)) {
    try {
      const { data } = await supabase.auth.getSession();
      const latest = data?.session?.access_token;
      if (latest && latest !== currentAuthToken) setAuthToken(latest);
    } catch {
      // Keep the current token; the server will answer 401 if it is no longer valid
    }
  }
  return currentAuthToken;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = await freshToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(endpoint, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the Hali e-shop server. Check your internet connection and try again.');
  }

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore json parse error
    }
    if (res.status === 401 && !endpoint.startsWith('/api/auth/login')) {
      setAuthToken('');
      window.dispatchEvent(new CustomEvent('hali:unauthorized'));
    }
    throw new ApiError(res.status, errorMsg);
  }

  return res.json() as Promise<T>;
}

type OrderCreateInput = {
  buyer_id: string;
  channel: Order['channel'];
  delivery_fee: number;
  payment_method: Order['payment_method'];
  payment_status: Order['payment_status'];
  amount_received: number;
  notes?: string;
  delivery_address?: string;
  boat_name?: string;
  boat_phone?: string;
  boat_jetty?: string;
  atoll_code?: string;
  island_name?: string;
  hulhumale_lot?: string;
  location_link?: string;
  channel_detail?: string;
  delivery_person_id?: string;
  delivery_person_name?: string;
  delivery_person_phone?: string;
  delivery_rate?: number;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_selling_price: number;
  }>;
};

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

export const api = {
  // Authentication
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; staff: StaffProfile; expires_at: string }>('/api/auth/login', post(credentials)),
  getMe: () => request<{ staff: StaffProfile; has_local_password: boolean; primary_owner_email: string; permissions: Permission[] }>('/api/auth/me'),
  logout: () => request<{ success: boolean; message: string }>('/api/auth/logout', post()),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', post(data)),
  resetStaffPassword: (staffId: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/auth/reset-password', post({ staffId, newPassword })),
  register: (data: RegisterRequestData) => request<RegisterResult>('/api/auth/register', post(data)),
  getAuthSettings: () => request<AuthSettings>('/api/auth/settings'),
  updateAuthSettings: (settings: Partial<AuthSettings>) => request<AuthSettings>('/api/auth/settings', put(settings)),
  getSessions: () => request<{ count: number }>('/api/auth/sessions'),

  // System Status & Sample
  getStatus: () =>
    request<{
      status: string;
      productsCount: number;
      sampleLoaded: boolean;
      storage: string;
      supabaseConfigured: boolean;
      emailConfigured: boolean;
      notifyEmail?: string;
      aiPhotos?: { enabled: boolean; model: string; dailyLimit: number; usedToday: number };
    }>(
      '/api/status'
    ),
  loadSampleInventory: () => request<{ message: string; success: boolean }>('/api/sample/load', post()),

  // Price calculator
  getPricingMargins: () => request<number[]>('/api/pricing/margins'),
  rememberPricingMargin: (margin: number) => request<number[]>('/api/pricing/margins', post({ margin })),
  forgetPricingMargin: (margin: number) => request<number[]>(`/api/pricing/margins/${margin}`, { method: 'DELETE' }),

  getPricingDeliveryRate: () => request<{ rate: number }>('/api/pricing/delivery-rate'),
  setPricingDeliveryRate: (rate: number) => request<{ rate: number }>('/api/pricing/delivery-rate', put({ rate })),

  // Role permissions (owner)
  getRolePermissions: () => request<Record<ConfigurableRole, Permission[]>>('/api/role-permissions'),
  updateRolePermissions: (role: ConfigurableRole, permissions: Permission[]) =>
    request<Record<ConfigurableRole, Permission[]>>(`/api/role-permissions/${role}`, put({ permissions })),
  resetRolePermissions: () => request<Record<ConfigurableRole, Permission[]>>('/api/role-permissions/reset', post()),

  // Shop profile
  getShopProfile: () => request<ShopProfile>('/api/shop-profile'),
  updateShopProfile: (data: Partial<ShopProfile>) => request<ShopProfile>('/api/shop-profile', put(data)),

  // Dashboard
  getMetrics: () => request<DashboardMetrics>('/api/dashboard/metrics'),

  // Staff & RBAC
  getStaff: () => request<StaffProfile[]>('/api/staff'),
  inviteStaff: (staff: { email: string; full_name: string; role: StaffRole; phone?: string; is_active: boolean; password?: string }) =>
    request<StaffProfile>('/api/staff/invite', post(staff)),
  requestAccess: (data: { full_name: string; email: string; phone?: string; role: StaffRole; password?: string; request_note?: string }) =>
    request<StaffProfile>('/api/staff/request-access', post(data)),
  approveStaffRequest: (id: string, role?: StaffRole) => request<StaffProfile>(`/api/staff/${id}/approve`, post({ role })),
  rejectStaffRequest: (id: string) => request<StaffProfile>(`/api/staff/${id}/reject`, post()),
  changeStaffRole: (id: string, role: StaffRole) => request<StaffProfile>(`/api/staff/${id}/role`, post({ role })),
  toggleStaffActive: (id: string) => request<StaffProfile>(`/api/staff/${id}/toggle`, post()),
  deactivateStaff: (id: string) => request<StaffProfile>(`/api/staff/${id}/deactivate`, post()),
  deleteStaff: (id: string) => request<{ success: boolean; message: string }>(`/api/staff/${id}`, { method: 'DELETE' }),
  updateStaffProfile: (id: string, data: { full_name?: string; email?: string; phone?: string }) =>
    request<StaffProfile>(`/api/staff/${id}`, put(data)),

  // Categories
  getCategories: () => request<Category[]>('/api/categories'),
  createCategory: (name: string, description?: string) => request<Category>('/api/categories', post({ name, description })),
  updateCategory: (id: string, data: { name?: string; description?: string }) => request<Category>(`/api/categories/${id}`, put(data)),
  deleteCategory: (id: string) => request<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: () => request<Supplier[]>('/api/suppliers'),
  createSupplier: (data: Partial<Supplier>) => request<Supplier>('/api/suppliers', post(data)),
  updateSupplier: (id: string, data: Partial<Supplier>) => request<Supplier>(`/api/suppliers/${id}`, put(data)),

  // Products
  getProducts: () => request<Product[]>('/api/products'),
  getProduct: (id: string) => request<Product>(`/api/products/${id}`),
  createProduct: (data: Partial<Product> & { openingStock?: number }) => request<Product>('/api/products', post(data)),
  updateProduct: (id: string, data: Partial<Product>) => request<Product>(`/api/products/${id}`, put(data)),

  // Batches & Stock Movements
  addBatch: (data: {
    product_id: string;
    batch_number: string;
    purchase_date: string;
    quantity: number;
    unit_cost: number;
    shipping_cost?: number;
    other_costs?: number;
    supplier_id: string;
    notes?: string;
  }) => request<PurchaseBatch>('/api/batches', post(data)),
  getBatches: (productId: string) => request<PurchaseBatch[]>(`/api/batches/${encodeURIComponent(productId)}`),
  getStockMovements: (productId?: string) =>
    request<StockMovement[]>(`/api/stock/movements${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`),
  correctStock: (productId: string, newQuantity: number, reason: string) =>
    request<StockMovement>('/api/stock/correct', post({ productId, newQuantity, reason })),

  // Buyers
  getBuyers: () => request<Buyer[]>('/api/buyers'),
  createBuyer: (data: Partial<Buyer>) => request<Buyer>('/api/buyers', post(data)),
  updateBuyer: (id: string, data: Partial<Buyer>) => request<Buyer>(`/api/buyers/${id}`, put(data)),

  // Delivery Services & Couriers
  getDeliveryServices: () => request<DeliveryService[]>('/api/delivery-services'),
  createDeliveryService: (data: Partial<DeliveryService>) => request<DeliveryService>('/api/delivery-services', post(data)),
  updateDeliveryService: (id: string, data: Partial<DeliveryService>) =>
    request<DeliveryService>(`/api/delivery-services/${id}`, put(data)),
  deleteDeliveryService: (id: string) => request<{ success: boolean }>(`/api/delivery-services/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => request<Order[]>('/api/orders'),
  createOrder: (data: OrderCreateInput) => request<Order>('/api/orders', post(data)),
  updateOrderStatus: (
    id: string,
    stage: Order['stage'],
    deliveryInfo?: { delivery_person_name: string; delivery_person_phone?: string; notes?: string }
  ) => request<Order>(`/api/orders/${id}/status`, post({ stage, deliveryInfo })),
  returnOrderStock: (id: string, reason: string) =>
    request<{ success: boolean; message: string }>(`/api/orders/${id}/return-stock`, post({ reason })),
  recordPayment: (
    id: string,
    data: {
      amount: number;
      paymentMethod: Order['payment_method'];
      transactionRef?: string;
      notes?: string;
      slip?: { path: string; name: string; type: string };
    }
  ) => request<PaymentRecord>(`/api/orders/${id}/payment`, post(data)),
  getPayments: (orderId: string) => request<PaymentRecord[]>(`/api/orders/${orderId}/payments`),
  uploadSlip: (dataUrl: string) => request<{ path: string; type: string }>('/api/uploads/slip', post({ data: dataUrl })),
  /** Downloads a private payment slip with the staff member's session. */
  getSlip: async (paymentId: string): Promise<Blob> => {
    const token = await freshToken();
    const res = await fetch(`/api/payments/${paymentId}/slip`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Could not open the slip.');
    return res.blob();
  },
  sendTestEmail: () => request<{ success: boolean; message: string }>('/api/notifications/test', post()),

  // Deliveries
  getDeliveries: () => request<DeliveryHandover[]>('/api/deliveries'),
  getExistingAddresses: () => request<string[]>('/api/addresses/existing'),
  uploadImage: (dataUrl: string) => request<{ url: string }>('/api/uploads', post({ data: dataUrl })),

  // AI studio photos (slow: the inspect step takes seconds, generating can take a minute or more)
  inspectAiPhoto: (input: AiStudioInput) => request<AiInspection>('/api/ai-photos/inspect', post(input)),
  generateAiPhotos: (input: AiStudioInput & { approved: AiInspection; views: string[] }) =>
    request<{ photos: AiPhotoResult[]; remaining_today: number }>('/api/ai-photos/generate', post(input)),

  // Social Posts
  getSocialPosts: () => request<SocialPost[]>('/api/social-posts'),
  createSocialPost: (data: Partial<SocialPost>) => request<SocialPost>('/api/social-posts', post(data)),
  updateSocialPost: (id: string, data: Partial<SocialPost>) => request<SocialPost>(`/api/social-posts/${id}`, put(data)),
};
