# CreatorStore — Frontend

Next.js (App Router) + TypeScript + Tailwind. Public storefronts, auth pages,
onboarding wizard, and the creator dashboard.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if the API isn't on :5000
npm run dev                  # http://localhost:3000
```

The backend API must be running (default `http://localhost:5000`). Auth uses an
in-memory access token plus the backend's httpOnly refresh cookie, so both apps
must be reachable from the browser and the API's `CORS_ORIGINS` must include
`http://localhost:3000`.

## Routes

- `/` — landing
- `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/onboarding` — claim username + create store (auth required)
- `/dashboard` — overview, profile editor, publish toggle (auth required)
- `/[username]` — public storefront (server-rendered from the API)

## Notes

- `src/lib/auth-context.tsx` owns session state: restores the session via
  `/api/auth/refresh` on load and retries failed requests once after refreshing.
- The `/[username]` route is matched only after static routes, so reserved names
  (login, dashboard, …) never collide; signup also blocks reserved usernames.
- Images are delivered via Cloudinary (`res.cloudinary.com` is allowlisted in
  `next.config.mjs`).
