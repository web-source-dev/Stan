# Environment Variables — Complete Setup Guide

This document lists **every environment variable** used by CreatorStore (backend + frontend), whether it is required, what it does, and **step-by-step instructions** for obtaining each value.

---

## Quick start (local development)

```bash
# From the project root (e:\stan or wherever you cloned the repo)

# 1. Copy example files
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 2. Generate JWT secrets (run twice — use one output for each secret)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Edit backend/.env — at minimum set:
#    MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 4. Edit frontend/.env.local — usually leave defaults for local dev:
#    NEXT_PUBLIC_API_URL=http://localhost:4000

# 5. Install & run
cd backend  && npm install && npm run dev    # http://localhost:4000
cd frontend && npm install && npm run dev    # http://localhost:3000
```

**Minimum to run locally:** MongoDB + two JWT secrets. Everything else is optional in development.

---

## Where files live

| App        | Example file                    | Your file (git-ignored)     |
|------------|---------------------------------|-----------------------------|
| Backend    | `backend/.env.example`          | `backend/.env`              |
| Frontend   | `frontend/.env.local.example`   | `frontend/.env.local`       |

> **Never commit** `.env` or `.env.local` — they contain secrets.

---

## Backend variables (`backend/.env`)

Validated on startup in `backend/src/config/env.ts`. The server **will not start** if required values are missing or invalid.

### Summary table

| Variable | Required? | Default | Purpose |
|----------|-----------|---------|---------|
| `NODE_ENV` | No | `development` | `development` \| `test` \| `production` |
| `PORT` | No | `4000` | API port |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed frontend origins (comma-separated) |
| `APP_URL` | No | `http://localhost:3000` | Public frontend URL (links in emails) |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **Yes** | — | Signs short-lived access tokens (≥ 16 chars) |
| `JWT_REFRESH_SECRET` | **Yes** | — | Signs refresh tokens (≥ 16 chars) |
| `ACCESS_TOKEN_TTL` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | No | `30` | Refresh cookie lifetime (days) |
| `COOKIE_SECURE` | No | `false` | Set `true` in production (HTTPS only cookies) |
| `CLOUDINARY_CLOUD_NAME` | No | empty | Image/file uploads |
| `CLOUDINARY_API_KEY` | No | empty | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | empty | Cloudinary API secret |
| `RESEND_API_KEY` | No | empty | Transactional email delivery |
| `EMAIL_FROM` | No | `CreatorStore <onboarding@example.com>` | From address for emails |
| `STRIPE_SECRET_KEY` | No | empty | Real payments |
| `STRIPE_WEBHOOK_SECRET` | No | empty | Stripe webhook signature verification |
| `ANTHROPIC_API_KEY` | No | empty | Stanley AI assistant (full chat) |
| `ASSISTANT_MODEL` | No | `claude-sonnet-4-6` | Anthropic model id for assistant |

---

### Core — step by step

#### `NODE_ENV`
- **Local dev:** `development`
- **Production:** `production`
- No signup needed — set manually in `.env`.

#### `PORT`
- **Local dev:** `4000` (matches frontend default API URL)
- **Production:** whatever your host uses (often `4000` behind a reverse proxy)

#### `CORS_ORIGINS`
- **Local dev:** `http://localhost:3000`
- **Production:** your live frontend URL(s), comma-separated  
  Example: `https://app.yourdomain.com,https://www.yourdomain.com`

#### `APP_URL`
- **Local dev:** `http://localhost:3000`
- **Production:** `https://app.yourdomain.com` (used in verification/reset email links)

---

### MongoDB — `MONGODB_URI` (REQUIRED)

#### Option A: Local MongoDB (easiest for dev)

1. **Install MongoDB Community**  
   - Windows: https://www.mongodb.com/try/download/community  
   - Or use Docker:
     ```bash
     docker run -d --name mongo -p 27017:27017 mongo:7
     ```

2. **Use this URI in `backend/.env`:**
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/creatorstore
   ```

3. **Seed demo data (optional):**
   ```bash
   cd backend
   npm run seed
   ```

#### Option B: MongoDB Atlas (cloud — good for production)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a **free M0 cluster** (any cloud region).
3. **Database Access** → Add user with password (save the password).
4. **Network Access** → Add IP: `0.0.0.0/0` for dev, or your server IP for production.
5. **Database** → Connect → **Drivers** → copy the connection string.
6. Replace `<password>` with your user password and set a database name:
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/creatorstore
   ```

---

### Auth / JWT (REQUIRED)

#### `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`

Each must be **at least 16 characters**. Use **different** values for access vs refresh.

