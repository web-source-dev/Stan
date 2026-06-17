# CreatorStore — Stan-style creator commerce platform

An all-in-one storefront for creators: a drag-style **store builder**, digital
products, courses, bookings, a customer CRM, income & analytics, referrals,
email broadcasts + automated flows, AutoDM, private landing pages, and account
billing.

- **Backend:** Node + Express + TypeScript + MongoDB (Mongoose)
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind

---

## 1. Prerequisites

- **Node.js 18+**
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI
- (Optional) Cloudinary, Resend, and Stripe accounts — the app runs fully without
  them in dev (uploads disabled, emails logged, checkout simulated).

---

## 2. Environment variables — where they go

| App | Copy from | To this file |
|-----|-----------|--------------|
| **Backend** | `backend/.env.example` | `backend/.env` |
| **Frontend** | `frontend/.env.local.example` | `frontend/.env.local` |

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

**Backend required values** (the server refuses to boot without them):
- `MONGODB_URI` — your Mongo connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — each ≥ 16 chars. Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**Optional integrations** (everything still works without them):
- `CLOUDINARY_*` — image/file uploads (blank → uploads disabled)
- `RESEND_API_KEY` + `EMAIL_FROM` — real email delivery (blank → emails logged to console)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — real payments (blank in dev → **demo checkout** simulates a paid purchase so the full flow is testable)

**Frontend:** `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

> **Full env guide:** see [ENV_SETUP.md](./ENV_SETUP.md) for every variable, how to obtain each key, and production checklist.

> Dev convenience: when `RESEND_API_KEY` is blank in non-production, the
> email-verification gate is bypassed, so you can publish a store without
> clicking a verification link.

---

## 3. Install, seed, run

```bash
# 1. Install
cd backend  && npm install
cd ../frontend && npm install

# 2. Seed demo data (from backend/)
cd ../backend && npm run seed          # first time
#   npm run seed:force                 # wipe & reseed

