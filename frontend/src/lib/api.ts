/**
 * Base URL of the backend API.
 *
 * In the browser we derive it from the page's OWN hostname so API calls stay
 * SAME-SITE with the app (localhost↔localhost, 192.168.x↔192.168.x, etc.). This
 * is what keeps the httpOnly refresh cookie (SameSite=Lax) flowing: if the app
 * is served from `localhost` but the API sits on a LAN IP, the request is
 * cross-site, the browser drops the cookie, and the user gets silently logged
 * out the moment the short-lived access token expires.
 *
 * A production NEXT_PUBLIC_API_URL pointing at a real (non-local) host is always
 * honored. On the server (SSR) we fall back to the env value.
 */
const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '4000';

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function resolveApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    // Honor an explicit production API URL (a non-local host) as-is.
    if (envUrl) {
      try {
        if (!isLocalHost(new URL(envUrl).hostname)) return envUrl;
      } catch {
        /* malformed env URL — fall through to host-derived */
      }
    }
    // Dev / LAN: always hit the API on the same host the page is served from,
    // so cookies stay same-site regardless of localhost vs LAN IP access.
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${API_PORT}`;
  }
  return envUrl ?? `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Send cookies (needed for refresh). Defaults to true. */
  credentials?: boolean;
}

/** Default per-request timeout. Prevents a hung/unreachable backend from
 *  leaving the UI stuck on a full-screen loader forever. */
const REQUEST_TIMEOUT_MS = 15000;

/** Low-level fetch wrapper that normalises errors into ApiException. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: opts.credentials === false ? 'omit' : 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err) {
    // Network failure, CORS, or timeout abort — surface as a uniform error so
    // callers (auth bootstrap, page loaders) can resolve instead of hanging.
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiException(0, {
      code: aborted ? 'timeout' : 'network_error',
      message: aborted ? 'The server took too long to respond.' : 'Could not reach the server.',
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: ApiError = data?.error ?? { code: 'unknown', message: 'Request failed' };
    throw new ApiException(res.status, err);
  }
  return data as T;
}

/** Server-side fetch of the public storefront (used by the storefront route). */
export async function fetchStorefront(username: string) {
  return apiRequest<{
    profile: {
      username: string;
      displayName: string;
      category: string;
      bio: string;
      avatarUrl: string;
      socialLinks: { platform: string; url: string }[];
      primaryCta: string;
      published: boolean;
    };
    theme: { background: string; accent: string; buttonStyle: string; cardStyle: string; fontPair?: string } | null;
    blocks: { id: string; type: string; config: Record<string, unknown>; visible?: boolean }[];
    seo: { title: string; description: string; ogImageUrl: string } | null;
    products: {
      id: string;
      title: string;
      slug: string;
      shortDescription: string;
      priceCents: number;
      currency: string;
      coverImageUrl: string;
      ctaLabel: string;
      type: 'digital' | 'lead_magnet';
    }[];
    courses: {
      id: string;
      title: string;
      slug: string;
      shortDescription: string;
      priceCents: number;
      currency: string;
      coverImageUrl: string;
    }[];
    bookingTypes: {
      id: string;
      title: string;
      slug: string;
      description: string;
      durationMin: number;
      priceCents: number;
      currency: string;
    }[];
    showBranding?: boolean;
  }>(`/api/storefront/${encodeURIComponent(username)}`, { credentials: false });
}