**Generate (Node.js — run twice):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example `backend/.env`:
```env
JWT_ACCESS_SECRET=a1b2c3d4e5f6...64_hex_chars...
JWT_REFRESH_SECRET=f6e5d4c3b2a1...different_64_hex_chars...
```

#### `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS`
- Defaults are fine for most setups (`15m` / `30` days).

#### `COOKIE_SECURE`
- **Local dev:** `false` (HTTP localhost)
- **Production (HTTPS):** `true`

---

### Cloudinary — uploads (OPTIONAL)

Needed for: product covers, avatars, course videos, fulfilment files.  
If blank → upload signing returns 503; you can paste image URLs manually.

1. Sign up: https://cloudinary.com/users/register/free
2. Open the **Dashboard** after login.
3. Copy from the dashboard home:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET` (click “Reveal”)

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_api_secret
```

---

### Resend — email (OPTIONAL)

Needed for: verification emails, receipts, broadcasts, email flows.  
If blank in **non-production** → emails are **logged to the backend console** and email verification is bypassed.

1. Sign up: https://resend.com/signup
2. **API Keys** → Create API Key → copy key:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```
3. **Domains** → Add your domain and verify DNS (production), **or** for testing use Resend’s sandbox `onboarding@resend.dev`:
   ```env
   EMAIL_FROM="CreatorStore <onboarding@resend.dev>"
   ```
4. For production with your domain:
   ```env
   EMAIL_FROM="CreatorStore <hello@yourdomain.com>"
   ```

---

### Stripe — payments (OPTIONAL)

If blank in **development** → **demo checkout** simulates a successful purchase (full flow testable without Stripe).  
In **production**, real sales require Stripe keys.

1. Sign up: https://dashboard.stripe.com/register
2. Stay in **Test mode** (toggle top-right) for development.
3. **Developers → API keys**:
   - **Secret key** → `STRIPE_SECRET_KEY`  
     Example: `sk_test_51...`
4. **Developers → Webhooks** → Add endpoint:
   - Local: use [Stripe CLI](https://stripe.com/docs/stripe-cli):
     ```bash
     stripe listen --forward-to localhost:4000/webhooks/stripe
     ```
     Copy the `whsec_...` signing secret → `STRIPE_WEBHOOK_SECRET`
   - Production: URL `https://api.yourdomain.com/webhooks/stripe`, select events your app handles, copy signing secret.

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

5. **Connect** (creator payouts): complete Stripe Connect setup in the dashboard when you enable creator payouts in Settings → Payments.

---

### Anthropic — Stanley AI assistant (OPTIONAL)

If blank → assistant uses a **deterministic fallback** that reads your store data (no free-form AI chat).

1. Sign up: https://console.anthropic.com/
2. **API Keys** → Create Key → copy:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Optional model override:
   ```env
   ASSISTANT_MODEL=claude-sonnet-4-6
   ```

---

### Meta / Instagram — AutoDM (OPTIONAL)

If `META_APP_ID`/`META_APP_SECRET` are blank → the AutoDM keyword engine still runs in **simulation mode** (rules match and replies are logged via the "Test" button), but no live OAuth/webhook/Graph delivery happens. With credentials set, "Connect Instagram" runs real Facebook OAuth and replies are delivered through the Graph API in response to webhook events.

**Prerequisites:** an Instagram **Business/Creator** account linked to a **Facebook Page**, and a Meta developer app.

1. Create an app at https://developers.facebook.com/ → **Create App** → type **Business**.
2. Add products: **Facebook Login** and **Instagram** (Instagram Graph API / messaging).
3. **App settings → Basic**: copy **App ID** → `META_APP_ID`, **App Secret** → `META_APP_SECRET`.
4. **Facebook Login → Settings → Valid OAuth Redirect URIs**: add exactly
   `http://localhost:4000/api/integrations/instagram/callback` (or your production URL) → `META_OAUTH_REDIRECT_URI`.
5. **Webhooks** → subscribe the **Instagram** object to the `messages` and `comments` fields:
   - Callback URL: `https://YOUR_PUBLIC_HOST/webhooks/instagram` (localhost is not reachable by Meta — use a tunnel such as `ngrok http 4000`).
   - Verify token: any string; put the **same** value in `META_WEBHOOK_VERIFY_TOKEN`.