# 3. Run (two terminals)
cd backend  && npm run dev             # API on http://localhost:4000
cd frontend && npm run dev             # App on http://localhost:3000
```

Open **http://localhost:3000** and log in.

### Demo accounts (password `Password123!` for all)

| Email | Role | Notes |
|-------|------|-------|
| `maya@demo.com` | creator | **Published** store at `/maya`, fully populated |
| `alex@demo.com` | creator | Unpublished draft (test the publish flow) |
| `admin@demo.com` | admin | Admin role |

The seed populates Maya with: 2 products, 1 course (3 lessons), 1 booking type +
booking, 3 leads/customers, 3 orders, analytics events, 2 broadcasts, a referral
code (`maya20`), a post-purchase **email flow**, an **AutoDM** rule, a published
**landing page** (`/maya/p/black-friday`), and a trialing **subscription**.

---

## 4. System check — test every feature

Log in as **maya@demo.com**. Each dashboard nav item maps to a feature:

| Area | Where | What to verify |
|------|-------|----------------|
| **Home** | `/dashboard` | Welcome + "get ready to sell" task cards (theme/product show ✓ done) |
| **Store builder** | My Store → **Edit Design** | Click a **template** → whole layout changes (not just colors). Click any section in the live preview → edit its settings. Reorder ▲▼, show/hide, duplicate, delete. Change colors/fonts/header. Cards show real products + image placeholders. **Save & Publish** → status flips to Published. |
| **Products** | My Store → Products (or `/dashboard/products`) | Create / edit / publish / duplicate / archive. Cover image + fulfilment file upload (needs Cloudinary). |
| **Landing Pages** | My Store → Landing Pages | Create (publishes immediately) → **Open** link works. Edit, link a product, unpublish. |
| **Public store** | `/maya` | Renders the exact builder design (font, colors, section order, cards). |
| **Income** | `/dashboard/orders` | Revenue chart, payout panel, Latest Orders with filter chips, Download CSV. |
| **Analytics** | `/dashboard/analytics` | Date-range chips (7/14/30d), Visits/Revenue/Leads, conversion funnel. |
| **Customers** | `/dashboard/leads` | CRM table + filter chips. **Add Contacts** (manual + CSV import). Export CSV. |
| **Appointments** | `/dashboard/bookings` | Month calendar + Calendar/List toggle; Session types tab to create availability. |
| **Referrals** | `/dashboard/referrals` | Share link + copy, earnings calculator slider, regenerate code. |
| **Email Flows** | `/dashboard/emails` | **Flows** tab: create a multi-step drip (fires on purchase/signup — see §5). **Broadcasts** tab: send to a segment. |
| **AutoDM** | `/dashboard/autodm` | Connect Instagram (demo), create keyword rules, pause/delete. |
| **Settings** | `/dashboard/settings` | 6 tabs: Profile, Integrations, Billing (switch Monthly/Yearly/Bundle), Payments (Stripe Connect), Email Notifications (toggles persist), Security (2FA, sessions, delete). |
| **Customer portal** | `/<username>/account` | Passwordless buyer login (email → 6-digit code). Shows everything the buyer purchased — products (download), courses (progress + continue), bookings (manage/join), and order history — in one place. Linked from the bottom of each public store. |

### End-to-end purchase (demo checkout)
With Stripe unconfigured, dev checkout simulates a paid order:
1. Open `/maya`, click **Buy now** on a product → complete the simulated checkout.
2. The buyer gets an access link, the order appears under **Income**, the buyer
   is added to **Customers** (with their name + running Purchases/Spent totals),
   and any enabled **purchase** email flow fires.
3. The buyer can revisit everything at `/<username>/account` — sign in with the
   checkout email and the 6-digit code (in dev the code is returned in the API
   response / logged to the backend console, so no inbox is needed).

---

## 5. What actually runs vs. needs integration

Everything works in dev; some delivery requires keys:

- ✅ **Fully working in dev:** store builder + publish, products/courses/bookings,
  demo checkout → order → entitlement/enrollment, CRM + CSV import, analytics,
  referrals, subscription/billing UI, landing pages, account settings.
- ✉️ **Email broadcasts + flows** are real: they enqueue durable jobs processed
  by the in-process job runner. **Flows fire automatically** on purchase
  (product/course) and on new lead capture — day-0 immediately, later steps
  scheduled by `dayOffset`. Delivery uses **Resend** when `RESEND_API_KEY` is set;
  otherwise each email is **logged to the backend console**.
- 💳 **Real payments/payouts** need `STRIPE_SECRET_KEY` + Connect onboarding.
- 📷 **Uploads** need Cloudinary keys.
- 📱 **AutoDM** stores keyword rules; live sending requires an Instagram/Meta
  integration (the connect button is a demo placeholder).

---

## 6. Useful commands

```bash
# Backend (from backend/)
npm run dev          # start API (tsx watch)
npm run typecheck    # tsc --noEmit
npm run seed         # seed demo data
npm run seed:force   # wipe & reseed
npm run build        # compile to dist/
npm start            # run compiled build

# Frontend (from frontend/)
npm run dev          # start Next dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```

> Tip: don't run `next build` while `next dev` is running on the same checkout —
> it overwrites `.next` and corrupts the dev server cache (clear `.next` and
> restart if you see `Cannot find module './XXX.js'`).

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| App stuck on a full-screen loader | Backend not running. Start `npm run dev` in `backend/`. (Requests time out after 15s and fall back to the login page.) |
| "View live" shows 404 | The store is a **Draft**. Open My Store → Edit Design → **Save & Publish**. |
| Server refuses to boot | A required env var is missing/short — check `MONGODB_URI` and the two JWT secrets (≥16 chars). |
| Emails not arriving | `RESEND_API_KEY` is blank → emails are logged to the backend console, not sent. |
| Uploads fail | `CLOUDINARY_*` not set → uploads disabled; paste an image URL instead. |
| `dup key … username: "alex"` on reseed | Fixed — use `npm run seed:force`. |
