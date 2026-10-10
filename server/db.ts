import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createStateStore, StateStore } from './store.ts';
import type {
  StaffProfile,
  Category,
  Supplier,
  DeliveryService,
  Product,
  PurchaseBatch,
  StockMovement,
  Buyer,
  Order,
  OrderItem,
  DeliveryHandover,
  PaymentRecord,
  SocialPost,
  DashboardMetrics,
  StaffRole
} from '../src/types/index.ts';

export interface UserCredential {
  staff_id: string;
  email: string;
  password_hash: string;
  salt: string;
  updated_at: string;
}

export interface AuthSessionRecord {
  token: string;
  staff_id: string;
  role: StaffRole;
  created_at: string;
  expires_at: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const computed = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

/** The bootstrap owner account. It is always kept active with the owner role. */
export const PRIMARY_OWNER_EMAIL = (process.env.HALI_OWNER_EMAIL || 'hasanyone@gmail.com').trim().toLowerCase();

/**
 * Demo passwords seeded ONLY in local development so the RBAC roles can be tried out.
 * In production no well-known password is ever created: the owner signs in through
 * Supabase Auth or with HALI_OWNER_PASSWORD, then invites staff with their own passwords.
 */
const DEV_DEMO_PASSWORDS: Record<string, string> = {
  'owner@hali.mv': 'HaliAdmin2026!',
  'sales@hali.mv': 'Sales2026!',
  'inventory@hali.mv': 'Inventory2026!',
  'marketing@hali.mv': 'Marketing2026!',
};

const SEED_FILE = path.resolve(process.cwd(), 'data', 'seed.json');

const MIN_PASSWORD_LENGTH = 8;

const ORDER_CHANNELS: Order['channel'][] = ['instagram', 'viber', 'whatsapp', 'sms', 'direct', 'other'];

/** Accept only plain http(s) links for map pins. */
function cleanLink(value?: string): string | undefined {
  const v = (value || '').trim();
  return /^https?:\/\/\S+$/i.test(v) ? v.slice(0, 500) : undefined;
}
const PAYMENT_METHODS: Order['payment_method'][] = ['bank_transfer', 'cash'];

/**
 * Allowed order lifecycle moves. Failed, cancelled and returned orders keep their stock
 * deducted until staff confirm the goods are physically back (return-to-stock action).
 */
const ORDER_STAGE_TRANSITIONS: Record<Order['stage'], Order['stage'][]> = {
  new: ['packed', 'handed_over', 'cancelled'],
  packed: ['new', 'handed_over', 'cancelled'],
  handed_over: ['delivered', 'failed', 'returned', 'cancelled'],
  failed: ['handed_over', 'returned', 'cancelled'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
};

const ALL_ROLES: StaffRole[] = ['owner', 'sales', 'inventory', 'marketing'];
/** Roles a person may ask for themselves; owner access is only ever granted by an owner. */
const SELF_SERVICE_ROLES: StaffRole[] = ['sales', 'inventory', 'marketing'];

function assertPasswordStrength(password: string) {
  if (!password || password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
}

export interface AuthSettings {
  allow_open_registration: boolean;
  default_role: StaffRole;
  session_duration_days: number;
}

/** Shop details printed on invoices. */
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

const DEFAULT_SHOP_PROFILE: ShopProfile = {
  name: 'Hali e-shop',
  tagline: '',
  phone: '',
  email: '',
  instagram: '',
  address: 'Malé, Maldives',
  gst_tin: '',
  invoice_note: 'Thank you for shopping with us!',
  bank_details: '',
};

export interface PasswordResetCode {
  email: string;
  code: string;
  expires_at: string;
}

interface DatabaseSchema {
  staff_profiles: StaffProfile[];
  categories: Category[];
  suppliers: Supplier[];
  delivery_services: DeliveryService[];
  products: Product[];
  purchase_batches: PurchaseBatch[];
  stock_movements: StockMovement[];
  buyers: Buyer[];
  orders: Order[];
  order_items: OrderItem[];
  delivery_handovers: DeliveryHandover[];
  payments: PaymentRecord[];
  social_posts: SocialPost[];
  user_credentials?: Record<string, UserCredential>;
  auth_sessions?: AuthSessionRecord[];
  auth_settings?: AuthSettings;
  password_reset_codes?: PasswordResetCode[];
  shop_profile?: ShopProfile;
  ai_photo_log?: AiPhotoLogEntry[];
}

/** One AI studio photo run, kept for the daily limit and to see who used it. */
export interface AiPhotoLogEntry {
  id: string;
  staff_id: string;
  staff_name: string;
  product_name: string;
  model: string;
  photos_requested: number;
  photos_made: number;
  status: 'running' | 'done' | 'failed';
  created_at: string;
  finished_at?: string;
}

/** Calendar day in the Maldives (UTC+5), used for the daily AI photo limit. */
function maldivesDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  allow_open_registration: false,
  default_role: 'sales',
  session_duration_days: 7,
};

class DatabaseEngine {
  private data: DatabaseSchema;
  private version = 0;
  private loaded = false;
  private readonly store: StateStore<DatabaseSchema> = createStateStore<DatabaseSchema>();

  constructor() {
    this.data = this.getInitialData();
  }

  public get storageBackend(): string {
    return this.store.name;
  }

  /**
   * Brings the in-memory state up to date with the persistent store.
   * Must run before every API request (serverless instances may be stale).
   */
  public async sync(): Promise<void> {
    if (this.loaded) {
      const remoteVersion = await this.store.peekVersion();
      if (remoteVersion === this.version) return;
    }
    const snapshot = await this.store.load();
    if (snapshot) {
      this.data = this.normalize(snapshot.data);
      this.version = snapshot.version;
    } else {
      this.data = this.getInitialData();
      this.version = await this.store.save(this.data, 0);
    }
    this.loaded = true;
  }

  private getDefaultDeliveryServices(): DeliveryService[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'del-redbox',
        name: 'RedBox Delivery',
        phone: '+960 3010101',
        default_rate: 30,
        service_type: 'courier_company',
        coverage_area: "Malé & Hulhumalé (Phase 1 & 2)",
        notes: "Same-day doorstep delivery service. Standard city courier.",
        is_active: true,
        created_at: now,
      },
      {
        id: 'del-male-fast',
        name: 'Malé Fast Courier',
        phone: '+960 7891234',
        default_rate: 25,
        service_type: 'independent_rider',
        coverage_area: "Malé City Only",
        notes: "Motorbike express courier for fast urgent drop-offs.",
        is_active: true,
        created_at: now,
      },
      {
        id: 'del-island-ferry',
        name: 'Island Ferry & Cargo Boat Agent',
        phone: '+960 7654321',
        default_rate: 40,
        service_type: 'courier_company',
        coverage_area: "North Harbour, T-Jetty & Atoll Boats",
        notes: "Direct delivery & captain handover to atoll speedboats and ferries.",
        is_active: true,
        created_at: now,
      },
      {
        id: 'del-inhouse',
        name: 'In-House Shop Rider',
        phone: '+960 7771234',
        default_rate: 20,
        service_type: 'in_house',
        coverage_area: "Henveiru, Galolhu, Maafannu, Machangoalhi",
        notes: "Direct shop staff delivery for nearby VIP customers.",
        is_active: true,
        created_at: now,
      },
    ];
  }

  private getEmptyData(): DatabaseSchema {
    const now = new Date().toISOString();
    return {
      // Demo accounts exist only in local development; production starts with just the primary owner
      staff_profiles: IS_PRODUCTION
        ? []
        : [
            { id: 'staff-owner-1', email: 'owner@hali.mv', full_name: 'Mariyam (Owner / Director)', role: 'owner', phone: '+960 7771234', is_active: true, approval_status: 'approved', created_at: now },
            { id: 'staff-sales-1', email: 'sales@hali.mv', full_name: 'Ahmed (Sales Associate)', role: 'sales', phone: '+960 7984321', is_active: true, approval_status: 'approved', created_at: now },
            { id: 'staff-inv-1', email: 'inventory@hali.mv', full_name: 'Ibrahim (Inventory Lead)', role: 'inventory', phone: '+960 7654321', is_active: true, approval_status: 'approved', created_at: now },
            { id: 'staff-mkt-1', email: 'marketing@hali.mv', full_name: 'Fathimath (Marketing Specialist)', role: 'marketing', phone: '+960 7432109', is_active: true, approval_status: 'approved', created_at: now },
          ],
      categories: [],
      suppliers: [],
      delivery_services: this.getDefaultDeliveryServices(),
      products: [],
      purchase_batches: [],
      stock_movements: [],
      buyers: [],
      orders: [],
      order_items: [],
      delivery_handovers: [],
      payments: [],
      social_posts: [],
      user_credentials: {},
      auth_sessions: [],
      auth_settings: { ...DEFAULT_AUTH_SETTINGS },
      password_reset_codes: [],
      ai_photo_log: [],
    };
  }

  /**
   * Initial data for an empty store: a blank shop, or the catalog in data/seed.json
   * when HALI_IMPORT_SEED=true (used once to bring over data from the old system).
   */
  private getInitialData(): DatabaseSchema {
    let base = this.getEmptyData();
    try {
      if (process.env.HALI_IMPORT_SEED === 'true' && fs.existsSync(SEED_FILE)) {
        const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
        // Never import credentials or sessions from a seed file
        delete seed.user_credentials;
        delete seed.auth_sessions;
        delete seed.password_reset_codes;
        base = { ...base, ...seed };
      }
    } catch (err) {
      console.error('[DB] Could not read seed file, starting with an empty shop:', err);
    }
    return this.normalize(base);
  }

