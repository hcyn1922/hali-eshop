import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, PRIMARY_OWNER_EMAIL } from './server/db.ts';
import { StoreConflictError } from './server/store.ts';
import { allow, extractToken, getAuth, HttpError, requireAuth } from './server/auth.ts';
import { LOCAL_UPLOAD_DIR, readPaymentSlip, savePaymentSlip, saveProductImage } from './server/uploads.ts';
import { appUrl, emailConfigured, notificationRecipient, notifyAccessRequest, notifyDelivered, notifyNewOrder, sendTestEmail } from './server/notify.ts';
import type { StaffRole } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check for container supervisors & readiness probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});
app.head('/', (_req, res) => {
  res.status(200).end();
});

// Locally stored product photos (used when Supabase Storage is not configured)
app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

// -----------------------------------------------------------------------------
// Request serialisation + store sync
// API requests that touch the database run one at a time per server instance, after
// syncing with the persistent store. Together with the store's versioned saves this
// keeps every mutation (e.g. stock deduction + order creation) all-or-nothing.
// -----------------------------------------------------------------------------
let requestQueue: Promise<void> = Promise.resolve();

app.use('/api', (req, res, next) => {
  let release!: () => void;
  const turn = new Promise<void>(resolve => (release = resolve));
  const previous = requestQueue;
  requestQueue = previous.then(() => turn);

  let released = false;
  const done = () => {
    if (!released) {
      released = true;
      release();
    }
  };
  res.on('finish', done);
  res.on('close', done);

  previous
    .then(() => db.sync())
    .then(() => next())
    .catch(err => {
      done();
      next(err);
    });
});

/** Wraps an async route so thrown errors reach the error handler. */
type AsyncHandler = (req: express.Request, res: express.Response) => Promise<unknown> | unknown;
const route = (fn: AsyncHandler): express.RequestHandler => (req, res, next) => {
  Promise.resolve()
    .then(() => fn(req, res))
    .catch(next);
};

const ALL: StaffRole[] = ['owner', 'sales', 'inventory', 'marketing'];
const OWNER: StaffRole[] = ['owner'];
const STOCK_MANAGERS: StaffRole[] = ['owner', 'inventory'];
const ORDER_TAKERS: StaffRole[] = ['owner', 'sales'];
const ORDER_PROCESSORS: StaffRole[] = ['owner', 'sales', 'inventory'];
const CONTENT_TEAM: StaffRole[] = ['owner', 'marketing'];

// -----------------------------------------------------------------------------
// AUTHENTICATION (public)
// -----------------------------------------------------------------------------
app.post('/api/auth/login', route(async (req, res) => {
  const { email, password } = req.body || {};
  try {
    res.json(await db.authenticate(String(email || ''), String(password || '')));
  } catch (err: any) {
    throw new HttpError(401, err.message || 'Login failed.');
  }
}));

app.post('/api/auth/register', route(async (req, res) => {
  const { full_name, email, phone, role, password, request_note, auto_login } = req.body || {};
  if (!full_name || !email) throw new HttpError(400, 'Full name and email are required.');
  const result = await db.registerUser({
    full_name: String(full_name),
    email: String(email),
    phone,
    role,
    password,
    request_note,
    auto_login: auto_login !== false,
  });
  await notifyAccessRequest(result.staff, appUrl(req));
  res.status(201).json(result);
}));

app.post('/api/staff/request-access', route(async (req, res) => {
  const { full_name, email, phone, role, password, request_note } = req.body || {};
  if (!full_name || !email) throw new HttpError(400, 'Full name and email are required to request access.');
  const created = await db.requestStaffAccess({ full_name, email, phone, role, password, request_note });
  await notifyAccessRequest(created, appUrl(req));
  res.status(201).json(created);
}));

app.get('/api/auth/settings', route((_req, res) => {
  res.json(db.getAuthSettings());
}));

