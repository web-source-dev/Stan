# CreatorStore Research Backed PRD

## Executive summary

CreatorStore should be positioned as an **all-in-one link-in-bio commerce platform** for creators, coaches, freelancers, and small digital businesses. The strongest market signal is that the leading tools in this category are no longer “just” link pages: Stan positions itself around courses, digital products, and bookings inside the bio link; Linktree now markets storefront, courses, digital products, bookings, and analytics; Beacons markets link-in-bio, store, email marketing, media kit, and income dashboard; and Gumroad continues to own the “simple digital selling” lane with products, courses, and memberships. In other words, the market now expects **one link + one checkout + one creator dashboard**, not a bundle of disconnected tools. [1, 2, 3, 6]

The biggest change from your draft is the storage layer: **Cloudinary should replace S3 everywhere** for creator-uploaded media and purchased fulfilment. Cloudinary’s Upload API supports images, video, `raw` files, and `auto` detection; it supports authenticated and unauthenticated uploads, but unsigned/client-side uploads are deliberately restricted; and it provides private/authenticated delivery types plus signed and time-limited URLs for protected assets. That makes it suitable not only for storefront images and course videos, but also for downloadable PDFs, ZIP files, and other digital products. [7, 8]

The other key architectural decision is payments, and this PRD now **commits to a decision rather than leaving it open**. For MVP, Stripe Checkout is the lowest-friction surface because it supports one-time and subscription payments through Checkout Sessions with a low-complexity hosted flow. But because CreatorStore is a genuine multi-creator marketplace in which creators sell their own products and must receive their own sales revenue, routing all end-customer payments into a single platform account is not viable in production — it creates payout, liability, and money-transmission problems. **Decision: Stripe Connect (Express accounts) is a core MVP requirement, not a later patch.** The platform monetises through the creator subscription plus an optional per-transaction application fee, while funds settle to each creator’s connected account. Stripe’s own guidance is explicit that Connect is the model for SaaS platforms and marketplaces that move money between multiple parties. [12, 15]

The recommended product split is therefore:

- **Phase-ready MVP**: creator auth, onboarding, public storefront, digital products, hosted Stripe Checkout **on Stripe Connect (Express) with creator payout onboarding**, post-payment fulfilment, lead capture, basic creator dashboard. Paid plans launch with a **14-day free trial** (see commercial model).
- **Phase two**: courses, bookings (with manual meeting links), email broadcasts/segments, creator analytics.
- **Phase three**: automation, affiliates, funnels, custom domains, native meeting-provider integrations (Google Calendar/Meet, Zoom), AI features.

This report expands your draft into a **dev-ready PRD** with feature-by-feature breakdown, Cloudinary-first implementation guidance, more explicit data architecture, and operational requirements grounded in the current official docs for Next.js, Express, MongoDB, Stripe, Cloudinary, Resend, and OWASP. [7, 12, 16, 18, 19, 20, 21, 25, 26]

## Market baseline

The competitive bar is clear. Stan’s public positioning is “all of your courses, digital products, and bookings … hosted within your link-in-bio”. Linktree now explicitly markets a shop, course selling, digital products, bookings, analytics, and a creator-facing monetisation layer to more than 70 million users. Beacons combines link-in-bio, store, email marketing, media kit, and income dashboard. Gumroad remains intentionally narrower and wins on simplicity, low setup cost, and straightforward pricing. That means CreatorStore should **not** try to beat every incumbent on every feature in v1; it should win on **mobile-first UX, operational simplicity, and clearer creator workflows**. [1, 2, 3, 5]

Pricing also matters strategically. Beacons publicly advertises a free plan and paid plans starting at $10/month, with paid features including custom domains, 0% transaction fees on digital products, and unlimited email sends. Gumroad publicly charges 10% + $0.50 for direct-link sales and 30% via its discover marketplace, with no monthly fee, and states that since 1 January 2025 it handles tax collection and remittance worldwide as merchant of record. That creates a real go-to-market tension for CreatorStore: a pure $29/month entry plan is viable for serious creators, but it is harder to acquire long-tail creators if competitors offer either a free tier or no monthly fee. [4, 6]

**Recommended positioning**

CreatorStore should launch with a simple promise:

> “Sell your digital products, mini-courses, bookings, and lead magnets from one mobile-first page.”

That positioning is broad enough to compete with Stan, Linktree, Beacons, and Gumroad, but narrow enough for an MVP built by a lean team.

**Recommended commercial shape**

Keep your draft pricing direction, but reduce acquisition friction:

- **Starter**: free trial or low-friction entry plan.
- **Pro**: your original monthly subscription concept.
- **Growth**: advanced features such as custom domains, branded checkout, automation, and team roles.

