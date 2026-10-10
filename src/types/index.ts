export type StaffRole = 'owner' | 'sales' | 'inventory' | 'marketing';
export type StaffApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  phone?: string;
  is_active: boolean;
  approval_status?: StaffApprovalStatus;
  request_note?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthSession {
  token: string;
  staff: StaffProfile;
  expires_at?: string;
}

export interface LoginResponse {
  token: string;
  staff: StaffProfile;
  expires_at?: string;
}

export interface RegisterRequestData {
  full_name: string;
  email: string;
  phone?: string;
  role?: StaffRole;
  password?: string;
  request_note?: string;
  auto_login?: boolean;
}

export interface RegisterResult {
  staff: StaffProfile;
  session?: {
    token: string;
    staff: StaffProfile;
    expires_at: string;
  };
}

export interface AuthSettings {
  allow_open_registration: boolean;
  default_role: StaffRole;
  session_duration_days: number;
}

export interface ForgotPasswordResponse {
  code: string;
  expires_at: string;
  message: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  instagram_or_website?: string;
  payment_details?: string;
  notes?: string;
  created_at: string;
}

export type CourierServiceType = 'courier_company' | 'independent_rider' | 'in_house';

export interface DeliveryService {
  id: string;
  name: string;
  phone: string;
  default_rate: number; // MVR rate charged by courier service
  service_type: CourierServiceType;
  coverage_area?: string; // e.g. Male', Hulhumale', Boats
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type PricingRule = 'markup_on_cost' | 'gross_margin' | 'fixed_margin' | 'match_market';

export interface ProductImage {
  id: string;
  url: string;
  is_primary?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  category_name?: string;
  supplier_id: string;
  supplier_name?: string;
  description?: string;
  images: ProductImage[];
  wholesale_unit_cost: number; // hidden from non-owners on API if restricted
  pricing_rule: PricingRule;
  pricing_rule_percentage: number;
  suggested_price: number;
  actual_listed_price: number;
  // Pricing Strategy Engine & Tax Fields:
  gst_rate?: number; // Standard Maldives General GST (8%)
  gst_amount?: number; // MVR GST component per unit
  market_price?: number; // Competitor / Market benchmark price in MVR
  calculated_selling_price?: number; // Algorithmic selling price based on rule + 8% GST
  is_price_overridden?: boolean; // Whether actual_listed_price is an owner override vs rule-calculated
  price_override_reason?: string; // Reason for manual override
  low_stock_threshold: number;
  is_active: boolean;
  available_stock: number;
  created_at: string;
  updated_at?: string;
}

export interface PurchaseBatch {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  batch_number: string;
  purchase_date: string;
  quantity: number;
  unit_cost: number;
  shipping_cost: number;
  other_costs: number;
  supplier_id: string;
  supplier_name?: string;
  notes?: string;
  created_at: string;
}

export type MovementType = 'received' | 'sold' | 'returned' | 'corrected' | 'opening_balance';
export type ReferenceType = 'purchase_batch' | 'order' | 'return_to_stock' | 'manual_correction' | 'historical_opening';

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  movement_type: MovementType;
  quantity_delta: number;
  resulting_stock: number;
  reference_type: ReferenceType;
  reference_id?: string;
  notes: string;
  performed_by_staff_id?: string;
  performed_by_name?: string;
  created_at: string;
}

export interface Buyer {
  id: string;
  name: string;
  phone: string;
  delivery_address: string;
  instagram_handle?: string;
  boat_name?: string;
  boat_phone?: string;
  boat_jetty?: string;
  atoll_code?: string;
  island_name?: string;
  location_link?: string;
  notes?: string;
  orders_count?: number;
  total_spent?: number;
  created_at: string;
}

export type OrderChannel = 'instagram' | 'viber' | 'whatsapp' | 'sms' | 'direct' | 'other';
export type OrderStage = 'new' | 'packed' | 'handed_over' | 'delivered' | 'failed' | 'cancelled' | 'returned';
export type PaymentMethod = 'bank_transfer' | 'cash';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_selling_price: number;
  unit_cost: number; // captured snapshot
  line_total: number;
  line_cost: number;
}

export interface Order {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_address?: string;
  buyer_instagram?: string;
  boat_name?: string;
  boat_phone?: string;
  boat_jetty?: string;
  atoll_code?: string;
  island_name?: string;
  hulhumale_lot?: string;
  order_date: string;
  channel: OrderChannel;
  /** Free text when channel is "other" (e.g. TikTok, phone call). */
  channel_detail?: string;
  /** Map pin link for the courier. Staff only; never printed for customers. */
  location_link?: string;
  stage: OrderStage;
  subtotal_amount: number;
  delivery_fee: number;
  total_amount: number;
  total_cost?: number; // only visible to owner
  delivery_rate?: number; // courier delivery price/rate deducted when calculating profit
  estimated_profit?: number; // only visible to owner (Revenue - Wholesale Cost - Delivery Price)
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount_received: number;
  created_by_staff_id: string;
  created_by_name?: string;
  notes?: string;
  stock_returned?: boolean; // for failed/cancelled orders
  delivery_person_id?: string;
  delivery_person_name?: string;
  delivery_person_phone?: string;
  delivery_handover_time?: string;
  delivery_completed_time?: string;
  items: OrderItem[];
  created_at: string;
  updated_at?: string;
}

export interface DeliveryHandover {
  id: string;
  order_id: string;
  order_number: string;
  delivery_person_name: string;
  delivery_person_phone?: string;
  handover_time: string;
  notes?: string;
  status: 'handed_over' | 'in_transit' | 'delivered' | 'failed';
  delivered_time?: string;
  staff_id: string;
  staff_name?: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  receipt_notes?: string;
  /** Private storage path of the attached transfer slip (served only through the API). */
  slip_path?: string;
  slip_name?: string;
  slip_type?: string;
  recorded_by_staff_id: string;
  recorded_by_name?: string;
  created_at: string;
}

export type PostPlatform = 'instagram' | 'viber' | 'tiktok' | 'facebook';
export type PostStatus = 'draft' | 'planned' | 'posted';

export interface SocialPost {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  platform: PostPlatform;
  caption: string;
  image_url?: string;
  planned_date?: string;
  status: PostStatus;
  published_url?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  recorded_sales_revenue: number;
  orders_in_progress: number;
  available_stock_count: number;
  low_stock_count: number;
  estimated_gross_profit: number;
  total_orders_count: number;
  pending_delivery_count: number;
  profit_calculation_note: string;
  is_owner: boolean;
}

export interface ShopProfile {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  instagram: string;
  address: string;
  gst_tin: string;
  invoice_note: string;
  bank_details: string;
}
