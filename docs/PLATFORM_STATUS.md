# CreatorStore — Platform status

Where the product stands today: what is **implemented and working**, what is **partial** (needs configuration or polish), and what **still needs to be built or improved**.

Last updated: June 2026

---

## At a glance

| Area | Status | Notes |
|------|--------|-------|
| Store builder & publish | ✅ Done | Templates, sections, live preview, publish flow |
| Digital products | ✅ Done | Create, sell, fulfil, buyer access |
| Courses | ✅ Done | Lessons, enrollments, learn portal |
| Bookings / calendar | ✅ Done | Free + paid, reminders, manage link |
| CRM / Customers | ✅ Done | Leads, import, customer profiles |
| Income dashboard | ✅ Done | Revenue, Stripe balance, orders, CSV — see [INCOME.md](./INCOME.md) |
| Analytics | ✅ Done | Visits, funnel, top products, date ranges |
| Email (transactional) | ✅ Done | 16 templates, job runner, Resend delivery |
| Email flows & broadcasts | ✅ Done | Drip on purchase/lead/booking, segments |
| Creator email notifications | ✅ Done | Sale, booking, fulfillment, lead toggles |
| Stripe Connect checkout | ✅ Done | Real payments when keys + Connect complete |
| Demo checkout (dev) | ✅ Done | Full flow without Stripe keys |
| Platform billing (creator → Stan) | ✅ Done | Free / Pro / Premium UI + Stripe or demo |
| 2FA (creator accounts) | ✅ Done | Email OTP + authenticator app |
| Customer portal | ✅ Done | Per-store + global buyer portal |
| Landing pages | ✅ Done | Create, publish, link products |
| Referrals | ✅ Done | Share link, code, earnings calculator |
| AutoDM | ✅ Done | Live OAuth + webhooks + Graph API; simulation without Meta keys |
| PayPal checkout | ✅ Done | Live REST capture, platform fees, webhooks; demo without platform keys |
| Membership / subscriptions (buyers) | ✅ Done | Stripe recurring checkout, renewals, cancel emails |
| Custom product fulfillment UI | ✅ Done | In-dashboard deliver workflow; buyer pending/delivered access page; emails |
| Payment plans (installments) | ✅ Done | Stripe subscription with cancel_at; monthly installments |
| Affiliate program | ✅ Done | `?aff=` attribution, commission ledger, dashboard payouts |
| Webinars | ✅ Done | Storefront block, slot registration, Stripe/PayPal checkout, confirmation emails, reminders, manage page |
| Email: membership cancel / recurring | ✅ Done | Webhook handlers + buyer/creator emails |ledgerledger
| Production email domain | ⚠️ Config | Needs verified domain in Resend (not code) |
| Dedicated email worker | ✅ Done | `npm run worker` / `start:worker`; set `JOB_RUNNER_IN_PROCESS=false` on API |

**Legend:** ✅ Working · ⚠️ Partial / config needed · ❌ Not implemented

---

## 1. Implemented and working
 
### Auth & account
- [x] Sign up, login, logout, refresh tokens
- [x] Email verification (bypassed in dev when Resend is off)
- [x] Password reset and “password changed” emails
- [x] **Two-factor authentication** — email code and/or authenticator (TOTP)
- [x] Session list + revoke single / revoke others
- [x] Account deactivation
- [x] Settings: Profile, Integrations, Billing, Payments, Email Notifications, Security

### Storefront & builder
- [x] Drag-style store builder with templates
- [x] Section editing, reorder, show/hide, duplicate
- [x] Theme (colors, fonts, header)
- [x] Publish / draft state
- [x] Public store at `/<username>`
- [x] Product cards, lead magnets, store content blocks

### Products & commerce
- [x] Product types: digital, lead magnet, custom, **membership** (recurring), URL media, affiliate link
- [x] Pricing: base price, discount price, discount codes
- [x] Order bumps at checkout (added to Stripe line items)
- [x] Custom fields on products (stored; shown at checkout)
- [x] Quantity limits and sold-out handling
- [x] Fulfilment: file download (Cloudinary) or external URL
- [x] Per-product confirmation email overrides
- [x] **Membership subscriptions** — Stripe Checkout `mode: subscription` (monthly/yearly), renewals, access revoke on cancel