If you keep only paid plans, add a **free trial** from day one. The market benchmark strongly suggests that “zero-risk entry” improves creator acquisition. This is an inference from competitor packaging and pricing rather than a direct vendor claim. [4, 6]

## Detailed product requirements

### Product goals and success criteria

The product’s core job is to help creators turn traffic from TikTok, Instagram, YouTube, X, newsletters, and WhatsApp into transactions or captured leads in the fewest possible taps. Because the category leaders all emphasise commerce and conversion from the bio link, success should be measured by outcomes, not page-builder usage. [1, 2, 3]

**Primary KPIs**

- Storefront visit-to-checkout-start rate
- Checkout completion rate
- Lead capture conversion rate
- Monthly recurring revenue
- Active creators per month
- Average gross merchandise value per creator
- Refund rate
- Failed payment / webhook recovery rate

### User roles and permissions

CreatorStore needs three application roles at launch:

- **Buyer**
  - Can view storefronts, purchase products, opt into lead forms, access purchased items, join courses, and manage bookings.
- **Creator**
  - Can manage storefront profile, products, courses, bookings, leads, orders, and email sends within their own tenant boundary.
- **Platform admin**
  - Can review creators, moderate content, view audit logs, replay failed fulfilment jobs, manage support actions, and inspect webhook/event health.

This is a multi-tenant product, so every creator-facing resource should be tenant-scoped by `creatorId` even if the first release does not expose teams or staff accounts yet.

### Authentication and onboarding

Next.js App Router now exposes both **Route Handlers** for HTTP endpoints and **Server Functions / Server Actions** for server-side mutations linked to forms. Express 5 supports modular router-level middleware and promise-aware error handling. Together, that supports a clean split where UI-bound mutations can stay close to the Next app, while integrations and webhooks live in Express. [18, 19]

**Functional requirements**

- Email and password sign-up.
- Email verification before a store can go live.
- Username claim during onboarding.
- Username availability check with debounce.
- Setup wizard:
  - name
  - creator category
  - profile image
  - bio
  - social links
  - primary CTA choice
  - first product type selection
- Login, logout, forgot password, reset password.
- Session refresh and multi-device session awareness.
- Soft-delete / deactivation for creator accounts.
- Optional future social login.

**Implementation requirements**

- Keep auth tokens short-lived.
- Use httpOnly refresh cookies or an equivalent secure refresh mechanism.
- If JWT is used, validate integrity, issuer, audience, and expiry, and maintain a denylist on explicit logout or forced session invalidation. OWASP’s REST guidance is clear that JWTs must be integrity protected and key claims validated. [23]
- Add login throttling and bot protection. OWASP recommends layered defences against brute force, credential stuffing, and password spraying, including throttling and monitoring. [24]

**Acceptance criteria**

- A new creator cannot publish a storefront before verifying email.
- Duplicate usernames cannot be created.
- Duplicate emails cannot be created.
- Reset tokens expire automatically.
- Auth failures are logged with enough metadata for fraud and support review.

### Public storefront

The storefront is the most important surface in the product. It should be a lightweight, mobile-first page at:

```text
yourdomain.com/username
```

**Functional requirements**

- Public profile header:
  - profile image
  - display name
  - short bio
  - social proof or trust chips
- Content blocks:
  - featured offer
  - product cards
  - course cards
  - booking cards
  - free lead magnet
  - email capture block
  - links block
- Creator theme controls:
  - font pair
  - button style
  - card style
  - background colour / image / gradient
  - accent colour
- Product card essentials:
  - title
  - short description
  - price
  - cover image
  - CTA label
- Optional merchandising:
  - pinned item
  - best seller badge
  - limited time badge
  - countdown banner later
- SEO metadata:
  - page title
  - meta description
  - OG image
- Analytics events:
  - view
  - CTA click
  - product click
  - booking click
  - lead form submit
  - checkout start

**Technical notes**

Cloudinary is a strong fit for storefront images because it supports automatic format and quality optimisation, and its docs explicitly recommend `f_auto` and `q_auto` for image optimisation. Its optimisation guidance also notes that smaller image and video payloads improve page performance. If you are already using Cloudinary, Cloudinary’s own Next.js docs recommend avoiding “double optimisation” and using `CldImage` rather than piping already-optimised Cloudinary assets back through redundant optimisation paths. [9, 10]

**Acceptance criteria**

- Storefront renders correctly on common mobile widths first.
- Profile and product images are served through Cloudinary with optimised delivery.
- Storefront is publicly accessible without login.
- Creator can preview changes before publishing.
- Unpublished storefront returns a safe not-found or draft page depending on role.