app.post('/api/auth/logout', route(async (req, res) => {
  const token = extractToken(req);
  if (token) await db.revokeSession(token);
  res.json({ success: true, message: 'Logged out successfully.' });
}));

// -----------------------------------------------------------------------------
// Everything below requires a signed-in, approved staff member
// -----------------------------------------------------------------------------
app.use('/api', requireAuth);

app.get('/api/auth/me', route((req, res) => {
  const { staff } = getAuth(req);
  res.json({ staff, has_local_password: db.hasLocalPassword(staff.id), primary_owner_email: PRIMARY_OWNER_EMAIL });
}));

app.post('/api/auth/change-password', route(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  await db.changePassword(getAuth(req).staffId, String(currentPassword || ''), String(newPassword || ''));
  res.json({ success: true, message: 'Password updated successfully.' });
}));

app.post('/api/auth/reset-password', allow(...OWNER), route(async (req, res) => {
  const { staffId, newPassword } = req.body || {};
  await db.resetStaffPassword(String(staffId || ''), String(newPassword || ''), getAuth(req).role);
  res.json({ success: true, message: 'Staff password updated successfully. Their existing sessions were signed out.' });
}));

app.put('/api/auth/settings', allow(...OWNER), route(async (req, res) => {
  res.json(await db.updateAuthSettings(req.body || {}, getAuth(req).role));
}));

app.get('/api/auth/sessions', route((req, res) => {
  const { role, staffId } = getAuth(req);
  res.json({ count: db.countActiveSessions(role === 'owner' ? undefined : staffId) });
}));

// -----------------------------------------------------------------------------
// System status & sample data
// -----------------------------------------------------------------------------
const SAMPLE_SKUS = ['HALI-PRF-BONITA', 'HALI-PRF-MOON', 'HALI-CSM-NIV50'];

app.get('/api/status', route((req, res) => {
  const products = db.getProducts(getAuth(req).role);
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    productsCount: products.length,
    sampleLoaded: products.some(p => SAMPLE_SKUS.includes(p.sku)),
    storage: db.storageBackend,
    supabaseConfigured: db.storageBackend === 'supabase',
    emailConfigured: emailConfigured(),
    notifyEmail: getAuth(req).role === 'owner' ? notificationRecipient() : undefined,
  });
}));

app.post('/api/notifications/test', allow(...OWNER), route(async (req, res) => {
  const result = await sendTestEmail(appUrl(req));
  if (!result.ok) throw new HttpError(400, result.error || 'The test email could not be sent.');
  res.json({ success: true, message: `Test email sent to ${notificationRecipient()}.` });
}));

app.post('/api/sample/load', allow(...OWNER), route(async (_req, res) => {
  res.json(await db.loadSampleInventory());
}));

app.get('/api/dashboard/metrics', route((req, res) => {
  res.json(db.getDashboardMetrics(getAuth(req).role));
}));

// -----------------------------------------------------------------------------
// Shop profile (printed on invoices)
// -----------------------------------------------------------------------------
app.get('/api/shop-profile', route((_req, res) => {
  res.json(db.getShopProfile());
}));

app.put('/api/shop-profile', allow(...OWNER), route(async (req, res) => {
  res.json(await db.updateShopProfile(req.body || {}));
}));

// -----------------------------------------------------------------------------
// Staff management & RBAC
// -----------------------------------------------------------------------------
app.get('/api/staff', route((req, res) => {
  const { role } = getAuth(req);
  const staff = db.getStaffProfiles();
  // Only owners see pending / rejected access requests
  res.json(role === 'owner' ? staff : staff.filter(s => s.approval_status === 'approved'));
}));

app.post('/api/staff/invite', allow(...OWNER), route(async (req, res) => {
  res.status(201).json(await db.inviteStaff(req.body || {}));
}));

app.post('/api/staff/:id/approve', allow(...OWNER), route(async (req, res) => {
  res.json(await db.approveStaffRequest(req.params.id, req.body?.role));
}));