  private normalize(parsed: Partial<DatabaseSchema>): DatabaseSchema {
    const empty = this.getEmptyData();
    const merged: DatabaseSchema = {
      ...empty,
      ...parsed,
      delivery_services:
        parsed.delivery_services && parsed.delivery_services.length > 0
          ? parsed.delivery_services
          : empty.delivery_services,
      user_credentials: parsed.user_credentials || {},
      auth_sessions: parsed.auth_sessions || [],
      auth_settings: { ...DEFAULT_AUTH_SETTINGS, ...(parsed.auth_settings || {}) },
      password_reset_codes: parsed.password_reset_codes || [],
      ai_photo_log: parsed.ai_photo_log || [],
    } as DatabaseSchema;
    this.ensureBootstrapAccounts(merged);
    return merged;
  }

  private ensureBootstrapAccounts(schema: DatabaseSchema) {
    const credentials = (schema.user_credentials ||= {});
    const now = new Date().toISOString();

    // The primary owner always exists, is active and keeps the owner role.
    let primary = schema.staff_profiles.find(s => s.email.toLowerCase() === PRIMARY_OWNER_EMAIL);
    if (!primary) {
      primary = {
        id: 'staff-owner-primary',
        email: PRIMARY_OWNER_EMAIL,
        full_name: 'Owner / Admin',
        role: 'owner',
        phone: '',
        is_active: true,
        approval_status: 'approved',
        created_at: now,
      };
      schema.staff_profiles.unshift(primary);
    }
    primary.is_active = true;
    primary.approval_status = 'approved';
    primary.role = 'owner';

    const setInitialPassword = (staffId: string, email: string, password: string) => {
      if (credentials[staffId]) return;
      const salt = generateSalt();
      credentials[staffId] = { staff_id: staffId, email, password_hash: hashPassword(password, salt), salt, updated_at: now };
    };

    if (process.env.HALI_OWNER_PASSWORD) {
      setInitialPassword(primary.id, primary.email, process.env.HALI_OWNER_PASSWORD);
    }

    if (!IS_PRODUCTION) {
      for (const [email, password] of Object.entries(DEV_DEMO_PASSWORDS)) {
        const staff = schema.staff_profiles.find(s => s.email.toLowerCase() === email);
        if (staff) setInitialPassword(staff.id, staff.email, password);
      }
    }
  }

  /** Saves the current state. On any failure the in-memory state is discarded and reloaded on next sync. */
  private async persist(): Promise<void> {
    try {
      this.version = await this.store.save(this.data, this.version);
    } catch (err) {
      this.loaded = false;
      this.version = -1;
      throw err;
    }
  }