### Digital products

This feature should be in the first shipping milestone because it is the fastest path to revenue.

**Supported product types in MVP**

- PDF / ebook
- ZIP / templates / assets
- Audio
- Raw downloadable file
- One-time downloadable bundle
- Free lead magnet
- Pay-what-you-want later

Cloudinary is suitable here because its upload and delivery model supports `image`, `video`, `raw`, and `auto` resource types. The docs explicitly state that `resource_type` can be set to `raw` or `auto` for non-image assets. [7]

**Creator requirements**

- Create product
- Upload cover image
- Upload one or more fulfilment files
- Set title, slug, short description, full description
- Set price and currency
- Set status: draft / published / archived
- Set visibility: public / unlisted
- Optional purchase button text
- Optional thank-you instructions
- Optional upsell / related product later

**Buyer requirements**

- View product details
- Launch checkout
- Receive confirmation email
- Access fulfilment page
- Re-download purchased files via entitlement area

**Cloudinary requirements**

- Use **signed uploads** for creator-authenticated asset uploads from your backend or via backend-generated signatures.
- Use unsigned uploads only for tightly constrained low-risk cases, because Cloudinary states unsigned/client-side uploads exist but are restricted for security reasons. [7]
- Store downloadable digital goods as `raw` files or `auto`.
- For paid files, use **private or authenticated delivery** plus **signed, time-limited URLs**. Cloudinary’s access-control docs explain that restrictive delivery types must be set at upload, require signed URLs, and can be combined with time-limited access; for private assets, `private_download_url` provides temporary access and is not CDN cached. [8]
- Store asset metadata:
  - `creatorId`
  - `productId`
  - `assetRole`
  - `planTier`
  - `uploadedBy`
  - moderation state

**Edge cases**

- Payment succeeds but fulfilment email fails.
- Buyer loses the success page.
- Creator replaces a file after purchases exist.
- Product is unpublished after prior purchases.
- ZIP uploads exceed allowed size.
- Duplicate webhook retries attempt a second entitlement grant.

**Acceptance criteria**

- A paid buyer gets access only after payment confirmation.
- Fulfilment is recoverable from webhook retries or manual replay.
- Time-limited URLs expire and can be regenerated by an authorised entitlement holder.
- Creator can version a digital product without breaking previous orders.

### Course system

Courses should be implemented as **structured content plus entitlements**, not as a special case of digital downloads.

**Course hierarchy**

- Course
- Module
- Lesson
- Lesson asset

**Lesson types**

- Video
- Rich text
- Download
- Assignment / prompt later
- Quiz later

**Creator requirements**

- Create course shell
- Upload cover image
- Create modules and reorder them
- Create lessons and reorder them
- Mark lessons as preview or paid
- Add lesson description and duration
- Upload video and attachments
- Publish or unpublish course
- Bundle course with other products later

**Student requirements**

- See enrolled courses
- Resume where they left off
- Track lesson completion
- Access preview lessons without purchase
- Access paid lessons only with valid entitlement

**Media requirements**

Cloudinary’s video docs show that it supports dynamic video transformation, optimisation, resizing, cropping, overlays, and adaptive bitrate streaming. It also notes that video optimisation contributes to Core Web Vitals by reducing file size while maintaining quality. That makes Cloudinary good for hosted mini-courses, especially where mobile playback matters. [11]

**Important product decision**

Do not promise DRM-grade piracy prevention in the PRD. What you can promise is:

- authenticated access
- signed delivery
- expiring URLs
- entitlement checks
- no public asset URLs
- optional watermarking later

Anything stronger is usually a separate rights-management project.

**Acceptance criteria**

- Preview lessons are publicly visible.
- Paid lessons require entitlement.
- Course progress persists per buyer.
- Reordering modules and lessons does not break enrolments.
- Video playback works on mobile with acceptable startup time.

### Booking system

Bookings are strategically important because Stan and Linktree both signal that paid sessions are an expected part of the category. [1, 2]

**Booking object types**

- 1:1 call
- group session later
- discovery call
- paid consultation
- free consultation
- application-only session later

**Creator requirements**

- Create booking type
- Set title, description, duration, price
- Set timezone
- Configure availability:
  - weekly recurring windows
  - date overrides
  - blackout dates
  - minimum notice
  - maximum booking horizon
  - buffer before
  - buffer after
  - daily cap
- Set cancellation policy
- Set reschedule window
- Select meeting provider:
  - manual link
  - Zoom later
  - Google Calendar / Meet later
- Collect custom intake questions

**Buyer requirements**

