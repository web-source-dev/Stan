# Stan Store Clone — Implementation Plan

Derived from the 22 reference screenshots in `frontend/public/inspiration/` (Stan v2 admin).
Goal: bring `E:\stan` (Next.js 15 + Express/Mongo) to feature + visual parity with Stan Store,
matching the reference look closely.

> Decisions locked in: **start with the design system**, **match Stan's look closely**.

---

## Design language (from the screenshots)

| Element | Spec |
|---|---|
| Shell | Fixed left sidebar on light lavender tint (`~#eef0ff` = `brand-50`), white content canvas |
| Brand accent | Indigo/violet `#5b54e8` (already `brand-500`) |
| Buttons | Fully-rounded **pills**, solid brand fill for primary |
| Headings | Bold rounded-geometric display face (Poppins / `font-display`), emoji accents |
| Cards | Soft shadow, large radius, generous whitespace |
| Top-right | Persistent `stan.store/username` + copy icon on every admin screen |
| Empty states | Mini illustration + encouraging copy + CTA |
| Persistent | Floating help/chat bubble, bottom-right |

---

## Feature map: Stan v2 → our codebase

| Stan nav | Reference shows | We have | Action |
|---|---|---|---|
| Home | "Get ready to sell" task cards + Ask Stanley AI | `dashboard/page.tsx` (stats) | Rework into checklist Home |
| My Store | Tabs Store/Landing Pages/Edit Design; product-type grid; phone preview | `storefront`, `products` | Add Landing Pages + theme editor + type picker |
| Income | Revenue chart, cashout panel, Latest Orders + filter chips + CSV | `orders` | Add chart, payout panel, chips, CSV |
| Analytics | Visits / Revenue / Leads, date ranges, customer geo | partial `events/insights` | Dedicated page |
| Customers | CRM table + filter chips + Add-Contact modal (manual + CSV) | partial `leads` | Upgrade to CRM |
| Community | Free/paid community | — | New module |
| Appointments | Month calendar + List toggle + settings | `bookings` | Calendar UI |
| Referrals | 20% lifetime commission, code, earnings slider | — | New module |
| Email Flows | Post-purchase drip (Day 0/1/2) | `emails` (broadcasts) | Add automation |
| AutoDM | Instagram keyword auto-reply | — | New module (IG) |
| Settings | 6 tabs: Profile/Integrations/Billing/Payments/Email Notif/Security | single page | Tabbed rebuild |
| Onboarding (subscribe) | Connect socials → plan → Stripe → terms | basic | Subscription layer |

Product types (from picker → `Product.type` enum): Lead Magnet, Digital Product,
Coaching Call, Custom/"Ask Me Anything", eCourse, Recurring Membership, Webinar, Community.

---

## Phase 0 — Design-system alignment  ✅ DONE

- [x] Pill buttons (`rounded-full`) across `Button`/`ButtonLink`
- [x] Lavender sidebar tint in `DashboardShell`
- [x] Full v2 nav list (with `soon` badges on not-yet-built items)
- [x] Persistent `host/username` top-right bar + copy (desktop + mobile)
- [x] Floating help bubble bottom-right
- [x] Shared primitives: `Tabs`, `FilterChips` (in `ui.tsx`), `Modal` (`Modal.tsx`)
- [x] New icons: Home, Dollar, Smile, Send, List, Chat

## Phase 1 — Rework existing surfaces

1. [x] **Home** — welcome hero + task-checklist cards (theme / product done-states, Ask Stanley soon)
2. [x] **Income** — revenue area chart + payout panel + Latest Orders w/ working filter chips + CSV export
3. [x] **Customers** — CRM table + filter chips + Add-Contact modal (manual w/ country code + CSV import, 5k cap). Backend: `phone`/`lastName` on Lead, `POST /leads/manage` + `/leads/manage/import`
4. [x] **My Store** — tabbed Store / Landing Pages / Edit Design; product-type grid (all wired, no "soon"); **store designer**: 8 templates, font/color/background controls, drag-order + show/hide sections, live preview honoring all of it; **Landing Pages** builder (create/publish/delete) + public `/{username}/p/{slug}` renderer. Public storefront honors font + dark-bg legibility + section order.
5. [x] **Appointments** — "My Appointments" month-grid calendar (6-week, today-highlight, booking chips) + Calendar/List toggle + month nav; Session-types management kept as 2nd tab
6. [x] **Settings** — 6-tab rebuild (Profile, Integrations, Billing w/ plan switch, Payments via ConnectCard, Email Notifications toggles, Security 2FA/sessions/delete) wired to `/api/account` + `/api/subscription`

## Phase 2 — New modules  ✅ ALL DONE

7. [x] **Email Flows** — `EmailFlow` + steps; Flows/Broadcasts tabs; create multi-step drip, enable/pause/delete
8. [x] **Referrals** — `Referral` model, code gen/regenerate, share link, earnings calculator slider
9. [x] **Analytics** — date-range chips, Visits/Revenue/Leads, conversion funnel (`?days=` + revenue added)
10. [~] **Community** — built, then **removed** per request (model, routes, page, nav all deleted)
11. [x] **AutoDM** — `AutoDMRule`, IG connect screen, keyword rule manager
12. [x] **SaaS subscription** — `Subscription` model, Billing tab plan switch (Monthly/Yearly/Bundle), trial, cancel
13. [x] **Landing Pages** — `LandingPage` model, builder, public `/{username}/p/{slug}`
14. [x] **Account** — notification prefs, sessions, 2FA, delete (`/api/account`)

### Robustness
- [x] **Request timeout** in `apiRequest` (15s AbortController) — a missing/slow backend now
  degrades to the login page instead of an infinite full-screen loader.

### Backend additions (all registered in `routes/index.ts` + `models/index.ts`)
Models: `EmailFlow`, `Referral`, `Community`/`CommunityPost`, `AutoDMRule`, `LandingPage`,
`Subscription` + `User.notificationPrefs`/`twoFactorEnabled`. Modules: `referrals`, `flows`,
`community`, `autodm`, `landing`, `subscription`, `account`. All smoke-tested → HTTP 200.