app.post('/api/staff/:id/reject', allow(...OWNER), route(async (req, res) => {
  res.json(await db.rejectStaffRequest(req.params.id));
}));

app.post('/api/staff/:id/role', allow(...OWNER), route(async (req, res) => {
  res.json(await db.changeStaffRole(req.params.id, req.body?.role));
}));

app.post('/api/staff/:id/toggle', allow(...OWNER), route(async (req, res) => {
  res.json(await db.toggleStaffActive(req.params.id, getAuth(req).role));
}));

app.post('/api/staff/:id/deactivate', allow(...OWNER), route(async (req, res) => {
  res.json(await db.deactivateStaff(req.params.id, getAuth(req).role));
}));

app.delete('/api/staff/:id', allow(...OWNER), route(async (req, res) => {
  res.json(await db.deleteStaff(req.params.id, getAuth(req).role));
}));

app.put('/api/staff/:id', route(async (req, res) => {
  const { role, staffId } = getAuth(req);
  res.json(await db.updateStaffProfile(req.params.id, req.body || {}, { role, staffId }));
}));

// -----------------------------------------------------------------------------
// Categories & suppliers
// -----------------------------------------------------------------------------
app.get('/api/categories', route((_req, res) => {
  res.json(db.getCategories());
}));

app.post('/api/categories', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { name, description } = req.body || {};
  res.status(201).json(await db.createCategory(String(name || ''), description));
}));

app.put('/api/categories/:id', allow(...STOCK_MANAGERS), route(async (req, res) => {
  res.json(await db.updateCategory(req.params.id, req.body || {}));
}));

app.delete('/api/categories/:id', allow(...STOCK_MANAGERS), route(async (req, res) => {
  await db.deleteCategory(req.params.id);
  res.json({ success: true });
}));

app.get('/api/suppliers', route((req, res) => {
  res.json(db.getSuppliers(getAuth(req).role));
}));

app.post('/api/suppliers', allow(...STOCK_MANAGERS), route(async (req, res) => {
  res.status(201).json(await db.createSupplier(req.body || {}));
}));

app.put('/api/suppliers/:id', allow(...STOCK_MANAGERS), route(async (req, res) => {
  res.json(await db.updateSupplier(req.params.id, req.body || {}));
}));

// -----------------------------------------------------------------------------
// Products, purchase batches & the stock ledger
// Wholesale costs are redacted by the server for everyone except the owner.
// -----------------------------------------------------------------------------
app.get('/api/products', route((req, res) => {
  res.json(db.getProducts(getAuth(req).role));
}));

app.get('/api/products/:id', route((req, res) => {
  const prod = db.getProductById(req.params.id, getAuth(req).role);
  if (!prod) throw new HttpError(404, 'Product not found.');
  res.json(prod);
}));

app.post('/api/products', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { role, staffId } = getAuth(req);
  const { openingStock, ...productData } = req.body || {};
  if (role !== 'owner') {
    // Non-owners cannot see costs, so they cannot set them either
    delete productData.wholesale_unit_cost;
    productData.wholesale_unit_cost = 0;
  }
  const created = await db.createProduct(productData, Number(openingStock) || 0, staffId);
  res.status(201).json(db.getProductById(created.id, role));
}));

app.put('/api/products/:id', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { role } = getAuth(req);
  const updated = await db.updateProduct(req.params.id, req.body || {}, role);
  res.json(db.getProductById(updated.id, role));
}));

app.post('/api/batches', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { role, staffId } = getAuth(req);
  const batch = await db.addPurchaseBatch(req.body || {}, staffId);
  const visible = db.getBatchesForProduct(batch.product_id, role).find(b => b.id === batch.id);
  res.status(201).json(visible);
}));

app.get('/api/batches/:productId', route((req, res) => {
  res.json(db.getBatchesForProduct(req.params.productId, getAuth(req).role));
}));