- Select date and time in local timezone
- Answer intake questions
- Pay if session is paid
- Receive confirmation and reminder emails
- Reschedule or cancel within allowed policy

**Meeting link generation**

If you use Google Calendar / Meet, Google’s Calendar API model supports attaching conference data to events via a create request, and the conference data is generated asynchronously. If you use Zoom, Zoom’s API requires OAuth-based access tokens and programmatic meeting creation over its API. Both are possible, but they create extra OAuth and support burden. **Decision: bookings ship with a manual fixed meeting-link option per booking type; native Google Calendar/Meet and Zoom integrations are deferred to phase three.** This keeps the booking system shippable without an OAuth integration on the critical path. The booking data model should still store a `meetingProvider` field and a provider-agnostic `meetingUrl`, so adding generated links later does not require a schema migration. [27, 28]

**Acceptance criteria**

- Slot inventory prevents double-booking.
- Buyer and creator both receive confirmation emails.
- Paid bookings are not confirmed until payment success.
- Timezone conversions are correct.
- Reschedule and cancellation rules are enforced consistently.

### Payments and checkout

Stripe Checkout should be the MVP payment surface. Stripe documents Checkout Sessions as the low-complexity route for one-time and subscription payments and says Checkout supports more than 125 local payment methods. Webhooks are also essential because Stripe’s docs explicitly describe webhook delivery as the mechanism for responding to asynchronous payment events. [12, 13]

**Checkout requirements**

- Create checkout session from product or booking
- Support one-time payments in MVP
- Support subscriptions when membership features go live
- Store Stripe customer ID
- Support discounts / coupon codes later
- Success page and cancel page
- Order metadata includes:
  - creatorId
  - productId / bookingId
  - offerType
  - source
  - campaign params

**Webhook requirements**

- Verify Stripe signature
- Use raw request body
- Return `2xx` quickly before long-running work
- Persist event ID and status
- Make fulfilment idempotent by event ID and order key
- Retry safely

Stripe explicitly recommends returning a successful `2xx` status before complex logic, and it states webhook events are needed for asynchronous outcomes such as bank confirmation, disputes, or recurring billing success. [13]

**Subscription requirements**

If you introduce creator subscriptions or buyer memberships, design around Stripe’s documented states: new subscriptions can remain `incomplete` for up to 23 hours, and provisioning should key off `invoice.paid` or confirmed active status, not off a browser redirect alone. [14]

**Multi-creator payouts — decision**

This was previously the most important unresolved platform decision; it is now resolved. **CreatorStore will use Stripe Connect with Express accounts from MVP.** Each creator completes Connect onboarding before they can publish a paid offer, end-customer payments settle to the creator’s connected account, and the platform takes its revenue through the creator subscription plus an optional application fee on each transaction. Stripe’s own Connect documentation is explicit that Connect is the model for SaaS platforms and marketplaces that manage payments and move money between multiple parties, so it is treated as core scope rather than an afterthought. [15]

Practical implications for the build:

- Creator onboarding must include a Connect account-creation and verification step, with a clear “payouts not yet enabled” state that blocks paid publishing until KYC is complete.
- Checkout Sessions are created on behalf of the connected account (destination charges or direct charges with an application fee), and the chosen charge type must be fixed before the commerce phase ships.
- The dashboard must surface Connect payout status and any verification or restriction issues as a first-class system notice.
- Refunds, disputes, and negative balances must be reasoned about per connected account, not just at the platform level.

**Acceptance criteria**

- One-time purchase creates one order and one entitlement.
- Duplicate webhook deliveries do not create duplicate orders or duplicate entitlements.
- Failed fulfilment can be replayed safely.
- Subscription activation is granted from webhook-confirmed success, not only from return URLs.

### Lead capture and email

This system should start **lean**. Capture leads first; campaign complexity can come later.

Resend is a practical MVP option because its docs cover Node.js, Next.js, and Express quickstarts and expose APIs for sending emails, contacts, segments, topics, and webhooks. Its current API reference also marks **Audiences as deprecated**, so the data model should be built around **contacts + segments + topics**, not audiences. [16]

**Lead capture requirements**

- Inline email form block on storefront
- Optional first name field
- Source tracking:
  - storefront
  - product page
  - exit intent later
  - UTM params
- Consent checkbox option per creator
- Double opt-in configurable
- Deduplicate by `creatorId + email`
- Tag leads by campaign and source

**Email requirements**

- Transactional emails:
  - email verification
  - password reset
  - purchase receipt
  - fulfilment access
  - booking confirmation
  - booking reminder
  - refund / cancellation
- Broadcast emails:
  - simple newsletter
  - product launch
  - booking availability push