  // =========================================================================
  // SAMPLE INVENTORY LOADER (Exact figures from instructions)
  // =========================================================================
  public async loadSampleInventory(): Promise<{ message: string; success: boolean }> {
    // Check if sample products already exist
    const hasSamples = this.data.products.some(p =>
      ['HALI-PRF-BONITA', 'HALI-PRF-MOON', 'HALI-CSM-NIV50'].includes(p.sku)
    );
    if (hasSamples) {
      return { message: 'Sample inventory is already loaded in the database.', success: false };
    }

    const now = new Date().toISOString();
    const ownerId = this.data.staff_profiles.find(s => s.role === 'owner')?.id || 'staff-owner-1';

    // 1. Supplier: Poise Perfume (Leave unknown contact details blank for the owner to fill in)
    const supplierId = 'supp-poise-perfume';
    let supplier = this.data.suppliers.find(s => s.name.toLowerCase() === 'poise perfume');
    if (!supplier) {
      supplier = {
        id: supplierId,
        name: 'Poise Perfume',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        instagram_or_website: '',
        payment_details: '',
        notes: 'Wholesale perfume & cosmetics supplier. Blank contact details for owner to complete.',
        created_at: now,
      };
      this.data.suppliers.push(supplier);
    }

    // 2. Categories: Perfumes & Cosmetics
    let catPerfumes = this.data.categories.find(c => c.name.toLowerCase() === 'perfumes');
    if (!catPerfumes) {
      catPerfumes = {
        id: 'cat-perfumes',
        name: 'Perfumes',
        description: 'Authentic imported designer fragrances and perfumes',
        created_at: now,
      };
      this.data.categories.push(catPerfumes);
    }

    let catCosmetics = this.data.categories.find(c => c.name.toLowerCase() === 'cosmetics');
    if (!catCosmetics) {
      catCosmetics = {
        id: 'cat-cosmetics',
        name: 'Cosmetics',
        description: 'Everyday skin care, lotions, and beauty cosmetics',
        created_at: now,
      };
      this.data.categories.push(catCosmetics);
    }

    // 3. Products
    // Bonita perfume: 12 purchased @ MVR 650, 3 sold previously -> 9 available
    // 7.14% markup on cost: 650 * 1.0714 = 696.41
    const prodBonitaId = 'prod-bonita-perfume';
    const prodBonita: Product = {
      id: prodBonitaId,
      name: 'Bonita perfume',
      sku: 'HALI-PRF-BONITA',
      category_id: catPerfumes.id,
      supplier_id: supplier.id,
      description: 'Elegant luxury eau de parfum with amber and floral notes.',
      images: [
        { id: 'img-bon-1', url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80', is_primary: true }
      ],
      wholesale_unit_cost: 650.00,
      pricing_rule: 'markup_on_cost',
      pricing_rule_percentage: 7.14,
      suggested_price: 696.41,
      actual_listed_price: 696.41,
      low_stock_threshold: 5,
      is_active: true,
      available_stock: 9,
      created_at: now,
    };

    // Moonlight perfume: 12 purchased @ MVR 650, 3 sold previously -> 9 available
    // 7.14% markup on cost: 650 * 1.0714 = 696.41
    const prodMoonlightId = 'prod-moonlight-perfume';
    const prodMoonlight: Product = {
      id: prodMoonlightId,
      name: 'Moonlight perfume',
      sku: 'HALI-PRF-MOON',
      category_id: catPerfumes.id,
      supplier_id: supplier.id,
      description: 'Sophisticated evening fragrance with midnight musk and crisp citrus undertones.',
      images: [
        { id: 'img-moon-1', url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80', is_primary: true }
      ],
      wholesale_unit_cost: 650.00,
      pricing_rule: 'markup_on_cost',
      pricing_rule_percentage: 7.14,
      suggested_price: 696.41,
      actual_listed_price: 696.41,
      low_stock_threshold: 5,
      is_active: true,
      available_stock: 9,
      created_at: now,
    };

    // Nivea lotion 50 ml: 12 purchased @ MVR 40, 6 sold previously -> 6 available
    // 7.14% markup on cost: 40 * 1.0714 = 42.856 -> 42.86
    const prodNiveaId = 'prod-nivea-lotion-50ml';
    const prodNivea: Product = {
      id: prodNiveaId,
      name: 'Nivea lotion 50 ml',
      sku: 'HALI-CSM-NIV50',
      category_id: catCosmetics.id,
      supplier_id: supplier.id,
      description: 'Nourishing daily skin moisturizer in a compact 50ml bottle.',
      images: [
        { id: 'img-niv-1', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80', is_primary: true }
      ],
      wholesale_unit_cost: 40.00,
      pricing_rule: 'markup_on_cost',
      pricing_rule_percentage: 7.14,
      suggested_price: 42.86,
      actual_listed_price: 42.86,
      low_stock_threshold: 5,
      is_active: true,
      available_stock: 6,
      created_at: now,
    };

    this.data.products.push(prodBonita, prodMoonlight, prodNivea);

    // 4. Purchase Batches
    const batchBonita: PurchaseBatch = {
      id: 'batch-bon-01',
      product_id: prodBonitaId,
      batch_number: 'BATCH-BON-01',
      purchase_date: '2026-09-01',
      quantity: 12,
      unit_cost: 650.00,
      shipping_cost: 0,
      other_costs: 0,
      supplier_id: supplier.id,
      notes: 'Initial wholesale purchase batch from Poise Perfume',
      created_at: now,
    };
    const batchMoonlight: PurchaseBatch = {
      id: 'batch-moon-01',
      product_id: prodMoonlightId,
      batch_number: 'BATCH-MOON-01',
      purchase_date: '2026-09-01',
      quantity: 12,
      unit_cost: 650.00,
      shipping_cost: 0,
      other_costs: 0,
      supplier_id: supplier.id,
      notes: 'Initial wholesale purchase batch from Poise Perfume',
      created_at: now,
    };
    const batchNivea: PurchaseBatch = {
      id: 'batch-niv-01',
      product_id: prodNiveaId,
      batch_number: 'BATCH-NIV-01',
      purchase_date: '2026-09-01',
      quantity: 12,
      unit_cost: 40.00,
      shipping_cost: 0,
      other_costs: 0,
      supplier_id: supplier.id,
      notes: 'Initial wholesale purchase batch from Poise Perfume',
      created_at: now,
    };
    this.data.purchase_batches.push(batchBonita, batchMoonlight, batchNivea);

    // 5. Immutable Stock Movements
    // Bonita: 12 received, 3 sold prior opening -> 9 balance
    this.data.stock_movements.push(
      {
        id: crypto.randomUUID(),
        product_id: prodBonitaId,
        movement_type: 'received',
        quantity_delta: 12,
        resulting_stock: 12,
        reference_type: 'purchase_batch',
        reference_id: 'BATCH-BON-01',
        notes: 'Initial stock received from Poise Perfume (12 units)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-01T10:00:00Z',
      },
      {
        id: crypto.randomUUID(),
        product_id: prodBonitaId,
        movement_type: 'sold',
        quantity_delta: -3,
        resulting_stock: 9,
        reference_type: 'historical_opening',
        reference_id: 'HISTORICAL-ADJUST',
        notes: 'Opening inventory adjustment: 3 units sold prior to system launch (excluded from sales analytics)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-05T10:00:00Z',
      }
    );

    // Moonlight: 12 received, 3 sold prior opening -> 9 balance
    this.data.stock_movements.push(
      {
        id: crypto.randomUUID(),
        product_id: prodMoonlightId,
        movement_type: 'received',
        quantity_delta: 12,
        resulting_stock: 12,
        reference_type: 'purchase_batch',
        reference_id: 'BATCH-MOON-01',
        notes: 'Initial stock received from Poise Perfume (12 units)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-01T10:00:00Z',
      },
      {
        id: crypto.randomUUID(),
        product_id: prodMoonlightId,
        movement_type: 'sold',
        quantity_delta: -3,
        resulting_stock: 9,
        reference_type: 'historical_opening',
        reference_id: 'HISTORICAL-ADJUST',
        notes: 'Opening inventory adjustment: 3 units sold prior to system launch (excluded from sales analytics)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-05T10:00:00Z',
      }
    );

    // Nivea lotion: 12 received, 6 sold prior opening -> 6 balance
    this.data.stock_movements.push(
      {
        id: crypto.randomUUID(),
        product_id: prodNiveaId,
        movement_type: 'received',
        quantity_delta: 12,
        resulting_stock: 12,
        reference_type: 'purchase_batch',
        reference_id: 'BATCH-NIV-01',
        notes: 'Initial stock received from Poise Perfume (12 units)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-01T10:00:00Z',
      },
      {
        id: crypto.randomUUID(),
        product_id: prodNiveaId,
        movement_type: 'sold',
        quantity_delta: -6,
        resulting_stock: 6,
        reference_type: 'historical_opening',
        reference_id: 'HISTORICAL-ADJUST',
        notes: 'Opening inventory adjustment: 6 units sold prior to system launch (excluded from sales analytics)',
        performed_by_staff_id: ownerId,
        created_at: '2026-09-05T10:00:00Z',
      }
    );

    // 6. Social Media Posts: blank caption, image, and URL for owner to fill in
    this.data.social_posts.push(
      {
        id: crypto.randomUUID(),
        product_id: prodBonitaId,
        platform: 'instagram',
        caption: '',
        image_url: '',
        planned_date: '2026-09-28',
        status: 'draft',
        published_url: '',
        notes: 'Ready for owner to input Instagram copy, product photography, and story link.',
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        product_id: prodMoonlightId,
        platform: 'instagram',
        caption: '',
        image_url: '',
        planned_date: '2026-09-29',
        status: 'draft',
        published_url: '',
        notes: 'Ready for owner to input Instagram copy, product photography, and story link.',
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        product_id: prodNiveaId,
        platform: 'instagram',
        caption: '',
        image_url: '',
        planned_date: '2026-09-30',
        status: 'draft',
        published_url: '',
        notes: 'Ready for owner to input Instagram copy, product photography, and story link.',
        created_at: now,
      }
    );

    await this.persist();
    return {
      message: 'Sample inventory loaded successfully with real figures (Poise Perfume, Bonita, Moonlight, Nivea 50ml).',
      success: true,
    };
  }

  // =========================================================================
  // METRICS & DASHBOARD
  // =========================================================================
  public getDashboardMetrics(role: StaffRole): DashboardMetrics {
    const isOwner = role === 'owner';

    // Recorded sales only come from real customer orders. Cancelled, failed and returned orders
    // are excluded; historical opening stock adjustments have no order and never count.
    const countedOrders = this.data.orders.filter(o => !['cancelled', 'failed', 'returned'].includes(o.stage));
    const countedOrderIds = new Set(countedOrders.map(o => o.id));

    const recordedSales = countedOrders.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0);
    const inProgressCount = this.data.orders.filter(o => ['new', 'packed', 'handed_over'].includes(o.stage)).length;
    const pendingDeliveryCount = this.data.orders.filter(o => o.stage === 'handed_over').length;

    const activeProducts = this.data.products.filter(p => p.is_active);
    const availableStockCount = activeProducts.reduce((sum, p) => sum + (p.available_stock || 0), 0);
    const lowStockCount = activeProducts.filter(p => p.available_stock <= p.low_stock_threshold).length;

    // Gross profit = Σ (selling price − captured unit cost) × qty. Delivery fees are kept out
    // of product margins entirely.
    let estimatedGrossProfit = 0;
    if (isOwner) {
      for (const item of this.data.order_items) {
        if (countedOrderIds.has(item.order_id)) {
          estimatedGrossProfit += (item.line_total || 0) - (item.line_cost || 0);
        }
      }
    }

    return {
      // Sales staff don't see shop-wide revenue
      recorded_sales_revenue: role === 'sales' ? 0 : Number(recordedSales.toFixed(2)),
      orders_in_progress: inProgressCount,
      available_stock_count: availableStockCount,
      low_stock_count: lowStockCount,
      estimated_gross_profit: isOwner ? Number(estimatedGrossProfit.toFixed(2)) : 0,
      total_orders_count: this.data.orders.length,
      pending_delivery_count: pendingDeliveryCount,
      profit_calculation_note:
        'Gross profit = Σ(selling price − captured unit cost) across recorded customer orders. Delivery fees are excluded from product margins; cancelled, failed and returned orders and historical opening stock adjustments are not counted.',
      is_owner: isOwner,
    };
  }

  // =========================================================================
  // AUTHENTICATION & CREDENTIALS
  // =========================================================================
  private assertCanSignIn(staff: StaffProfile) {
    if (staff.approval_status === 'pending') {
      throw new Error('Your account request is waiting for the owner to approve it.');
    }
    if (staff.approval_status === 'rejected') {
      throw new Error('Your account access request has been declined.');
    }
    if (!staff.is_active) {
      throw new Error('Your account has been deactivated. Please contact the shop owner.');
    }
  }

  private createSession(staff: StaffProfile): { token: string; staff: StaffProfile; expires_at: string } {
    const sessions = (this.data.auth_sessions ||= []);
    const nowTime = Date.now();
    const durationDays = this.getAuthSettings().session_duration_days || 7;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(nowTime + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // Prune expired sessions while we are here
    this.data.auth_sessions = sessions.filter(s => new Date(s.expires_at).getTime() > nowTime);
    this.data.auth_sessions.push({
      token,
      staff_id: staff.id,
      role: staff.role,
      created_at: new Date(nowTime).toISOString(),
      expires_at: expiresAt,
    });
    return { token, staff: { ...staff }, expires_at: expiresAt };
  }

  private revokeSessionsFor(staffId: string) {
    this.data.auth_sessions = (this.data.auth_sessions || []).filter(s => s.staff_id !== staffId);
  }

  public async authenticate(email: string, password: string): Promise<{ token: string; staff: StaffProfile; expires_at: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }

    const staff = this.data.staff_profiles.find(s => s.email.toLowerCase() === cleanEmail);
    const creds = staff ? this.data.user_credentials?.[staff.id] : undefined;
    if (!staff || !creds || !verifyPassword(password, creds.salt, creds.password_hash)) {
      throw new Error('Invalid email or password.');
    }
    this.assertCanSignIn(staff);

    const session = this.createSession(staff);
    await this.persist();
    return session;
  }

  /** Resolves a shop session token issued by authenticate(). */
  public verifySession(token: string): { staff: StaffProfile; role: StaffRole } | null {
    if (!token || !this.data.auth_sessions) return null;

    const session = this.data.auth_sessions.find(s => s.token === token);
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;

    const staff = this.data.staff_profiles.find(s => s.id === session.staff_id);
    if (!staff || !staff.is_active || staff.approval_status === 'pending' || staff.approval_status === 'rejected') {
      return null;
    }
    // Role always comes from the current staff profile, never from the session or the client
    return { staff: { ...staff }, role: staff.role };
  }

  /**
   * Maps an identity verified by Supabase Auth to a staff profile.
   * A first-time sign-in creates an access request the owner has to approve
   * (unless open registration is on). Roles are never taken from the identity provider.
   */
  /** Creates a profile for a first-time Supabase sign-in. Returns it only when newly created. */
  public async ensureExternalProfile(identity: { email: string; full_name?: string; phone?: string; requested_role?: string }): Promise<StaffProfile | null> {
    const email = identity.email.trim().toLowerCase();
    if (this.data.staff_profiles.some(s => s.email.toLowerCase() === email)) return null;
    const staff = this.buildRegistration({
      full_name: identity.full_name || email.split('@')[0],
      email,
      phone: identity.phone,
      role: identity.requested_role as StaffRole | undefined,
    });
    this.data.staff_profiles.push(staff);
    await this.persist();
    return { ...staff };
  }

  public async resolveExternalIdentity(identity: {
    email: string;
    full_name?: string;
    phone?: string;
    requested_role?: string;
  }): Promise<{ staff: StaffProfile; role: StaffRole }> {
    const email = identity.email.trim().toLowerCase();
    let staff = this.data.staff_profiles.find(s => s.email.toLowerCase() === email);

    if (!staff) {
      staff = this.buildRegistration({
        full_name: identity.full_name || email.split('@')[0],
        email,
        phone: identity.phone,
        role: identity.requested_role as StaffRole | undefined,
      });
      this.data.staff_profiles.push(staff);
      await this.persist();
    }

    this.assertCanSignIn(staff);
    return { staff: { ...staff }, role: staff.role };
  }

  public async revokeSession(token: string): Promise<boolean> {
    if (!token || !this.data.auth_sessions) return false;
    const initialLen = this.data.auth_sessions.length;
    this.data.auth_sessions = this.data.auth_sessions.filter(s => s.token !== token);
    if (this.data.auth_sessions.length !== initialLen) {
      await this.persist();
      return true;
    }
    return false;
  }

  public hasLocalPassword(staffId: string): boolean {
    return Boolean(this.data.user_credentials?.[staffId]);
  }

  private setPassword(staff: StaffProfile, password: string) {
    const salt = generateSalt();
    (this.data.user_credentials ||= {})[staff.id] = {
      staff_id: staff.id,
      email: staff.email,
      password_hash: hashPassword(password, salt),
      salt,
      updated_at: new Date().toISOString(),
    };
  }

  public async changePassword(staffId: string, oldPass: string, newPass: string): Promise<boolean> {
    assertPasswordStrength(newPass);
    const staff = this.data.staff_profiles.find(s => s.id === staffId);
    if (!staff) throw new Error('Staff member not found.');

    const creds = this.data.user_credentials?.[staffId];
    // Accounts that only ever signed in through Supabase may set a first shop password
    if (creds && !verifyPassword(oldPass || '', creds.salt, creds.password_hash)) {
      throw new Error('Current password is incorrect.');
    }

    this.setPassword(staff, newPass);
    await this.persist();
    return true;
  }

  public async resetStaffPassword(staffId: string, newPass: string, requesterRole: StaffRole): Promise<boolean> {
    if (requesterRole !== 'owner') {
      throw new Error('Only the owner can reset staff passwords.');
    }
    assertPasswordStrength(newPass);

    const staff = this.data.staff_profiles.find(s => s.id === staffId);
    if (!staff) throw new Error('Staff member not found.');

    this.setPassword(staff, newPass);
    // Force the staff member to sign in again with the new password
    this.revokeSessionsFor(staffId);
    await this.persist();
    return true;
  }

  public getAuthSettings(): AuthSettings {
    return { ...DEFAULT_AUTH_SETTINGS, ...(this.data.auth_settings || {}) };
  }

  public async updateAuthSettings(settings: Partial<AuthSettings>, requesterRole: StaffRole): Promise<AuthSettings> {
    if (requesterRole !== 'owner') {
      throw new Error('Only the owner can modify website access and security settings.');
    }
    const next = this.getAuthSettings();
    if (settings.allow_open_registration !== undefined) {
      next.allow_open_registration = Boolean(settings.allow_open_registration);
    }
    if (settings.default_role !== undefined) {
      if (!SELF_SERVICE_ROLES.includes(settings.default_role)) {
        throw new Error('Self-registered accounts cannot be given the owner role.');
      }
      next.default_role = settings.default_role;
    }
    if (settings.session_duration_days !== undefined) {
      const days = Math.round(Number(settings.session_duration_days));
      if (!Number.isFinite(days) || days < 1 || days > 90) {
        throw new Error('Session duration must be between 1 and 90 days.');
      }
      next.session_duration_days = days;
    }
    this.data.auth_settings = next;
    await this.persist();
    return { ...next };
  }

  public countActiveSessions(staffId?: string): number {
    const nowTime = Date.now();
    return (this.data.auth_sessions || []).filter(
      s => new Date(s.expires_at).getTime() > nowTime && (!staffId || s.staff_id === staffId)
    ).length;
  }

  /**
   * Builds a self-service registration. It is approved straight away only when the
   * owner turned on open registration, and it never receives the owner role
   * (except the configured primary owner email).
   */
  private buildRegistration(data: {
    full_name: string;
    email: string;
    phone?: string;
    role?: StaffRole;
    request_note?: string;
  }): StaffProfile {
    const email = data.email.trim().toLowerCase();
    const settings = this.getAuthSettings();
    const isPrimaryOwner = email === PRIMARY_OWNER_EMAIL;
    const requestedRole = data.role && SELF_SERVICE_ROLES.includes(data.role) ? data.role : settings.default_role;
    const autoApprove = isPrimaryOwner || settings.allow_open_registration;

    return {
      id: crypto.randomUUID(),
      full_name: (data.full_name || '').trim() || email.split('@')[0],
      email,
      role: isPrimaryOwner ? 'owner' : settings.allow_open_registration ? settings.default_role : requestedRole,
      phone: data.phone?.trim() || '',
      is_active: autoApprove,
      approval_status: autoApprove ? 'approved' : 'pending',
      request_note: data.request_note?.trim() || '',
      created_at: new Date().toISOString(),
    };
  }

  public async registerUser(data: {
    full_name: string;
    email: string;
    phone?: string;
    role?: StaffRole;
    password?: string;
    request_note?: string;
    auto_login?: boolean;
  }): Promise<{ staff: StaffProfile; session?: { token: string; staff: StaffProfile; expires_at: string } }> {
    const emailLower = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      throw new Error('Please enter a valid email address.');
    }
    if (this.data.staff_profiles.some(s => s.email.toLowerCase() === emailLower)) {
      throw new Error(`An account with email "${data.email.trim()}" already exists. Please sign in.`);
    }
    assertPasswordStrength(data.password || '');

    const newStaff = this.buildRegistration(data);
    this.data.staff_profiles.push(newStaff);
    this.setPassword(newStaff, data.password!);

    let session: { token: string; staff: StaffProfile; expires_at: string } | undefined;
    if (newStaff.is_active && newStaff.approval_status === 'approved' && data.auto_login !== false) {
      session = this.createSession(newStaff);
    }

    await this.persist();
    return { staff: newStaff, session };
  }

  // =========================================================================
  // STAFF PROFILES & RBAC
  // =========================================================================
  public getStaffProfiles(): StaffProfile[] {
    return this.data.staff_profiles.map(s => ({
      ...s,
      approval_status: s.approval_status || 'approved',
    }));
  }

  public getStaffById(id: string): StaffProfile | undefined {
    return this.data.staff_profiles.find(s => s.id === id);
  }

  public async inviteStaff(staff: Omit<StaffProfile, 'id' | 'created_at'> & { password?: string }): Promise<StaffProfile> {
    const email = (staff.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    if (!staff.full_name?.trim()) throw new Error('Full name is required.');
    if (!ALL_ROLES.includes(staff.role)) throw new Error('Please choose a valid role.');
    if (this.data.staff_profiles.some(s => s.email.toLowerCase() === email)) {
      throw new Error(`A staff member with email "${staff.email}" already exists.`);
    }
    if (staff.password) assertPasswordStrength(staff.password);

    const newStaff: StaffProfile = {
      id: crypto.randomUUID(),
      email,
      full_name: staff.full_name.trim(),
      role: staff.role,
      phone: staff.phone?.trim() || '',
      is_active: staff.is_active !== undefined ? staff.is_active : true,
      approval_status: 'approved',
      created_at: new Date().toISOString(),
    };
    this.data.staff_profiles.push(newStaff);

    // Without an initial password the staff member signs in through Supabase Auth with this email
    if (staff.password) this.setPassword(newStaff, staff.password);

    await this.persist();
    return newStaff;
  }

  private assertNotLastActiveOwner(staff: StaffProfile) {
    if (staff.email.toLowerCase() === PRIMARY_OWNER_EMAIL) {
      throw new Error('The primary owner account cannot be deactivated or deleted.');
    }
    if (staff.role === 'owner' && staff.is_active) {
      const activeOwners = this.data.staff_profiles.filter(s => s.role === 'owner' && s.is_active);
      if (activeOwners.length <= 1) {
        throw new Error('Cannot remove the sole active owner account.');
      }
    }
  }

  public async toggleStaffActive(id: string, requesterRole: StaffRole): Promise<StaffProfile> {
    if (requesterRole !== 'owner') {
      throw new Error('Only the owner can activate or deactivate staff members.');
    }
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Staff member not found.');
    if (staff.is_active) this.assertNotLastActiveOwner(staff);

    staff.is_active = !staff.is_active;
    if (!staff.is_active) this.revokeSessionsFor(id);
    staff.updated_at = new Date().toISOString();
    await this.persist();
    return staff;
  }

  public async deactivateStaff(id: string, requesterRole: StaffRole): Promise<StaffProfile> {
    if (requesterRole !== 'owner') {
      throw new Error('Only the owner can deactivate staff members.');
    }
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Staff member not found.');
    this.assertNotLastActiveOwner(staff);

    staff.is_active = false;
    staff.updated_at = new Date().toISOString();
    this.revokeSessionsFor(id);
    await this.persist();
    return staff;
  }

  public async deleteStaff(id: string, requesterRole: StaffRole): Promise<{ success: boolean; message: string }> {
    if (requesterRole !== 'owner') {
      throw new Error('Only the owner can delete staff accounts.');
    }
    const staffIndex = this.data.staff_profiles.findIndex(s => s.id === id);
    if (staffIndex === -1) throw new Error('Staff member not found.');
    const staff = this.data.staff_profiles[staffIndex];
    this.assertNotLastActiveOwner(staff);

    this.data.staff_profiles.splice(staffIndex, 1);
    if (this.data.user_credentials) delete this.data.user_credentials[id];
    this.revokeSessionsFor(id);

    await this.persist();
    return { success: true, message: `Staff account "${staff.full_name}" (${staff.email}) was permanently deleted.` };
  }

  public async updateStaffProfile(
    id: string,
    updates: { full_name?: string; email?: string; phone?: string },
    requester: { staffId: string; role: StaffRole }
  ): Promise<StaffProfile> {
    const isOwner = requester.role === 'owner';
    if (!isOwner && requester.staffId !== id) {
      throw new Error('You can only edit your own profile.');
    }
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Staff member not found.');

    if (updates.full_name !== undefined && updates.full_name.trim()) {
      staff.full_name = updates.full_name.trim();
    }
    if (updates.email !== undefined && updates.email.trim() && updates.email.trim().toLowerCase() !== staff.email) {
      // The email links the profile to its sign-in identity, so only the owner may change it
      if (!isOwner) throw new Error('Only the owner can change a staff email address.');
      if (staff.email.toLowerCase() === PRIMARY_OWNER_EMAIL) {
        throw new Error('The primary owner email is set by the HALI_OWNER_EMAIL setting.');
      }
      const emailLower = updates.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) throw new Error('Please enter a valid email address.');
      if (this.data.staff_profiles.some(s => s.id !== id && s.email.toLowerCase() === emailLower)) {
        throw new Error(`Email "${updates.email.trim()}" is already used by another staff member.`);
      }
      staff.email = emailLower;
      const creds = this.data.user_credentials?.[id];
      if (creds) creds.email = emailLower;
    }
    if (updates.phone !== undefined) {
      staff.phone = updates.phone.trim();
    }
    staff.updated_at = new Date().toISOString();
    await this.persist();
    return staff;
  }

  public async changeStaffRole(id: string, role: StaffRole): Promise<StaffProfile> {
    if (!ALL_ROLES.includes(role)) throw new Error('Please choose a valid role.');
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Staff member not found.');
    if (staff.email.toLowerCase() === PRIMARY_OWNER_EMAIL && role !== 'owner') {
      throw new Error('The primary owner always keeps the owner role.');
    }
    if (staff.role === 'owner' && role !== 'owner') {
      const otherOwners = this.data.staff_profiles.filter(s => s.role === 'owner' && s.is_active && s.id !== id);
      if (otherOwners.length === 0) throw new Error('There must always be at least one active owner.');
    }
    staff.role = role;
    staff.updated_at = new Date().toISOString();
    await this.persist();
    return staff;
  }

  public async requestStaffAccess(data: {
    full_name: string;
    email: string;
    phone?: string;
    role: StaffRole;
    password?: string;
    request_note?: string;
  }): Promise<StaffProfile> {
    const emailLower = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) throw new Error('Please enter a valid email address.');
    const existing = this.data.staff_profiles.find(s => s.email.toLowerCase() === emailLower);
    if (existing) {
      if (existing.approval_status === 'pending') {
        throw new Error('An account request for this email is already submitted and pending admin approval.');
      }
      throw new Error(`An account with email "${data.email.trim()}" already exists. Please sign in.`);
    }
    if (data.password) assertPasswordStrength(data.password);

    const newStaff: StaffProfile = {
      id: crypto.randomUUID(),
      full_name: data.full_name.trim(),
      email: emailLower,
      role: SELF_SERVICE_ROLES.includes(data.role) ? data.role : 'sales',
      phone: data.phone?.trim() || '',
      is_active: false,
      approval_status: 'pending',
      request_note: data.request_note?.trim() || '',
      created_at: new Date().toISOString(),
    };
    this.data.staff_profiles.push(newStaff);
    if (data.password) this.setPassword(newStaff, data.password);

    await this.persist();
    return newStaff;
  }