6. Add the required permissions in App Review: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_manage_metadata`. (In dev mode they work for app roles/testers without full review.)

```env
META_APP_ID=...
META_APP_SECRET=...
META_GRAPH_VERSION=v21.0
META_OAUTH_REDIRECT_URI=http://localhost:4000/api/integrations/instagram/callback
META_WEBHOOK_VERIFY_TOKEN=your-chosen-verify-string
```

> **Test without Meta:** on `/dashboard/autodm`, create a rule and click **Test** — the engine matches the keyword, composes the reply, and increments the trigger count (delivery shown as *simulated*).

---

## Frontend variables (`frontend/.env.local`)

Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

### Summary table

| Variable | Required? | Default | Purpose |
|----------|-----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | No* | `http://localhost:4000` | Backend API base URL |
| `NEXT_PUBLIC_STAN_AFFILIATE_JOIN_URL` | No | `https://join.stan.store` | Base URL for Stan affiliate product links |

\*Not required locally (default works if API runs on port 4000).

---

### `NEXT_PUBLIC_API_URL`

**Local development:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Production:**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**How to set:**
1. Copy `frontend/.env.local.example` → `frontend/.env.local`
2. Set the URL where your backend is reachable from the **user’s browser**
3. Restart the Next.js dev server after changes (`npm run dev`)

> Must match a origin listed in backend `CORS_ORIGINS`.

---

### `NEXT_PUBLIC_STAN_AFFILIATE_JOIN_URL`

Used when creators add a **Stan Affiliate Link** product — builds URLs like `{base}/{username}`.

**Default (no env needed):** `https://join.stan.store`

**Override only if** you use a different affiliate program base URL:
```env
NEXT_PUBLIC_STAN_AFFILIATE_JOIN_URL=https://join.stan.store
```

---

## Production checklist

### Backend (`backend/.env`)

```env
NODE_ENV=production
PORT=4000
CORS_ORIGINS=https://app.yourdomain.com
APP_URL=https://app.yourdomain.com
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<strong-random-64-chars>
JWT_REFRESH_SECRET=<different-strong-random-64-chars>
COOKIE_SECURE=true
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
EMAIL_FROM="Your App <hello@yourdomain.com>"
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...   # optional
```

### Frontend (`frontend/.env.local` or host env)

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_STAN_AFFILIATE_JOIN_URL=https://join.stan.store
```

### Deploy notes

1. Set env vars in your host (Vercel, Railway, Render, Docker, etc.) — same names as above.
2. Backend and frontend must agree on URLs (`CORS_ORIGINS` ↔ frontend domain, `NEXT_PUBLIC_API_URL` ↔ backend domain).
3. Use **HTTPS** in production and set `COOKIE_SECURE=true`.
4. Use **live** Stripe keys (`sk_live_`) only in production.

---

## Verify everything works

| Check | How |
|-------|-----|
| Backend boots | `cd backend && npm run dev` — no “Invalid environment configuration” error |
| MongoDB | Seed: `npm run seed` — login as `maya@demo.com` / `Password123!` |
| Frontend → API | Open http://localhost:3000 — dashboard loads (not stuck on loader) |
| Uploads | Settings or product editor → upload image (needs Cloudinary) |
| Email | Signup with new email — check Resend dashboard or backend console logs |
| Payments | Buy on public store — Stripe test card `4242 4242 4242 4242` or demo checkout without Stripe |
| AI assistant | Dashboard chat — full AI needs `ANTHROPIC_API_KEY` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Server exits on start | Read error — usually `MONGODB_URI` missing or JWT secrets &lt; 16 chars |
| Frontend stuck loading | Backend not running or wrong `NEXT_PUBLIC_API_URL` |
| CORS errors in browser | Add frontend URL to backend `CORS_ORIGINS` |
| Uploads fail with 503 | Set all three `CLOUDINARY_*` variables |
| Emails not received | Set `RESEND_API_KEY`; verify `EMAIL_FROM` domain in Resend |
| Checkout always demo mode | Set `STRIPE_SECRET_KEY` (and use test/live mode appropriately) |
| Env change not applied | Restart dev servers; for Next.js, restart after editing `.env.local` |

---

## Reference: example minimal `.env` files

### `backend/.env` (local minimum)

```env
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:3000
APP_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/creatorstore
JWT_ACCESS_SECRET=replace-with-output-of-crypto-randomBytes-32
JWT_REFRESH_SECRET=replace-with-second-different-random-string
COOKIE_SECURE=false
```

### `frontend/.env.local` (local minimum)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Related files in this repo

- `backend/.env.example` — backend template
- `backend/src/config/env.ts` — validation schema (source of truth for backend)
- `frontend/.env.local.example` — frontend template
- `frontend/src/lib/api.ts` — uses `NEXT_PUBLIC_API_URL`
- `README.md` — install, seed, and demo accounts