- Basic segmentation:
  - all leads
  - customers
  - booked buyers
  - course students
  - source-based segments

**Webhook requirements**

Resend exposes webhook creation and request verification, and its docs emphasise using the raw request body when verifying signatures. That should be mirrored in implementation exactly. [17]

**Acceptance criteria**

- A creator can create a form and embed it in the storefront.
- Duplicate leads are merged, not duplicated.
- Transactional emails can be retried after transient failure.
- Unsubscribed contacts are respected for broadcast sends.

### Creator dashboard

The dashboard should be opinionated and operational, not just analytic.

**Top-level navigation**

- Overview
- Storefront
- Products
- Courses
- Bookings
- Orders
- Customers
- Leads
- Emails
- Settings
- Billing

**Overview requirements**

- Today / week / month revenue
- Orders count
- Checkout conversion
- Lead captures
- Upcoming bookings
- Top products
- Recent activity feed
- System notices:
  - payout issue
  - failing webhook
  - domain verification issue
  - email provider issue

**Orders requirements**

- Search by email, order ID, product
- Refund status
- Fulfilment status
- Resend delivery email
- Regenerate file access link
- Audit trail

**Products requirements**

- Draft / publish toggle
- Archive
- Duplicate product
- Replace asset
- View conversion metrics per product

**Acceptance criteria**

- A creator can manage their business without leaving the dashboard for common tasks.
- Operational recovery actions exist for the main support tickets:
  - resend receipt
  - regenerate file link
  - re-run fulfilment
  - cancel / reschedule booking

### Platform admin and support tooling

This is often missed in MVP PRDs and becomes expensive later.

**Admin requirements**

- Search creators, buyers, orders, and bookings
- View webhook logs
- Replay failed webhook-derived jobs
- Suspend creator account
- Unpublish violating products
- View audit logs
- Impersonate creator in a controlled support mode later
- Review reported abuse

**Moderation requirements**

Cloudinary can store creator uploads securely, but moderation and file validation still belong in your platform policy. OWASP’s file-upload guidance recommends allowlisted extensions, file-size limits, content-type and signature validation, generated filenames, storage separation, and defence in depth. [25]

## Technical architecture

### Application shape

At the time of research, Next.js App Router docs list version 16.2.2, with Route Handlers for custom HTTP handlers and Server Functions / Server Actions for server-side mutations. Express 5 supports promise-aware error handling and modular routing. Next.js can be deployed as a Node.js server, Docker container, static export, or via platform adapters. [18, 19]

**Recommended split**

- **Next.js app**
  - public storefronts
  - creator dashboard UI
  - auth pages
  - route-level SEO
  - lightweight server actions for dashboard forms
- **Express API**
  - Stripe webhooks
  - Resend webhooks
  - Cloudinary signature endpoints
  - admin-only APIs
  - background worker entrypoints
  - internal operational endpoints

This split keeps the UI fast and simple while isolating integrations and webhook reliability concerns.

### Cloudinary-first media architecture

Cloudinary should be treated as a **media platform**, not merely a file bucket.

**Upload strategy**

- Storefront/profile images:
  - signed uploads preferred
  - unsigned preset acceptable only if locked down hard
- Course videos:
  - signed uploads
  - eager or named transformations where useful
- Digital product files:
  - `raw` resource type
  - private/authenticated delivery type
- Set metadata and tags on upload for traceability

Cloudinary states that authenticated uploads support all parameters, while unsigned uploads are intended for unauthenticated client-side usage with restrictions. It also provides upload presets, signature generation, signed URLs, strict transformations, and private/authenticated delivery. [7, 8]

**Foldering convention**

Use a predictable structure such as:

```text
creators/{creatorId}/profile
creators/{creatorId}/products/{productId}
creators/{creatorId}/courses/{courseId}/lessons/{lessonId}
creators/{creatorId}/bookings
```

**Cost-control rule**

Cloudinary notes that transformations generate derived assets and transformation activity affects plan usage. To prevent surprise bills, standardise a small set of named transformations and reuse them across the app. [11]

### Database model

MongoDB is a natural fit because the product is document-heavy and tenant-scoped, but schema design still matters. MongoDB supports transactions on replica sets and sharded clusters, but its docs also warn that multi-document transactions cost more than single-document writes and should not replace good schema design. Use transactions only for short, business-critical flows such as finalising an order, creating an entitlement, and recording an outbox entry. [20]

**Proposed collections**

