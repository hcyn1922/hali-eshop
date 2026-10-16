# Hali e-shop · Operations console

Internal operations app for **Hali e-shop**, an online boutique in the Maldives. Staff record orders that come in on **Instagram, Viber, WhatsApp and SMS**, track wholesale purchase batches and live stock, hand parcels to couriers, collect payments and plan social posts. Every role sees only what it needs.

Works on computers and phones (installable-feeling mobile layout with a bottom tab bar), in light and dark mode.

---

## What it does

| Area | Highlights |
| :--- | :--- |
| **Dashboard** | Recorded sales, gross profit (owner), orders in progress, stock and low-stock alerts, 14-day sales chart, "needs attention" list. |
| **Orders** | Board (New → Packed → With courier → Delivered) and list views. Multi-item orders with a Maldives address builder (Malé, Hulhumalé, Vilimalé, islands by boat). Courier handover with the courier's name, payments with BML references, delivered/failed/cancelled, and an explicit **return to stock** once goods are physically back. Branded invoice image to share, download or print. |
| **Buyers** | Directory with addresses, Instagram handles, order history and lifetime spend. |
| **Products & stock** | Catalog with shop, brand, model and size, photos, purchase batches (landed cost incl. freight), an **immutable stock ledger** (received / sold / returned / corrected) and verified stock corrections. Stock can never go below zero. |
| **Pricing** (owner) | Shop-price calculator (shop price − our discount = wholesale cost, or enter the wholesale price and get the shop price; market price → market margin, our margin → selling price, change the final price and set it on a product; profit per sale after a normal delivery rate and on the stock in hand; margins and the delivery rate are remembered), markup-on-cost vs gross-margin calculator, per-product pricing, bulk updates with preview, optional 8% GST and rounding. |
| **Reports** (owner) | Sales and profit by period, top products and buyers, sales by channel, payments, delivery fees vs courier charges, 8% GST estimate, stock value, CSV export and print. |
| **Shops** | Your storefronts (Hali eshop and Time Nest to start). Every product belongs to one shop; the Products page has a tab per shop. Add, rename or remove shops under Business → Shops (people who can manage products). |
| **Suppliers & couriers** | Suppliers, categories and courier services with their usual charges. |
| **Social posts** | Plan posts per product with caption, image, date, status and the live link. |
| **AI studio photos** | Turn a snapshot of a product into professional 4:5 studio photos. The AI first describes the product and copies its label text; staff correct it, approve, then pick which of the photos to keep. Daily limit per person. |
| **Staff & access** (owner) | Add staff, approve sign-up requests, change roles, reset passwords, deactivate or delete accounts. |
| **Owner emails** | The owner gets an email for every new order, every delivered order and every new staff access request. |

### Money rules

- **Gross profit = Σ (selling price − captured unit cost) × quantity.** Delivery fees are kept out of product margins.
- The unit cost and selling price are **copied onto each order line** when the order is created, so later supplier price changes never rewrite history.
- Cancelled, failed and returned orders and historical opening adjustments are **not** counted as sales.
- Pricing formulas: markup `cost × (1 + markup% ÷ 100)`, margin `cost ÷ (1 − margin% ÷ 100)`.

### Roles & permissions (enforced by the server on every request)

The owner decides what each role can do in **Staff & access → Roles & permissions**: pick Sales, Inventory lead or Marketing and switch features on or off, then **Save**. Changes apply to the server immediately and to staff screens the next time they open the app. **Reset to standard** restores the defaults below.

| Role | Standard permissions |
| :--- | :--- |
| **Owner / Admin** | Everything (cannot be limited). |
| **Sales** | See, create and process orders; record payments and slips; see and edit buyers; manage couriers. |
| **Inventory lead** | See and process orders; return goods to stock; see buyers; manage couriers, products, stock and suppliers; see shop sales totals. |
| **Marketing** | Plan social posts; see shop sales totals. |

