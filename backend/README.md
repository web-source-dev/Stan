# CreatorStore — Backend (API)

Express 5 + TypeScript + MongoDB (Mongoose). Owns auth, creator onboarding,
storefront data, Cloudinary signing, the job queue, audit logs, webhooks, and
platform-admin tooling.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in secrets
npm run dev            # tsx watch on http://localhost:5000
```

You need a MongoDB instance. Locally:
`mongodb://127.0.0.1:27017/creatorstore` (install MongoDB Community or run via
Docker: `docker run -d -p 27017:27017 mongo:7`). Or point `MONGODB_URI` at an
Atlas cluster.

If `RESEND_API_KEY` is empty, verification/reset emails are logged to the
console instead of sent — fine for local development. If Cloudinary env vars are
empty, the upload-signing endpoint returns 503.

## Scripts

- `npm run dev` — watch-mode dev server
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
- `npm run typecheck` — type-check without emitting
- `npm run worker` — run the job queue as a standalone process

## API surface (foundation phase)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Creates account, sends verification, logs in |
| POST | `/api/auth/login` | – | Access token (body) + refresh cookie |
| POST | `/api/auth/refresh` | cookie | Rotates refresh token |
| POST | `/api/auth/logout` | cookie | Revokes session |
| POST | `/api/auth/forgot-password` | – | Always 202 |
| POST | `/api/auth/reset-password` | – | Token from email |
| POST | `/api/auth/verify-email` | – | Token from email |
| POST | `/api/auth/resend-verification` | bearer | |
| GET | `/api/auth/me` | bearer | |
| GET | `/api/creator/username-available?username=` | bearer | |
| POST | `/api/creator/onboarding` | bearer | Claims username, creates profile |
| GET/PATCH | `/api/creator/profile` | bearer | |
| GET/PATCH | `/api/creator/storefront` | bearer | Theme + blocks |
| POST | `/api/creator/publish` | bearer + verified | Email-verified gate |
| POST | `/api/creator/unpublish` | bearer | |
| GET | `/api/storefront/:username` | – | Public read; published only |
| POST | `/api/cloudinary/sign-upload` | bearer | Tenant-scoped signed upload |
| GET | `/api/admin/*` | admin | Creators, audit logs, health |
| POST | `/webhooks/stripe`, `/webhooks/resend` | signature | Stubs until later phases |

## Architecture notes

- **Auth**: short-lived access JWT (Authorization header) + httpOnly rotating
  refresh cookie backed by `refresh_sessions`. Reuse of a rotated token bumps
  `tokenVersion`, invalidating the whole session family.
- **Tenancy**: every creator-owned resource is scoped by `creatorId` (= the
  user id).
- **Jobs**: durable queue in the `jobs` collection with backoff retries; runs
  in-process today, splittable into `npm run worker`.
- **Webhooks**: mounted before the JSON parser so raw bodies are available for
  signature verification; idempotency via the `webhook_events` collection.