| Collection | Purpose | Key indexes |
|---|---|---|
| `users` | auth identity | unique `email` |
| `creator_profiles` | public creator profile | unique `username`, unique `slug` |
| `storefront_configs` | theme and block order | `creatorId` |
| `products` | downloadable and sellable items | `creatorId`, unique compound `creatorId + slug` |
| `product_assets` | Cloudinary asset metadata | `creatorId`, `productId`, `publicId` |
| `courses` | course shell | `creatorId`, unique compound `creatorId + slug` |
| `course_modules` | ordered module list | `courseId`, `sortOrder` |
| `course_lessons` | lessons | `courseId`, `moduleId`, `sortOrder` |
| `orders` | payment-linked commercial record | unique `stripeCheckoutSessionId` |
| `entitlements` | access rights | unique compound `buyerEmail + productId` or `buyerId + productId` |
| `booking_types` | productised services | `creatorId`, unique compound `creatorId + slug` |
| `bookings` | scheduled appointments | `creatorId`, `startAt` |
| `availability_rules` | recurring windows and overrides | `creatorId` |
| `leads` | lead captures | unique compound `creatorId + email` |
| `email_events` | delivery/open/click state | `creatorId`, `providerMessageId` |
| `webhook_events` | dedupe and replay | unique `provider + eventId` |
| `jobs` | retries and async tasks | `status`, `runAt` |
| `audit_logs` | support and security audit trail | `actorId`, `creatorId`, `createdAt` |
| `auth_tokens` | reset/verify sessions if stored server-side | TTL on `expiresAt` |

**Indexing and expiry rules**

MongoDB unique indexes should enforce usernames, emails, and tenant-local slugs. MongoDB TTL indexes are useful for reset tokens, verification tokens, temporary upload sessions, old webhook dedupe locks, and abandoned flow artefacts, but TTL indexes are single-field only and depend on a date field plus `expireAfterSeconds`. [21]

**Availability requirement**

Run MongoDB in a replica set or Atlas equivalent because replication is the core availability model for maintaining copies of the same dataset and supporting automatic failover. [22]

### API surface

OWASP’s REST guidance recommends allowlisting methods, validating content types, and rejecting unsupported media types. Express router-level middleware maps cleanly to this approach. [19, 23]

**Recommended endpoint groups**

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

- `GET /storefront/:username`
- `PATCH /creator/profile`
- `PATCH /creator/storefront`

- `POST /products`
- `PATCH /products/:id`
- `POST /products/:id/publish`
- `POST /products/:id/archive`

- `POST /courses`
- `POST /courses/:id/modules`
- `POST /lessons`
- `PATCH /lessons/:id`

- `POST /booking-types`
- `POST /bookings/availability/query`
- `POST /bookings/checkout`

- `POST /checkout/session`
- `POST /webhooks/stripe`

- `POST /leads`
- `POST /emails/send`
- `POST /webhooks/resend`

- `POST /cloudinary/sign-upload`
- `POST /assets/private-link`

## Security and operational requirements

### Security requirements

This platform handles payments, PII, downloadable files, and private course content. Security cannot be treated as a post-MVP clean-up.

**Application security**

- Enforce HTTPS everywhere.
- Add rate limiting on auth, lead capture, and checkout session creation.
- Restrict HTTP methods by route.
- Validate `Content-Type` on write endpoints.
- Centralise request schema validation.
- Add CSRF protection for browser-session flows.
- Add secure headers and strict CORS policy.
- Keep audit logs for auth and fulfilment events.

OWASP’s REST and Authentication guidance explicitly recommends allowlisting HTTP methods, validating content types, logging auth failures, and defending against automated attacks with throttling and monitoring. [23, 24]

**Webhook security**

- Stripe signature verification
- Resend signature verification
- Raw-body parsing for signed webhook verification
- Fast `2xx` acknowledgement before background work
- Replay-safe idempotency keys

Stripe and Resend both document raw-body-sensitive signature verification and fast acknowledgement patterns. [13, 17]

**Upload security**

OWASP’s File Upload Cheat Sheet is especially relevant here. In addition to Cloudinary’s own access controls, implement:

- allowlisted extensions
- file-size caps
- MIME and signature checks
- generated filenames
- auth-gated upload endpoints
- restricted delivery types for paid content
- optional malware scanning for high-risk file types later

OWASP explicitly warns against trusting client-provided content types and recommends storage separation, allowlisting, generated filenames, and defence in depth. [25]

### Performance requirements

Cloudinary’s optimisation docs are especially useful because storefronts, course assets, and product media are the main determinants of mobile performance. Cloudinary explicitly ties smaller optimised image and video payloads to faster rendering and better web performance. [9, 11]

**Operational targets**