Switchable features: see orders, create orders, process orders, record payments, return goods to stock, see buyers, add/edit buyers, manage couriers, manage products & stock, see suppliers, manage suppliers, plan social posts, see shop sales totals, see costs & profit, pricing, reports, order emails (off for every role as standard). Turning one on also turns on what it needs (for example, *Reports* needs *See costs & profit*). Costs and margins are removed by the server for any role without *See costs & profit*.

Always owner-only: staff management, sign-up approvals, shop details, email setup, sample data and deleting couriers.

Self-registration can never grant owner access, and sign-ups wait for the owner's approval unless the owner switches on automatic approval.

---

## Run it on your computer

Requires [Node.js 22](https://nodejs.org).

```bash
npm install
cp .env.example .env     # optional for local use
npm run dev
```

Open <http://localhost:3000>. Locally the data lives in `data/hali_shop_db.json` (not committed) and these **demo accounts** are created (they never exist on a live site):

| Email | Password | Role |
| :--- | :--- | :--- |
| `owner@hali.mv` | `HaliAdmin2026!` | Owner / Admin |
| `sales@hali.mv` | `Sales2026!` | Sales |
| `inventory@hali.mv` | `Inventory2026!` | Inventory lead |
| `marketing@hali.mv` | `Marketing2026!` | Marketing |

Use **Load sample inventory** on the dashboard (owner) to add Poise Perfume, Bonita perfume, Moonlight perfume and Nivea lotion 50 ml.

Useful commands: `npm run lint` (type check) and `npm run build` (production build).

---

## Going live: fresh GitHub, Supabase and Vercel

Do these in order when you are happy with the system. Each step only takes a few minutes.

### 1. GitHub repository

The code lives in the private repository **hcyn1922/hali-eshop**. Vercel deploys from its `main` branch.

### 2. Create the Supabase project

1. Sign in at <https://supabase.com> → **New project**.
2. Name `hali-eshop`, a strong database password (save it in your password manager), region **Southeast Asia (Singapore)**, closest to the Maldives.
3. When the project is ready, open **SQL Editor → New query**, paste the whole of [`supabase/migrations/20261010_app_state.sql`](supabase/migrations/20261010_app_state.sql) and click **Run**. This creates:
   - the `app_state` table that holds the shop database (only the server's secret key can read it), and
   - the public `product-images` storage bucket for product photos.
4. Open **Project Settings → API keys** (or the **Connect** button) and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable / anon key** → `VITE_SUPABASE_ANON_KEY`
   - **Secret / service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this one private)
5. Open **Authentication → Sign In / Providers → Email** and keep **Confirm email** switched **on**. It proves staff own the email they sign in with.
6. Once you know the site address (step 3), open **Authentication → URL Configuration** and set **Site URL** to it so password-reset emails link back to the app.

### 3. Deploy on Vercel

1. Sign in at <https://vercel.com> with your GitHub account → **Add New → Project** → import the new repository.
2. Leave the framework settings as detected. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from step 2)
   - `HALI_OWNER_EMAIL`: your email (the primary owner)
   - `HALI_OWNER_PASSWORD`: a long password for your first sign-in (optional if you will use a Supabase account for that email)
   - `HALI_IMPORT_SEED=true` **only** if you want to bring over the catalog and orders in `data/seed.json` from the previous system; remove it again after the first visit.
3. Click **Deploy**. Open the site, sign in as the owner, then go to **Settings → Setup** to check everything is green and **Settings → Shop details** to fill in the invoice details.
4. Optional: **Project → Settings → Domains** to add a custom domain such as `orders.hali.mv`, then add the CNAME record it shows at your domain registrar.

### 4. Turn on owner email notifications (optional)