  public async approveStaffRequest(id: string, role?: StaffRole): Promise<StaffProfile> {
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Account request not found.');
    if (role && !ALL_ROLES.includes(role)) throw new Error('Please choose a valid role.');
    staff.approval_status = 'approved';
    staff.is_active = true;
    if (role) staff.role = role;
    staff.updated_at = new Date().toISOString();
    await this.persist();
    return staff;
  }

  public async rejectStaffRequest(id: string): Promise<StaffProfile> {
    const staff = this.data.staff_profiles.find(s => s.id === id);
    if (!staff) throw new Error('Account request not found.');
    if (staff.email.toLowerCase() === PRIMARY_OWNER_EMAIL) {
      throw new Error('The primary owner account cannot be rejected.');
    }
    staff.approval_status = 'rejected';
    staff.is_active = false;
    this.revokeSessionsFor(id);
    staff.updated_at = new Date().toISOString();
    await this.persist();
    return staff;
  }

  // =========================================================================
  // SHOP PROFILE (invoice details)
  // =========================================================================
  public getShopProfile(): ShopProfile {
    return { ...DEFAULT_SHOP_PROFILE, ...(this.data.shop_profile || {}) };
  }

  public async updateShopProfile(updates: Partial<ShopProfile>): Promise<ShopProfile> {
    const next = this.getShopProfile();
    for (const key of Object.keys(DEFAULT_SHOP_PROFILE) as Array<keyof ShopProfile>) {
      if (updates[key] !== undefined) next[key] = String(updates[key]).trim().slice(0, 500);
    }
    if (!next.name) throw new Error('Shop name is required.');
    this.data.shop_profile = next;
    await this.persist();
    return next;
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================
  public getCategories(): Category[] {
    return this.data.categories;
  }

  public async createCategory(name: string, description?: string): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    const exists = this.data.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) throw new Error(`Category "${trimmed}" already exists.`);