- Public storefront interactive on mobile as quickly as possible, with the most important content above the fold.
- API p95 under a few hundred milliseconds for standard CRUD flows.
- Checkout/session creation should feel instantaneous.
- Webhook processing must be async and recoverable.
- Background jobs should not block buyer-facing responses.

**Practical implementation notes**

- Cache published storefront data.
- Separate draft creator mutations from public read models.
- Use Cloudinary responsive transformed assets.
- Avoid oversized lesson videos and apply standard quality presets.
- Keep order fulfilment async via webhook + jobs collection.

### Reliability and observability

This product will fail operationally before it fails technically unless you instrument it early.

**Minimum observability**

- request logs
- auth logs
- webhook logs
- job logs
- email delivery logs
- order fulfilment audit trail
- creator-facing incident banners for degraded features

**Replayable systems**

- Stripe fulfilment jobs
- Resend email notification jobs
- Cloudinary signing or asset-link generation logs
- booking confirmation jobs

**Back-office views**

- failing Stripe events
- stuck jobs
- failed emails
- asset-link generation failures
- duplicate-order detection

## Delivery plan and commercial model

### Recommended phased roadmap

Your original roadmap is directionally right, but the implementation sequence should be tightened to reduce cross-feature coupling.

**Foundation phase**

Ship the platform skeleton:

- tenant-aware auth
- creator onboarding
- creator profile and username routing
- Cloudinary signing and upload flows
- base database schema
- audit logs
- job runner
- internal admin shell

**Commerce phase**

Ship the first revenue loop:

- storefront blocks
- digital products
- Stripe Connect (Express) creator onboarding and payout status
- hosted Stripe Checkout on connected accounts
- Stripe webhooks
- order creation
- fulfilment links
- receipts
- 14-day free-trial billing for creator plans
- creator dashboard overview

**Growth phase**

Ship lifecycle features:

- lead capture
- email contacts/segments
- simple broadcasts
- customer list
- conversion analytics
- product duplication
- draft/publish workflow polish

**Learning and service phase**

Ship the more operational features:

- courses
- course player
- entitlements
- bookings
- availability engine
- meeting links
- reminders
- refunds/cancellations

### Suggested team workstreams

For a small team, split the backlog into parallel streams:

- **Frontend**
  - storefront
  - dashboard shell
  - forms
  - analytics instrumentation
- **Backend**
  - auth
  - product CRUD
  - checkout
  - entitlements
  - bookings
  - jobs
- **Integrations**
  - Cloudinary
  - Stripe
  - Resend
- **QA**
  - critical journey coverage for:
    - sign-up
    - upload
    - checkout
    - fulfilment
    - booking
    - password reset

### Commercial recommendations

Your draft pricing of **Basic $29 / Pro $99** is plausible for serious creators, especially if Pro includes custom domains, automation, advanced analytics, and lower transaction fees. But the benchmark set by Beacons’ free entry and Gumroad’s no-monthly-fee model means a pure paid-only entry will struggle to acquire long-tail creators. The candidate acquisition levers were:

- free trial
- free tier with a transaction fee
- founder launch plan / annual discount

**Decision: keep Basic $29 / Pro $99 and launch a 14-day free trial on both paid plans from day one.** A trial is the lowest-build lever — it does not require standing up free-tier transaction-fee billing or a separate free product surface — while still giving creators a zero-risk entry to match the market benchmark. A founder/annual discount can be layered on later as a growth experiment, and a true free tier remains a future option if trial conversion proves insufficient. This is strategic inference from competitor pricing rather than a direct vendor statement, so the trial length and conversion mechanics should be validated against real funnel data after launch. [4, 6]

## Resolved decisions and remaining limitations

The previously open product questions have been resolved into the decisions below so the build can proceed without ambiguity.

**Resolved decisions**

- **Money movement → Stripe Connect (Express) from MVP.** CreatorStore is a true multi-creator marketplace, so end-customer payments settle to each creator’s connected account and the platform earns via subscription plus an optional application fee. Connect onboarding gates paid publishing. Treated as core scope, not a later patch. [15]
- **Booking meeting-provider strategy → manual links first.** Bookings launch with a manual fixed meeting-link per booking type; native Google Calendar/Meet and Zoom integrations are deferred to phase three. The data model reserves `meetingProvider` and `meetingUrl` so integrations can be added without migration. [27, 28]
- **Pricing → $29 / $99 with a 14-day free trial from launch.** The free trial is the chosen acquisition lever; a founder/annual discount or a true free tier remain optional later experiments. [4, 6]
- **Email platform → Resend, modelled on contacts + segments + topics.** Build around contacts, segments, and webhook-driven transactional delivery, because the current API marks audiences as deprecated. [16]

**Remaining limitations (intentional non-promises)**