app.get('/api/stock/movements', route((req, res) => {
  const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
  res.json(db.getStockMovements(productId));
}));

app.post('/api/stock/correct', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { productId, newQuantity, reason } = req.body || {};
  res.json(await db.correctStock(String(productId || ''), Number(newQuantity), String(reason || ''), getAuth(req).staffId));
}));

// -----------------------------------------------------------------------------
// Buyers
// -----------------------------------------------------------------------------
app.get('/api/buyers', allow(...ORDER_PROCESSORS), route((_req, res) => {
  res.json(db.getBuyers());
}));

app.post('/api/buyers', allow(...ORDER_TAKERS), route(async (req, res) => {
  res.status(201).json(await db.createBuyer(req.body || {}));
}));

app.put('/api/buyers/:id', allow(...ORDER_TAKERS), route(async (req, res) => {
  res.json(await db.updateBuyer(req.params.id, req.body || {}));
}));

app.get('/api/addresses/existing', allow(...ORDER_TAKERS), route((_req, res) => {
  res.json(db.getExistingAddresses());
}));

// -----------------------------------------------------------------------------
// Delivery services & couriers
// -----------------------------------------------------------------------------
app.get('/api/delivery-services', route((_req, res) => {
  res.json(db.getDeliveryServices());
}));

app.post('/api/delivery-services', allow(...ORDER_PROCESSORS), route(async (req, res) => {
  res.status(201).json(await db.createDeliveryService(req.body || {}));
}));

app.put('/api/delivery-services/:id', allow(...ORDER_PROCESSORS), route(async (req, res) => {
  res.json(await db.updateDeliveryService(req.params.id, req.body || {}));
}));

app.delete('/api/delivery-services/:id', allow(...OWNER), route(async (req, res) => {
  await db.deleteDeliveryService(req.params.id);
  res.json({ success: true });
}));

// -----------------------------------------------------------------------------
// Orders: atomic creation, lifecycle, return-to-stock, payments
// -----------------------------------------------------------------------------
const visibleOrder = (orderId: string, role: StaffRole) => db.getOrders(role).find(o => o.id === orderId);

app.get('/api/orders', allow(...ORDER_PROCESSORS), route((req, res) => {
  res.json(db.getOrders(getAuth(req).role));
}));

app.post('/api/orders', allow(...ORDER_TAKERS), route(async (req, res) => {
  const { role, staffId } = getAuth(req);
  const order = await db.createOrderAtomic(req.body || {}, staffId);
  await notifyNewOrder(visibleOrder(order.id, 'owner')!, getAuth(req).staff.full_name, appUrl(req));
  res.status(201).json(visibleOrder(order.id, role));
}));

app.post('/api/orders/:id/status', allow(...ORDER_PROCESSORS), route(async (req, res) => {
  const { role, staffId } = getAuth(req);
  const { stage, deliveryInfo } = req.body || {};
  const updated = await db.updateOrderStatus(req.params.id, stage, staffId, deliveryInfo);
  if (updated.stage === 'delivered') await notifyDelivered(visibleOrder(updated.id, 'owner')!, appUrl(req));
  res.json(visibleOrder(updated.id, role));
}));

// Failed / cancelled goods only go back on the shelf after staff physically confirm them
app.post('/api/orders/:id/return-stock', allow(...STOCK_MANAGERS), route(async (req, res) => {
  const { reason } = req.body || {};
  res.json(await db.returnOrderStockAtomic(req.params.id, String(reason || ''), getAuth(req).staffId));
}));

app.post('/api/orders/:id/payment', allow(...ORDER_TAKERS), route(async (req, res) => {
  const { amount, paymentMethod, transactionRef, notes, slip } = req.body || {};
  const payment = await db.recordPayment(
    req.params.id,
    Number(amount),
    paymentMethod,
    String(transactionRef || ''),
    String(notes || ''),
    getAuth(req).staffId,
    slip && typeof slip.path === 'string' ? { path: slip.path, name: String(slip.name || ''), type: String(slip.type || '') } : undefined
  );
  res.status(201).json(payment);
}));