    const cat: Category = {
      id: crypto.randomUUID(),
      name: trimmed,
      description: description?.trim() || '',
      created_at: new Date().toISOString(),
    };
    this.data.categories.push(cat);
    await this.persist();
    return cat;
  }

  public async updateCategory(id: string, updates: { name?: string; description?: string }): Promise<Category> {
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found.');
    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) throw new Error('Category name is required.');
      if (this.data.categories.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`Category "${name}" already exists.`);
      }
      cat.name = name;
    }
    if (updates.description !== undefined) cat.description = updates.description.trim();
    await this.persist();
    return cat;
  }

  public async deleteCategory(id: string): Promise<void> {
    const inUse = this.data.products.filter(p => p.category_id === id).length;
    if (inUse > 0) throw new Error(`This category still has ${inUse} product${inUse === 1 ? '' : 's'}. Move them first.`);
    const before = this.data.categories.length;
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    if (this.data.categories.length === before) throw new Error('Category not found.');
    await this.persist();
  }

  // =========================================================================
  // SUPPLIERS
  // =========================================================================
  public getSuppliers(role: StaffRole = 'owner'): Supplier[] {
    // Supplier payment details are only for the people who pay suppliers
    if (role === 'owner' || role === 'inventory') return this.data.suppliers;
    return this.data.suppliers.map(s => ({ ...s, payment_details: '' }));
  }

  public async createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
    if (!(supplier.name || '').trim()) throw new Error('Supplier name is required.');
    const newSupp: Supplier = {
      ...supplier,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.data.suppliers.push(newSupp);
    await this.persist();
    return newSupp;
  }

  public async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const index = this.data.suppliers.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Supplier not found.');
    const updated = {
      ...this.data.suppliers[index],
      ...updates,
      id: this.data.suppliers[index].id,
      created_at: this.data.suppliers[index].created_at,
    };
    this.data.suppliers[index] = updated;
    await this.persist();
    return updated;
  }

  // =========================================================================
  // DELIVERY & COURIER SERVICES
  // =========================================================================
  public getDeliveryServices(): DeliveryService[] {
    return this.data.delivery_services || [];
  }

  public async createDeliveryService(
    service: Omit<DeliveryService, 'id' | 'created_at'>
  ): Promise<DeliveryService> {
    if (!service.name?.trim()) throw new Error('Courier or delivery service name is required.');
    if (!service.phone?.trim()) throw new Error('Contact phone number is required.');
    const rate = Number(service.default_rate);
    if (isNaN(rate) || rate < 0) throw new Error('A valid delivery rate (MVR) is required.');

    const newService: DeliveryService = {
      ...service,
      name: service.name.trim(),
      phone: service.phone.trim(),
      default_rate: rate,
      service_type: service.service_type || 'courier_company',
      coverage_area: service.coverage_area?.trim() || '',
      notes: service.notes?.trim() || '',
      is_active: service.is_active !== undefined ? service.is_active : true,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (!this.data.delivery_services) {
      this.data.delivery_services = [];
    }
    this.data.delivery_services.push(newService);
    await this.persist();
    return newService;
  }

  public async updateDeliveryService(
    id: string,
    updates: Partial<DeliveryService>
  ): Promise<DeliveryService> {
    if (!this.data.delivery_services) this.data.delivery_services = [];
    const index = this.data.delivery_services.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Delivery service not found.');

    const updated: DeliveryService = {
      ...this.data.delivery_services[index],
      ...updates,
      id: this.data.delivery_services[index].id,
      updated_at: new Date().toISOString(),
    };
    if (updates.default_rate !== undefined) {
      const rate = Number(updates.default_rate);
      if (isNaN(rate) || rate < 0) throw new Error('Delivery rate must be a valid positive number.');
      updated.default_rate = rate;
    }
    this.data.delivery_services[index] = updated;
    await this.persist();
    return updated;
  }

  public async deleteDeliveryService(id: string): Promise<void> {
    if (!this.data.delivery_services) return;
    this.data.delivery_services = this.data.delivery_services.filter(d => d.id !== id);
    await this.persist();
  }

  // =========================================================================
  // PRODUCTS & PRICING
  // =========================================================================
  public getProducts(role: StaffRole): Product[] {
    const isOwner = role === 'owner';
    return this.data.products.map(p => {
      const cat = this.data.categories.find(c => c.id === p.category_id);
      const supp = this.data.suppliers.find(s => s.id === p.supplier_id);
      return {
        ...p,
        category_name: cat?.name || 'Uncategorized',
        supplier_name: supp?.name || 'Unknown Supplier',
        // Redact wholesale cost and the pricing percentage (price ÷ markup would reveal the cost)
        wholesale_unit_cost: isOwner ? p.wholesale_unit_cost : 0,
        pricing_rule_percentage: isOwner ? p.pricing_rule_percentage : 0,
      };
    });
  }

  public getProductById(id: string, role: StaffRole): Product | undefined {
    const p = this.data.products.find(prod => prod.id === id);
    if (!p) return undefined;
    const cat = this.data.categories.find(c => c.id === p.category_id);
    const supp = this.data.suppliers.find(s => s.id === p.supplier_id);
    const isOwner = role === 'owner';
    return {
      ...p,
      category_name: cat?.name,
      supplier_name: supp?.name,
      wholesale_unit_cost: isOwner ? p.wholesale_unit_cost : 0,
      pricing_rule_percentage: isOwner ? p.pricing_rule_percentage : 0,
    };
  }

  /** Next running SKU in the H0001 format (continues after the highest existing H-number). */
  public nextSku(): string {
    const highest = this.data.products.reduce((max, p) => {
      const m = /^H(\d+)$/i.exec(p.sku || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return `H${String(highest + 1).padStart(4, '0')}`;
  }

  public async createProduct(
    product: Omit<Product, 'id' | 'created_at' | 'available_stock'>,
    openingStock: number,
    staffId: string
  ): Promise<Product> {
    if (!(product.name || '').trim()) throw new Error('Product name is required.');
    // SKUs are always assigned by the server as a running number: H0001, H0002, …
    product = { ...product, sku: this.nextSku() };
    if (!(Number(product.wholesale_unit_cost) >= 0) || !(Number(product.actual_listed_price) >= 0)) {
      throw new Error('Costs and prices must be zero or more.');
    }
    if (openingStock !== undefined && openingStock !== null && (!Number.isInteger(Number(openingStock)) || Number(openingStock) < 0)) {
      throw new Error('Opening stock must be a whole number of units (zero or more).');
    }

    const now = new Date().toISOString();
    const productId = crypto.randomUUID();
    const initialStock = Math.max(0, openingStock || 0);

    const newProd: Product = {
      ...product,
      name: product.name.trim(),
      sku: product.sku.trim(),
      wholesale_unit_cost: Number(product.wholesale_unit_cost) || 0,
      actual_listed_price: Number(product.actual_listed_price) || 0,
      is_active: product.is_active !== false,
      id: productId,
      available_stock: initialStock,
      created_at: now,
    };
    this.data.products.push(newProd);

    // If opening stock provided, record batch and movement
    if (initialStock > 0) {
      const batchId = `BATCH-${newProd.sku.replace(/[^a-zA-Z0-9]/g, '')}-01`;
      this.data.purchase_batches.push({
        id: crypto.randomUUID(),
        product_id: productId,
        batch_number: batchId,
        purchase_date: now.split('T')[0],
        quantity: initialStock,
        unit_cost: product.wholesale_unit_cost,
        shipping_cost: 0,
        other_costs: 0,
        supplier_id: product.supplier_id,
        notes: 'Initial inventory receipt',
        created_at: now,
      });

      this.data.stock_movements.push({
        id: crypto.randomUUID(),
        product_id: productId,
        movement_type: 'received',
        quantity_delta: initialStock,
        resulting_stock: initialStock,
        reference_type: 'purchase_batch',
        reference_id: batchId,
        notes: `Initial stock receipt of ${initialStock} units`,
        performed_by_staff_id: staffId,
        created_at: now,
      });
    }

    await this.persist();
    return newProd;
  }

  public async updateProduct(id: string, updates: Partial<Product>, role: StaffRole): Promise<Product> {
    const index = this.data.products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Product not found.');

    const current = this.data.products[index];
    updates = { ...updates };
    // Stock only changes through the immutable ledger (batches, orders, returns, corrections)
    delete updates.available_stock;
    delete (updates as any).id;
    delete (updates as any).created_at;
    delete (updates as any).category_name;
    delete (updates as any).supplier_name;
    // If not owner, do not allow changing wholesale cost or pricing rule
    if (role !== 'owner') {
      delete updates.wholesale_unit_cost;
      delete updates.pricing_rule;
      delete updates.pricing_rule_percentage;
    }
    // SKUs are permanent once assigned
    delete updates.sku;
    for (const field of ['wholesale_unit_cost', 'actual_listed_price', 'suggested_price', 'low_stock_threshold'] as const) {
      if (updates[field] !== undefined) {
        const value = Number(updates[field]);
        if (!Number.isFinite(value) || value < 0) throw new Error(`${field.replace(/_/g, ' ')} must be zero or more.`);
        updates[field] = value;
      }
    }

    const updated: Product = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.products[index] = updated;
    await this.persist();
    return updated;
  }

  // =========================================================================
  // PURCHASE BATCHES & STOCK MOVEMENTS
  // =========================================================================
  public async addPurchaseBatch(batch: {
    product_id: string;
    batch_number: string;
    purchase_date: string;
    quantity: number;
    unit_cost: number;
    shipping_cost?: number;
    other_costs?: number;
    supplier_id: string;
    notes?: string;
  }, staffId: string): Promise<PurchaseBatch> {
    const product = this.data.products.find(p => p.id === batch.product_id);
    if (!product) throw new Error('Product not found.');
    if (!Number.isInteger(Number(batch.quantity)) || Number(batch.quantity) <= 0) {
      throw new Error('Batch quantity must be a whole number greater than zero.');
    }
    for (const cost of [batch.unit_cost, batch.shipping_cost || 0, batch.other_costs || 0]) {
      if (!Number.isFinite(Number(cost)) || Number(cost) < 0) throw new Error('Batch costs must be zero or more.');
    }
    if (!batch.batch_number?.trim()) throw new Error('Batch number is required.');
    batch = { ...batch, quantity: Number(batch.quantity), unit_cost: Number(batch.unit_cost) };

    const now = new Date().toISOString();
    const newStock = product.available_stock + batch.quantity;

    const newBatch: PurchaseBatch = {
      id: crypto.randomUUID(),
      product_id: batch.product_id,
      batch_number: batch.batch_number.trim(),
      purchase_date: batch.purchase_date,
      quantity: batch.quantity,
      unit_cost: batch.unit_cost,
      shipping_cost: batch.shipping_cost || 0,
      other_costs: batch.other_costs || 0,
      supplier_id: batch.supplier_id,
      notes: batch.notes,
      created_at: now,
    };
    this.data.purchase_batches.push(newBatch);

    // Update product stock atomically
    product.available_stock = newStock;
    product.updated_at = now;

    // Record immutable movement
    this.data.stock_movements.push({
      id: crypto.randomUUID(),
      product_id: product.id,
      movement_type: 'received',
      quantity_delta: batch.quantity,
      resulting_stock: newStock,
      reference_type: 'purchase_batch',
      reference_id: batch.batch_number,
      notes: `Purchase batch ${batch.batch_number}: received ${batch.quantity} units`,
      performed_by_staff_id: staffId,
      created_at: now,
    });

    await this.persist();
    return newBatch;
  }

  public getBatchesForProduct(productId: string, role: StaffRole): PurchaseBatch[] {
    const isOwner = role === 'owner';
    return this.data.purchase_batches
      .filter(b => b.product_id === productId)
      .map(b => {
        const supp = this.data.suppliers.find(s => s.id === b.supplier_id);
        return {
          ...b,
          supplier_name: supp?.name,
          unit_cost: isOwner ? b.unit_cost : 0,
          shipping_cost: isOwner ? b.shipping_cost : 0,
          other_costs: isOwner ? b.other_costs : 0,
        };
      });
  }

  public getStockMovements(productId?: string): StockMovement[] {
    const movements = productId
      ? this.data.stock_movements.filter(m => m.product_id === productId)
      : this.data.stock_movements;

    return movements
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(m => {
        const prod = this.data.products.find(p => p.id === m.product_id);
        const staff = this.data.staff_profiles.find(s => s.id === m.performed_by_staff_id);
        return {
          ...m,
          product_name: prod?.name,
          product_sku: prod?.sku,
          performed_by_name: staff?.full_name || 'System',
        };
      });
  }

  public async correctStock(
    productId: string,
    newQuantity: number,
    reason: string,
    staffId: string
  ): Promise<StockMovement> {
    const product = this.data.products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found.');
    if (!Number.isInteger(newQuantity)) throw new Error('Stock must be a whole number of units.');
    if (newQuantity < 0) throw new Error('Stock cannot be negative.');
    if (!(reason || '').trim()) throw new Error('Correction reason is required.');

    const delta = newQuantity - product.available_stock;
    if (delta === 0) throw new Error('New stock count is identical to current stock.');

    const now = new Date().toISOString();
    product.available_stock = newQuantity;
    product.updated_at = now;

    const movement: StockMovement = {
      id: crypto.randomUUID(),
      product_id: productId,
      movement_type: 'corrected',
      quantity_delta: delta,
      resulting_stock: newQuantity,
      reference_type: 'manual_correction',
      notes: `Stock correction: ${delta > 0 ? '+' : ''}${delta}. Reason: ${reason.trim()}`,
      performed_by_staff_id: staffId,
      created_at: now,
    };
    this.data.stock_movements.push(movement);
    await this.persist();
    return movement;
  }

  // =========================================================================
  // BUYERS
  // =========================================================================
  public getBuyers(): Buyer[] {
    return this.data.buyers.map(b => {
      const orders = this.data.orders.filter(o => o.buyer_id === b.id);
      const spent = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      return {
        ...b,
        orders_count: orders.length,
        total_spent: spent,
      };
    });
  }

  public async createBuyer(buyer: Omit<Buyer, 'id' | 'created_at'>): Promise<Buyer> {
    if (!(buyer.name || '').trim()) throw new Error('Buyer name is required.');
    if (!(buyer.phone || '').trim()) throw new Error('Buyer phone number is required.');
    if (!(buyer.delivery_address || '').trim()) throw new Error('Delivery address is required.');

    const newBuyer: Buyer = {
      ...buyer,
      location_link: cleanLink(buyer.location_link),
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.data.buyers.push(newBuyer);
    await this.persist();
    return newBuyer;
  }

  public async updateBuyer(id: string, updates: Partial<Buyer>): Promise<Buyer> {
    const index = this.data.buyers.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Buyer not found.');
    if (updates.location_link !== undefined) updates = { ...updates, location_link: cleanLink(updates.location_link) };
    const updated = {
      ...this.data.buyers[index],
      ...updates,
      id: this.data.buyers[index].id,
      created_at: this.data.buyers[index].created_at,
    };
    this.data.buyers[index] = updated;
    await this.persist();
    return updated;
  }

  public getExistingAddresses(): string[] {
    const set = new Set<string>();
    for (const b of this.data.buyers) {
      if (b.delivery_address && b.delivery_address.trim()) {
        set.add(b.delivery_address.trim());
      }
    }
    for (const o of this.data.orders) {
      if (o.buyer_address && o.buyer_address.trim()) {
        set.add(o.buyer_address.trim());
      }
    }
    return Array.from(set);
  }

  // =========================================================================
  // ORDERS (ATOMIC CREATION, STOCK DEDUCTION, DELIVERY, PAYMENTS)
  // =========================================================================
  public getOrders(role: StaffRole): Order[] {
    const isOwner = role === 'owner';
    return this.data.orders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(o => {
        const buyer = this.data.buyers.find(b => b.id === o.buyer_id);
        const staff = this.data.staff_profiles.find(s => s.id === o.created_by_staff_id);
        const items = this.data.order_items.filter(it => it.order_id === o.id).map(it => ({
          ...it,
          // redact unit_cost and line_cost if not owner
          unit_cost: isOwner ? it.unit_cost : 0,
          line_cost: isOwner ? it.line_cost : 0,
        }));

        return {
          ...o,
          buyer_name: buyer?.name || 'Unknown Buyer',
          buyer_phone: buyer?.phone || '',
          buyer_address: o.buyer_address || buyer?.delivery_address || '',
          buyer_instagram: buyer?.instagram_handle || '',
          created_by_name: staff?.full_name || 'Staff',
          items,
          total_cost: isOwner ? o.total_cost : undefined,
          estimated_profit: isOwner ? o.estimated_profit : undefined,
        };
      });
  }

  public async createOrderAtomic(data: {
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
  }, staffId: string): Promise<Order> {
    if (!data.items || data.items.length === 0) {
      throw new Error('An order must contain at least one product.');
    }

    const buyer = this.data.buyers.find(b => b.id === data.buyer_id);
    if (!buyer) throw new Error('Selected buyer was not found.');

    // 1. ATOMIC CHECK: Verify all products exist and have sufficient stock.
    // Quantities are summed per product so the same product on two lines cannot oversell.
    const requestedByProduct = new Map<string, number>();
    for (const item of data.items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error('Item quantity must be a whole number of at least 1.');
      }
      const price = Number(item.unit_selling_price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Selling price must be zero or more.');
      }
      const product = this.data.products.find(p => p.id === item.product_id);
      if (!product) {
        throw new Error(`Product not found.`);
      }
      if (!product.is_active) {
        throw new Error(`"${product.name}" is not active and cannot be sold.`);
      }
      requestedByProduct.set(product.id, (requestedByProduct.get(product.id) || 0) + qty);
    }
    for (const [productId, qty] of requestedByProduct) {
      const product = this.data.products.find(p => p.id === productId)!;
      if (product.available_stock < qty) {
        throw new Error(
          `Insufficient stock for "${product.name}". Requested: ${qty}, Available: ${product.available_stock}. Stock cannot be negative.`
        );
      }
    }
    const deliveryFeeInput = Number(data.delivery_fee) || 0;
    if (deliveryFeeInput < 0) throw new Error('Delivery fee cannot be negative.');
    if (!ORDER_CHANNELS.includes(data.channel)) throw new Error('Please choose the channel the order came from.');
    if (!PAYMENT_METHODS.includes(data.payment_method)) throw new Error('Payment method must be bank transfer or cash.');

    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const year = new Date().getFullYear();
    let sequence = this.data.orders.length + 1;
    while (this.data.orders.some(o => o.order_number === `HALI-${year}-${String(sequence).padStart(4, '0')}`)) sequence++;
    const orderNumber = `HALI-${year}-${String(sequence).padStart(4, '0')}`;

    let subtotal = 0;
    let totalCost = 0;
    const orderItems: OrderItem[] = [];

    // 2. ATOMIC EXECUTION: Decrement stock, create order items with captured snapshots
    for (const item of data.items) {
      const product = this.data.products.find(p => p.id === item.product_id)!;
      const newStock = product.available_stock - item.quantity;
      product.available_stock = newStock;
      product.updated_at = now;

      const lineTotal = Number((item.quantity * item.unit_selling_price).toFixed(2));
      const lineCost = Number((item.quantity * product.wholesale_unit_cost).toFixed(2));
      subtotal += lineTotal;
      totalCost += lineCost;

      const orderItem: OrderItem = {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: item.quantity,
        unit_selling_price: item.unit_selling_price,
        unit_cost: product.wholesale_unit_cost, // captured snapshot!
        line_total: lineTotal,
        line_cost: lineCost,
      };
      orderItems.push(orderItem);
      this.data.order_items.push(orderItem);

      // Record immutable stock movement
      this.data.stock_movements.push({
        id: crypto.randomUUID(),
        product_id: product.id,
        movement_type: 'sold',
        quantity_delta: -item.quantity,
        resulting_stock: newStock,
        reference_type: 'order',
        reference_id: orderNumber,
        notes: `Order ${orderNumber}: sold ${item.quantity} unit${item.quantity === 1 ? '' : 's'} to ${buyer.name}`,
        performed_by_staff_id: staffId,
        created_at: now,
      });
    }

    const deliveryFee = Number(data.delivery_fee) || 0;
    const totalAmount = subtotal + deliveryFee;

    // Delivery person & courier price / rate
    let courierService: DeliveryService | undefined;
    if (data.delivery_person_id) {
      courierService = this.data.delivery_services?.find(d => d.id === data.delivery_person_id);
    }
    const deliveryRate = Number(
      data.delivery_rate !== undefined
        ? data.delivery_rate
        : (courierService ? courierService.default_rate : (data.delivery_fee || 0))
    ) || 0;

    // PROFIT IS CALCULATED AFTER COURIER DELIVERY PRICE IS DEDUCTED:
    // Net Profit = (Subtotal + Customer Delivery Fee) - Product Cost - Courier Delivery Rate
    const estimatedProfit = Number(((subtotal + deliveryFee) - totalCost - deliveryRate).toFixed(2));

    const deliveryPersonName = data.delivery_person_name?.trim() || courierService?.name || '';
    const deliveryPersonPhone = data.delivery_person_phone?.trim() || courierService?.phone || '';
    const resolvedAddress = data.delivery_address?.trim() || buyer.delivery_address || '';

    // Update buyer's address if a fresh one was passed for this order
    if (data.delivery_address && data.delivery_address.trim() && buyer.delivery_address !== data.delivery_address.trim()) {
      buyer.delivery_address = data.delivery_address.trim();
      if (data.boat_name) buyer.boat_name = data.boat_name;
      if (data.boat_phone) buyer.boat_phone = data.boat_phone;
      if (data.boat_jetty) buyer.boat_jetty = data.boat_jetty;
      if (data.atoll_code) buyer.atoll_code = data.atoll_code;
      if (data.island_name) buyer.island_name = data.island_name;
      if (cleanLink(data.location_link)) buyer.location_link = cleanLink(data.location_link);
    }

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      buyer_id: data.buyer_id,
      buyer_address: resolvedAddress,
      boat_name: data.boat_name?.trim() || undefined,
      boat_phone: data.boat_phone?.trim() || undefined,
      boat_jetty: data.boat_jetty?.trim() || undefined,
      atoll_code: data.atoll_code?.trim() || undefined,
      island_name: data.island_name?.trim() || undefined,
      hulhumale_lot: data.hulhumale_lot?.trim() || undefined,
      location_link: cleanLink(data.location_link),
      channel_detail: data.channel === 'other' ? (data.channel_detail || '').trim().slice(0, 60) || undefined : undefined,
      order_date: now,
      channel: data.channel,
      stage: 'new',
      subtotal_amount: subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      total_cost: totalCost,
      delivery_rate: deliveryRate,
      delivery_person_id: data.delivery_person_id || courierService?.id || undefined,
      delivery_person_name: deliveryPersonName || undefined,
      delivery_person_phone: deliveryPersonPhone || undefined,
      estimated_profit: estimatedProfit,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      amount_received: Math.max(0, Number(data.amount_received) || 0),
      created_by_staff_id: staffId,
      notes: data.notes || '',
      stock_returned: false,
      items: orderItems,
      created_at: now,
    };

    this.data.orders.push(newOrder);

    // 3. Record initial payment if amount received > 0
    if (newOrder.amount_received > 0) {
      this.data.payments.push({
        id: crypto.randomUUID(),
        order_id: orderId,
        order_number: orderNumber,
        amount: newOrder.amount_received,
        payment_method: data.payment_method,
        transaction_reference: 'Initial Payment',
        receipt_notes: 'Payment collected at order creation',
        recorded_by_staff_id: staffId,
        created_at: now,
      });
    }

    await this.persist();
    return newOrder;
  }

  public async updateOrderStatus(
    orderId: string,
    stage: Order['stage'],
    staffId: string,
    deliveryInfo?: {
      delivery_person_name: string;
      delivery_person_phone?: string;
      notes?: string;
    }
  ): Promise<Order> {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found.');

    const allowed = ORDER_STAGE_TRANSITIONS[order.stage] || [];
    if (!allowed.includes(stage)) {
      throw new Error(`An order that is "${order.stage}" cannot be moved to "${stage}".`);
    }

    const now = new Date().toISOString();

    // Requirement: "Require a delivery person when marking an order handed over"
    if (stage === 'handed_over') {
      if (!deliveryInfo?.delivery_person_name?.trim()) {
        throw new Error('A delivery person name is strictly required when handing over an order.');
      }
      order.delivery_person_name = deliveryInfo.delivery_person_name.trim();
      order.delivery_person_phone = deliveryInfo.delivery_person_phone?.trim() || '';
      order.delivery_handover_time = now;

      // Record delivery handover
      this.data.delivery_handovers.push({
        id: crypto.randomUUID(),
        order_id: order.id,
        order_number: order.order_number,
        delivery_person_name: deliveryInfo.delivery_person_name.trim(),
        delivery_person_phone: deliveryInfo.delivery_person_phone?.trim() || '',
        handover_time: now,
        notes: deliveryInfo.notes || 'Handed over for local courier delivery',
        status: 'handed_over',
        staff_id: staffId,
        created_at: now,
      });
    }

    if (stage === 'delivered') {
      order.delivery_completed_time = now;
      const handover = this.data.delivery_handovers.find(h => h.order_id === order.id);
      if (handover) {
        handover.status = 'delivered';
        handover.delivered_time = now;
      }
    }

    order.stage = stage;
    order.updated_at = now;
    await this.persist();
    return order;
  }

  // Requirement: "Do not automatically put failed or cancelled goods back into available stock.
  // Provide an explicit return-to-stock action after staff confirm the goods are physically back."
  public async returnOrderStockAtomic(orderId: string, reason: string, staffId: string): Promise<{ success: boolean; message: string }> {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found.');

    if (!['failed', 'cancelled', 'returned'].includes(order.stage)) {
      throw new Error('Stock can only be returned for failed, cancelled, or returned orders.');
    }

    if (order.stock_returned) {
      throw new Error('Items from this order have already been confirmed and returned to available stock.');
    }

    const items = this.data.order_items.filter(it => it.order_id === order.id);
    const now = new Date().toISOString();

    for (const item of items) {
      const product = this.data.products.find(p => p.id === item.product_id);
      if (product) {
        const newStock = product.available_stock + item.quantity;
        product.available_stock = newStock;
        product.updated_at = now;

        this.data.stock_movements.push({
          id: crypto.randomUUID(),
          product_id: product.id,
          movement_type: 'returned',
          quantity_delta: item.quantity,
          resulting_stock: newStock,
          reference_type: 'return_to_stock',
          reference_id: order.order_number,
          notes: `Physically returned to stock from Order ${order.order_number}. ${reason || 'Staff confirmed physical inventory reception.'}`,
          performed_by_staff_id: staffId,
          created_at: now,
        });
      }
    }

    order.stock_returned = true;
    order.updated_at = now;
    await this.persist();

    return {
      success: true,
      message: `Stock successfully returned for order ${order.order_number}. Inventory counts updated atomically.`,
    };
  }

  public async recordPayment(
    orderId: string,
    amount: number,
    paymentMethod: Order['payment_method'],
    transactionRef: string,
    notes: string,
    staffId: string,
    slip?: { path: string; name?: string; type?: string }
  ): Promise<PaymentRecord> {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (order.stage === 'cancelled') throw new Error('Payments cannot be recorded against a cancelled order.');
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error('Payment method must be bank transfer or cash.');

    const now = new Date().toISOString();
    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      order_id: order.id,
      order_number: order.order_number,
      amount,
      payment_method: paymentMethod,
      transaction_reference: transactionRef || '',
      receipt_notes: notes || '',
      recorded_by_staff_id: staffId,
      created_at: now,
    };
    if (slip?.path) {
      if (!/^slips\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(slip.path)) throw new Error('The attached slip is not valid. Please attach it again.');
      payment.slip_path = slip.path;
      payment.slip_name = (slip.name || 'transfer-slip').slice(0, 120);
      payment.slip_type = slip.type;
    }
    this.data.payments.push(payment);

    order.amount_received = (order.amount_received || 0) + amount;
    if (order.amount_received >= order.total_amount) {
      order.payment_status = 'paid';
    } else if (order.amount_received > 0) {
      order.payment_status = 'partially_paid';
    }
    order.updated_at = now;

    await this.persist();
    return payment;
  }

  public getPaymentsForOrder(orderId: string): PaymentRecord[] {
    return this.data.payments
      .filter(p => p.order_id === orderId)
      .map(p => ({ ...p, recorded_by_name: this.data.staff_profiles.find(s => s.id === p.recorded_by_staff_id)?.full_name || 'Staff' }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  public getPayment(paymentId: string): PaymentRecord | undefined {
    return this.data.payments.find(p => p.id === paymentId);
  }

  public getOwnerEmail(): string {
    return PRIMARY_OWNER_EMAIL;
  }

  public getDeliveryHandovers(): DeliveryHandover[] {
    return this.data.delivery_handovers.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // =========================================================================
  // SOCIAL MEDIA POSTS
  // =========================================================================
  public getSocialPosts(): SocialPost[] {
    return this.data.social_posts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(sp => {
        const prod = this.data.products.find(p => p.id === sp.product_id);
        return {
          ...sp,
          product_name: prod?.name || 'Unassigned Product',
          product_sku: prod?.sku || '',
        };
      });
  }

  public async createSocialPost(post: Omit<SocialPost, 'id' | 'created_at'>): Promise<SocialPost> {
    const prod = this.data.products.find(p => p.id === post.product_id);
    if (!prod) throw new Error('Product not found.');

    const newPost: SocialPost = {
      ...post,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.data.social_posts.push(newPost);
    await this.persist();
    return newPost;
  }

  public async updateSocialPost(id: string, updates: Partial<SocialPost>): Promise<SocialPost> {
    const index = this.data.social_posts.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Social post not found.');

    const updated = {
      ...this.data.social_posts[index],
      ...updates,
      id: this.data.social_posts[index].id,
      created_at: this.data.social_posts[index].created_at,
      updated_at: new Date().toISOString(),
    };
    this.data.social_posts[index] = updated;
    await this.persist();
    return updated;
  }

  // =========================================================================
  // AI STUDIO PHOTOS (usage log + daily limit)
  // =========================================================================
  /** Photos this staff member has generated today (Maldives time), counting runs in progress. */
  public aiPhotosUsedToday(staffId: string): number {
    const today = maldivesDay(new Date().toISOString());
    return (this.data.ai_photo_log || [])
      .filter(e => e.staff_id === staffId && maldivesDay(e.created_at) === today)
      .reduce((sum, e) => {
        // A run that never finished (e.g. the server timed out) stops counting after 15 minutes
        const stillRunning = e.status === 'running' && Date.now() - new Date(e.created_at).getTime() < 15 * 60_000;
        return sum + (stillRunning ? e.photos_requested : e.photos_made);
      }, 0);
  }

  /** Records the start of a run, refusing it if it would go over the daily limit. */
  public async startAiPhotoRun(
    staff: StaffProfile,
    data: { product_name: string; model: string; photos: number; dailyLimit: number }
  ): Promise<AiPhotoLogEntry> {
    const used = this.aiPhotosUsedToday(staff.id);
    if (used + data.photos > data.dailyLimit) {
      const left = Math.max(0, data.dailyLimit - used);
      throw new Error(
        left > 0
          ? `You can make ${left} more AI photo${left === 1 ? '' : 's'} today. Choose fewer views.`
          : `You have reached today's limit of ${data.dailyLimit} AI photos. Try again tomorrow.`
      );
    }
    const entry: AiPhotoLogEntry = {
      id: crypto.randomUUID(),
      staff_id: staff.id,
      staff_name: staff.full_name,
      product_name: data.product_name,
      model: data.model,
      photos_requested: data.photos,
      photos_made: 0,
      status: 'running',
      created_at: new Date().toISOString(),
    };
    const log = (this.data.ai_photo_log ||= []);
    log.push(entry);
    if (log.length > 1000) log.splice(0, log.length - 1000);
    await this.persist();
    return entry;
  }

  /** Marks a run finished; only photos actually made count towards the limit. */
  public async finishAiPhotoRun(id: string, photosMade: number): Promise<void> {
    const entry = (this.data.ai_photo_log || []).find(e => e.id === id);
    if (!entry) return;
    entry.photos_made = photosMade;
    entry.status = photosMade > 0 ? 'done' : 'failed';
    entry.finished_at = new Date().toISOString();
    await this.persist();
  }
}

export const db = new DatabaseEngine();