### Memberships (buyer subscriptions)
- [x] Recurring Stripe Checkout on Connect (month / year)
- [x] `BuyerMembership` records linked to Stripe subscription id
- [x] Initial signup → order + entitlement + welcome email
- [x] Renewals via `invoice.paid` webhook → renewal orders + recurring payment email (toggle)
- [x] Cancel / end via `customer.subscription.deleted` → revoke entitlement + emails (toggle)
- [x] Auto-cancel after N months when configured on product
- [x] Demo mode simulates subscription checkout locally
- [x] PayPal blocked for memberships (card-only recurring)
- [x] Course CRUD, modules/lessons
- [x] Paid checkout → enrollment → learn link
- [x] Course enrollment email (dedicated template)
- [x] Progress tracking for buyers

### Bookings
- [x] Booking types with weekly availability windows
- [x] Free bookings (instant confirm) and paid bookings (checkout first)
- [x] Confirmation, 24h + 1h reminder emails
- [x] Cancel + refund-linked cancel
- [x] Dashboard calendar and list views
- [x] Creator notification on new booking

### Checkout & payments
- [x] Stripe Checkout on **Connect** connected accounts (products, courses, bookings)
- [x] Platform application fee on sales
- [x] Webhook: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `charge.refunded`, `account.updated`
- [x] Demo checkout when `STRIPE_SECRET_KEY` is unset (dev only)
- [x] **PayPal checkout** — live capture + platform fees + webhooks; demo when credentials unset
- [x] Dynamic return URLs (Settings → Payments after Connect)

### Income & orders
- [x] Order records for products, courses, bookings
- [x] 30-day revenue, fees, net revenue
- [x] Revenue chart (timeseries API)
- [x] Latest orders table with filters + CSV export
- [x] Stripe Connect balance: Available / Available Soon
- [x] Cash Out → Stripe Express dashboard login link
- [x] Pending-funds explanation in UI
- [x] Documentation: [INCOME.md](./INCOME.md)

### Analytics
- [x] Page views and funnel events
- [x] Visits, revenue, leads by date range
- [x] Conversion funnel and top products
- [x] Chart rendering (all plan tiers; advanced metrics on Pro+)

### Customers (CRM)
- [x] Lead capture from subscribe forms and purchases
- [x] Manual add + CSV import
- [x] Contact detail page with order history
- [x] Unsubscribe handling for marketing
- [x] GDPR marketing opt-in setting

### Email system
- [x] Resend integration with durable job queue
- [x] In-process job runner (retries, dedupe, stuck-job recovery) — default for local dev
- [x] **Dedicated worker process** — `npm run worker` / `npm run start:worker`; API enqueue-only via `JOB_RUNNER_IN_PROCESS=false`
- [x] **20 email templates** with responsive HTML design
- [x] Template preview gallery: Dashboard → Email → **Templates** tab (`/api/account/email-previews`)
- [x] Creator-branded From + Reply-To on buyer emails

| Template | Audience | When it sends |
|----------|----------|----------------|
| `email_verification` | Creator | Sign up |
| `login_code` | Creator | 2FA login |
| `password_reset` / `password_changed` | Creator | Auth |
| `purchase_receipt` | Buyer | Product purchase |
| `course_enrollment` | Buyer | Course purchase |
| `booking_confirmation` / `reminder` / `cancelled` | Buyer | Calendar |
| `customer_login_code` | Buyer | Portal / file access |
| `subscriber_welcome` | Buyer | List subscribe |
| `broadcast` | Buyer | Flows, broadcasts, custom copy |
| `lead_captured` | Creator | New subscriber |
| `creator_new_sale` | Creator | Paid product/course (toggle) |
| `creator_new_booking` | Creator | Booking confirmed (toggle) |
| `creator_fulfillment_needed` | Creator | Custom product sale (toggle) |
| `membership_welcome` | Buyer | Membership signup |
| `recurring_payment` | Buyer | Subscription renewal (toggle) |
| `membership_cancelled` | Buyer | Subscription ended |
| `membership_payment_failed` | Buyer | Subscription payment failed |
| `creator_membership_cancelled` | Creator | Member cancelled (toggle) |

- [x] Email flows (multi-step drip on purchase / lead / booking)
- [x] Broadcasts to segments (with unsubscribe)
- [x] Product-level email flow steps
- [x] Settings toggles wired for: purchase confirmations, calendar bookings, fulfillment orders, lead captured, **recurring payments**, **membership cancellations**

### Customer portals
- [x] Per-creator portal: `/<username>/account` (passwordless email code)
- [x] Global portal: all purchases across stores
- [x] Products, courses, bookings, order history in one UI