The PRD deliberately does **not** promise outcomes the underlying stack cannot guarantee:

- No DRM-grade download protection or perfect anti-piracy for course videos — the platform promises authenticated access, signed and expiring URLs, and entitlement checks, but stronger rights management is a separate project.
- No merchant-of-record tax handling equivalent to Gumroad’s model — tax collection and remittance remain a separate legal and payments decision.

These require dedicated legal, rights-management, and payments work beyond the core Next.js + Express + MongoDB + Cloudinary + Stripe Connect platform build. [6, 15]

## Sources

*Research for this report was conducted as of its publication date. Citations point to the canonical documentation location for each vendor/source rather than the exact deep-link captured during research, and should be re-verified before external distribution.*

1. Stan - product positioning: courses, digital products, and bookings hosted within the link-in-bio. (stan.store)
2. Linktree - features: storefront/shop, course selling, digital products, bookings, analytics, creator monetisation. (linktr.ee)
3. Beacons - features: link-in-bio, store, email marketing, media kit, income dashboard. (beacons.ai)
4. Beacons - pricing: free plan and paid plans from $10/month (custom domains, 0% transaction fees on digital products, unlimited email sends). (beacons.ai/pricing)
5. Gumroad - product features: digital products, courses, memberships. (gumroad.com)
6. Gumroad - pricing & merchant-of-record: 10% + $0.50 direct, 30% via Discover, no monthly fee, worldwide tax collection/remittance from 1 Jan 2025. (gumroad.com/pricing)
7. Cloudinary - Upload API reference: image/video/raw/auto resource types; signed vs unsigned (restricted client-side) uploads; upload presets and signature generation. (cloudinary.com/documentation/image_upload_api_reference)
8. Cloudinary - Control access to media: private/authenticated delivery types, signed and time-limited URLs, private_download_url (not CDN-cached). (cloudinary.com/documentation/control_access_to_media)
9. Cloudinary - Image optimisation: f_auto and q_auto; smaller payloads improve page performance. (cloudinary.com/documentation/image_optimization)
10. Cloudinary - Next.js SDK: CldImage and avoiding double optimisation. (cloudinary.com/documentation/nextjs_integration)
11. Cloudinary - Video transformation & optimisation: dynamic transforms, adaptive bitrate streaming, Core Web Vitals, transformation/plan usage. (cloudinary.com/documentation/video_manipulation_and_delivery)
12. Stripe - Checkout / Checkout Sessions: hosted one-time and subscription payments; 125+ local payment methods. (docs.stripe.com/payments/checkout)
13. Stripe - Webhooks: responding to asynchronous events, returning 2xx quickly, raw-body signature verification. (docs.stripe.com/webhooks)
14. Stripe - Billing/subscriptions lifecycle: incomplete state up to 23 hours; provision on invoice.paid / confirmed-active. (docs.stripe.com/billing/subscriptions/overview)
15. Stripe - Connect: payments platform for SaaS and marketplaces moving money between multiple parties. (docs.stripe.com/connect)
16. Resend - Quickstarts & API reference: Node.js/Next.js/Express; contacts, segments, topics; Audiences deprecated. (resend.com/docs)
17. Resend - Webhooks: webhook creation and signature verification using the raw request body. (resend.com/docs/dashboard/webhooks)
18. Next.js - App Router documentation: Route Handlers, Server Functions / Server Actions, deployment targets. (nextjs.org/docs)
19. Express - routing, router-level middleware, and (v5) promise-aware error handling. (expressjs.com)
20. MongoDB - Transactions: multi-document transactions on replica sets/sharded clusters; cost vs. schema design. (mongodb.com/docs/manual/core/transactions)
21. MongoDB - Indexes & TTL indexes: unique indexes; single-field TTL via expireAfterSeconds. (mongodb.com/docs/manual/core/index-ttl)
22. MongoDB - Replication: replica sets for availability and automatic failover. (mongodb.com/docs/manual/replication)
23. OWASP - REST Security Cheat Sheet: allowlist HTTP methods, validate content types, JWT integrity/claims validation. (cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
24. OWASP - Authentication Cheat Sheet: defences against brute force, credential stuffing, password spraying. (cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
25. OWASP - File Upload Cheat Sheet: allowlisted extensions, size limits, signature checks, generated filenames, storage separation, defence in depth. (cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
26. OWASP - Cheat Sheet Series (index). (cheatsheetseries.owasp.org)
27. Zoom - API: OAuth access tokens and programmatic meeting creation. (developers.zoom.us/docs/api)
28. Google Calendar - API: attaching conference data to events; generated asynchronously. (developers.google.com/calendar/api)