app.get('/api/orders/:id/payments', allow(...ORDER_PROCESSORS), route((req, res) => {
  res.json(db.getPaymentsForOrder(req.params.id));
}));

// Bank transfer slips are private: uploaded and viewed only through these signed-in routes
app.post('/api/uploads/slip', allow(...ORDER_TAKERS), route(async (req, res) => {
  res.status(201).json(await savePaymentSlip(String(req.body?.data || '')));
}));

app.get('/api/payments/:id/slip', allow(...ORDER_TAKERS), route(async (req, res) => {
  const payment = db.getPayment(req.params.id);
  if (!payment?.slip_path) throw new HttpError(404, 'No slip attached to this payment.');
  const file = await readPaymentSlip(payment.slip_path);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${(payment.slip_name || 'slip').replace(/[^\w.-]+/g, '_')}"`);
  res.send(file.buffer);
}));

app.get('/api/deliveries', allow(...ORDER_PROCESSORS), route((_req, res) => {
  res.json(db.getDeliveryHandovers());
}));

// -----------------------------------------------------------------------------
// Social media post planning
// -----------------------------------------------------------------------------
app.get('/api/social-posts', route((_req, res) => {
  res.json(db.getSocialPosts());
}));

app.post('/api/social-posts', allow(...CONTENT_TEAM), route(async (req, res) => {
  res.status(201).json(await db.createSocialPost(req.body || {}));
}));

app.put('/api/social-posts/:id', allow(...CONTENT_TEAM), route(async (req, res) => {
  res.json(await db.updateSocialPost(req.params.id, req.body || {}));
}));

// -----------------------------------------------------------------------------
// Product photo uploads
// -----------------------------------------------------------------------------
app.post('/api/uploads', allow(...STOCK_MANAGERS, 'marketing'), route(async (req, res) => {
  const url = await saveProductImage(String(req.body?.data || ''));
  res.status(201).json({ url });
}));

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  if (err instanceof StoreConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Errors from express.static and friends carry their own HTTP status (e.g. 404)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 600 && !err.message?.includes('Supabase')) {
    res.status(err.status).json({ error: err.status === 404 ? 'Not found.' : err.message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }
  // Validation errors thrown by the data layer are user-facing 400s; storage failures are 500s
  const isStorageFailure = /Supabase app_state|Supabase Storage|ENOSPC|EACCES|EROFS/.test(String(err?.message || ''));
  if (isStorageFailure) console.error('[API] Storage error:', err);
  res.status(isStorageFailure ? 500 : 400).json({ error: err?.message || 'Request failed.' });
});

// -----------------------------------------------------------------------------
// DEV / PROD SERVER MOUNT
// -----------------------------------------------------------------------------
function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const envPort = parseInt(process.env.PORT || '', 10);
  // Cloud Run / AI Studio set PORT=8080 for their reverse proxy, which forwards to 3000
  if (!isNaN(envPort) && envPort > 0 && envPort !== 8080) return envPort;
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return '0.0.0.0';
}

async function startServer() {
  const PORT = getPort();
  const HOST = getHost();

  if (process.env.NODE_ENV !== 'production') {
    // The Vite dev server serves files from the project folder: never let it hand out
    // the local database, private slips, server code or environment files.
    app.use((req, res, next) => {
      if (/^\/(data|server|supabase|\.env|\.git|\.vercel)(\/|$|\.)/i.test(decodeURIComponent(req.path))) {
        res.status(404).end();
        return;
      }
      next();
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  await db.sync();
  console.log(`[Hali e-shop] Storage backend: ${db.storageBackend}`);

  app.listen(PORT, HOST, () => {
    console.log(`[Hali e-shop] Management server active at http://${HOST}:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

export default app;