1. Create a free account at <https://resend.com> **using the same email as `HALI_OWNER_EMAIL`** (Resend's test sender can only deliver to that address until you verify a domain).
2. Go to **API Keys → Create API key** (permission: *Sending access*) and copy the key.
3. In Vercel → **Settings → Environment Variables** add `RESEND_API_KEY` with that key, then **Redeploy**.
4. In the app, open **Settings → Setup** and click **Send a test email**.
5. Later, to send from your own address (e.g. `orders@hali.mv`) or to another inbox, verify your domain in Resend → **Domains**, then set `MAIL_FROM` (and `NOTIFY_EMAIL` if it should go elsewhere).
6. **Staff order emails:** switch on **Order emails** for a role in **Roles & permissions** and everyone in that role also gets the new-order and delivered emails at their sign-in address (one email each, so nobody sees the others' addresses). This needs step 5 (a verified domain and `MAIL_FROM`); until then only the owner is emailed. If Resend refuses the staff copies, the owner's email is still sent.

### 5. Turn on AI studio photos (optional)

1. Create an account at <https://platform.openai.com>, add a payment method under **Billing**, and set a monthly budget limit there.
2. Go to **API keys → Create new secret key** and copy it.
3. In Vercel → **Settings → Environment Variables** add `OPENAI_API_KEY` with that key, then **Redeploy**.
4. Optional: change `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` or `AI_PHOTO_DAILY_LIMIT` (see `.env.example`).
5. In the app, **Settings → Setup** shows AI photos as on. Open a product → **Edit** → **Photos → Make AI studio photos**.

How it works: the photo goes to the inspect model, which reports the product and every word on it. Staff check and correct that report (this is the approval step), choose up to four views, and click **Proceed**. One photo is made per view and saved to the `product-images` bucket. The wording of the instructions lives in `server/aiPhotoPrompt.ts`.

**Free alternative without an API key:** the Photos section also has **Make studio photos in ChatGPT**. It fills in the master prompt (product name, background, lighting, layout), copies it and opens ChatGPT. Staff attach the product photo there, check ChatGPT's description, reply *Proceed*, then add the downloaded photos with **Add photo**. It uses the staff member's own ChatGPT account and its daily image limits. The prompt text lives in `src/lib/chatgptPrompt.ts`.

Photos can take one to two minutes, so the API function is allowed up to 300 seconds (`vercel.json`). This needs Vercel's Fluid compute, which is on by default for new projects.

### 6. Add your team

In **Staff & access → Add staff**, enter each person's name, email and role, and either give them a starting password or invite the same email from Supabase (**Authentication → Users → Invite user**). People can also use **Request access** on the sign-in page; you approve them on the **Requests** tab.

---

## How it is built

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router and TanStack Query. Design follows the Untitled UI system in the Hali brand colours (navy `#0F1736`, coral `#EB3A41`).
- **Server:** Express (`server.ts`) runs as one Vercel function (`api/index.ts`). All business rules (stock checks, order transitions, cost redaction, role checks) live in `server/db.ts` and `server/auth.ts`.
- **Storage:** the whole shop database is one versioned JSON document. Locally it is a file; in production it is the Supabase `app_state` row. Each save is a compare-and-swap on the version number, so two simultaneous changes can never overwrite each other (the second gets "please retry"). Product photos go to Supabase Storage.
- **Privacy:** bank transfer slips are stored in a **private** bucket and only streamed to signed-in owner/sales staff. Invoices strip every web address before they are rendered, and map pin links are kept separate from the printed address.
- **SKUs:** assigned automatically as a running number (`H0001`, `H0002`, …) and never change.
- **Sign-in:** shop passwords (scrypt-hashed, sessions stored server-side) or Supabase Auth. Either way the role comes from the staff profile on the server.

### Addresses without Google

Address suggestions come from a built-in list of Malé and Hulhumalé streets, Hulhumalé buildings and lots, all atolls and inhabited islands, cargo jetties, and every address you have used before. For pin-point locations, paste a Google Maps or WhatsApp location link into **Map pin link** on the order. Couriers tap it to navigate.

| Integration | Status |
| :--- | :--- |
| Supabase Postgres + Storage | Ready; needs the keys above. |
| Supabase Auth (password reset emails) | Ready; optional. |
| OpenAI (AI studio photos) | Ready; optional, needs `OPENAI_API_KEY`. |
| Instagram / Viber / WhatsApp | Orders are entered manually from DMs. |
| BML payments | Staff record the transfer reference against the order. |