### Other features
- [x] Landing pages (create, edit, publish, product link)
- [x] Referral codes and share links
- [x] Media library (with Cloudinary)
- [x] Stanley AI assistant (Anthropic when keyed; fallback otherwise)
- [x] Platform subscription tiers (Free / Pro / Premium) with feature gating
- [x] Storage add-on packs (Stripe or demo)
- [x] **AutoDM** — Instagram keyword auto-replies (live with Meta keys, simulation without)
- [x] Seed data for demo account `maya@demo.com`

---

## 2. Partial — works with limits or needs setup

These features exist in code/UI but need **environment keys**, **creator onboarding**, or **more product work**.

### Integrations (configuration, not code)

| Integration | What you need | Current behavior without it |
|-------------|---------------|------------------------------|
| **Resend** | `RESEND_API_KEY`, verified `EMAIL_FROM` domain | Emails logged to backend console |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Connect onboarding | Demo checkout in dev |
| **Cloudinary** | `CLOUDINARY_*` | Uploads disabled; paste image URLs |
| **PayPal** | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`, creator email | Demo capture in dev |
| **Instagram AutoDM** | `INSTAGRAM_APP_*`, HTTPS redirect, webhook verify token | Rules match; replies simulated/logged |
| **Anthropic** | `ANTHROPIC_API_KEY` | Deterministic assistant fallback |

### Resend sandbox
If `EMAIL_FROM` uses `onboarding@resend.dev`, email **only delivers to the Resend account owner** until you verify your own domain.

### Stripe payouts
- **Total Revenue** in Income = orders in the database.
- **Available / Available Soon** = live Stripe Connect balance (settlement delay is normal).
- Cash Out opens Stripe Express; bank transfer is handled by Stripe.

### Payment plans
- Editor enables monthly installment count (2–12).
- Checkout creates a **Stripe Subscription** with `cancel_at` after N months.
- Each installment is charged monthly; buyer keeps access after the plan completes.
- PayPal is blocked for payment plans (card only).

### Order bumps
- Fully wired at checkout (extra Stripe line item).
- Buyer must opt in on checkout UI.

### Custom products (e.g. personalized video)
- Product kind + delivery promise text in editor.
- Buyer gets access flow; creator gets **fulfillment needed** email.
- **Missing:** dashboard UI to upload deliverable, mark order fulfilled, or message buyer.

### Membership products
- Sold as **Stripe Subscriptions** (monthly or yearly) via Connect checkout.
- Creator must add a **member access link** before publishing.
- Renewals and cancellations are handled via Stripe webhooks; access is revoked when the subscription ends.

### Affiliate program
- Enable on any product in the editor (commission %).
- Buyers arrive via `/<creator>/product/<slug>?aff=<affiliate_username>`.
- Commissions recorded on paid orders; creators mark payouts paid in **Affiliates** dashboard.
- Affiliates view their earnings at `/dashboard/affiliates`.

### Affiliate link products
- `stan_affiliate` product kind with redirect URL (separate from product affiliate sharing).

### Webinars
- Backend model + API + editor UI.
- Storefront **Webinars** block links to `/[username]/webinar/[slug]`.
- Slot registration with capacity limits; free or paid (Stripe / PayPal).
- Confirmation + reminder emails; manage page at `/webinar/[token]` (join link + replay).

### PayPal checkout
- Live REST Orders API: create → approve → capture on return page.
- Platform **application fee** (5%) collected via `payment_instruction.platform_fees`.
- Webhook fallback: `CHECKOUT.ORDER.APPROVED` auto-captures; refund events sync access revocation.
- Creators connect a PayPal payout email in Settings → Payments.
- Demo mode when platform credentials are unset (non-production).
- Blocked for memberships and payment plans (recurring card-only).

### AutoDM (Instagram)
- Keyword rules with comment→DM, public reply, post scoping, simulation test.
- **Live mode:** Instagram Login OAuth, signed webhooks, Graph API delivery.
- Token refresh job (worker) keeps long-lived tokens valid.
- **Simulation mode** when `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` unset.
- Dashboard shows Live vs Demo connection state; OAuth callback toasts.

### PayPal (live)
- Set `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`.
- Register webhook at `POST /webhooks/paypal`.
- Creator connects PayPal email in Settings.

### AutoDM (live)
- Set Instagram env vars; register OAuth redirect + webhook at `/webhooks/instagram`.
- Meta app review required for messaging + comment permissions.
- Public HTTPS API host required (use a tunnel in local dev).

### Job runner
- **Local dev:** in-process by default (`JOB_RUNNER_IN_PROCESS=true`).
- **Production:** API with `JOB_RUNNER_IN_PROCESS=false` + `npm run start:worker`.
- Processes: transactional emails, broadcast sends, booking reminders, subscription/booking maintenance sweeps.

---

## 3. Not implemented — needs to be built

Priority improvements for a more complete “Stan-style” platform:

### High impact

1. **Custom order fulfillment workflow**
   - Income/orders UI: mark as fulfilled, upload response file/video, notify buyer
   - Optional: fulfillment queue and SLA reminders

2. **True payment plans**
   - Stripe Payment Links / Subscription schedules or installment intents
   - Not just a checkout disclaimer

3. **Production email domain**
   - Verify domain in Resend; update `EMAIL_FROM`
   - Optional: per-creator custom sending domain

### Medium impact

5. **Webinars end-to-end** — ✅ Done (storefront, checkout, emails, manage page)

6. **PayPal Income reconciliation**
   - Show PayPal balances alongside Stripe in Income dashboard

9. **Manual fulfillment status**
   - Orders stay `fulfilled` automatically today; custom orders should stay `pending` until creator delivers

10. **Email improvements**
    - Test-send button from template gallery
    - Per-creator email analytics (opens/clicks via Resend webhooks)

### Lower priority / polish

11. **Admin panel** — `admin@demo.com` role exists; limited admin UI  
13. **Webinar / community** parity with Stan feature set  
14. **Mobile-optimized buyer checkout** — works but could be refined  
15. **Internationalization** — English only  
16. **Order bump / discount analytics** — breakdown in Income tab  

---

## 4. Feature map by dashboard area

| Dashboard | Route | Implemented | Gaps |
|-----------|-------|-------------|------|
| Home | `/dashboard` | Onboarding task cards | — |
| My Store | `/dashboard/storefront` | Builder, publish | — |
| Products | `/dashboard/products` | Full editor, kinds, memberships, payment plans, affiliate sharing | Automated affiliate payouts |
| Affiliates | `/dashboard/affiliates` | Earnings, sales, mark-paid, share links | Stripe Connect payout to affiliates |
| Courses | `/dashboard/courses` | Full CRUD, lessons | Subscription billing for courses |
| Appointments | `/dashboard/bookings` | Calendar, types, paid/free | — |
| Income | `/dashboard/orders` | Revenue, payouts, orders | Custom fulfillment actions |
| Analytics | `/dashboard/analytics` | Charts, funnel | Real-time vs cached |
| Customers | `/dashboard/leads` | CRM, import, export | Advanced segmentation |
| Email | `/dashboard/emails` | Flows, broadcasts, template preview | Test send, analytics |
| Referrals | `/dashboard/referrals` | Code, link, calculator | Payout automation |
| AutoDM | `/dashboard/autodm` | Rules, live OAuth, webhooks, simulation | TikTok delivery |
| Landing Pages | `/dashboard/landing` | CRUD, publish | — |
| Webinars | `/dashboard/webinars` | Editor | ✅ Storefront + checkout + manage page |
| Media | `/dashboard/media` | Library (Cloudinary) | — |
| Settings | `/dashboard/settings` | 6 tabs, 2FA, Connect, PayPal | Custom email domain |

---

## 5. Environment quick reference

```bash
# Minimum to run locally
MONGODB_URI=...
JWT_ACCESS_SECRET=...   # ≥ 16 chars
JWT_REFRESH_SECRET=...  # ≥ 16 chars
APP_URL=http://localhost:3000
PORT=5000

# Real email
RESEND_API_KEY=re_...
EMAIL_FROM="Your Brand <hello@yourdomain.com>"

# Real card payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...   # stripe listen --forward-to localhost:5000/webhooks/stripe

# File uploads
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

See [README.md](../README.md) and `ENV_SETUP.md` for the full list.

---

## 6. Suggested roadmap (recommended order)

1. **Verify Resend domain** — so all transactional email reaches real customers  
2. **Stripe Connect + webhooks in production** — real money path end-to-end  
3. **Custom fulfillment dashboard** — complete the personalized-product loop  
4. **Configure Meta app for AutoDM** — production Instagram keys + app review  
5. **Configure PayPal live** — platform credentials + webhook + creator payee emails  
6. **Webinars** — ✅ storefront registration, checkout, emails, manage page (Zoom/native streaming integrations still future)  

---

## Related docs

- [INCOME.md](./INCOME.md) — revenue vs Stripe balance, cash out, webhooks  
- [README.md](../README.md) — install, seed, demo accounts, system check  
