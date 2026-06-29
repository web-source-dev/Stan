import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { IntegrationModel } from '../../models/Integration';
import { refreshLongLivedToken } from './instagram.service';

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh when expiring within 7 days

let timer: NodeJS.Timeout | null = null;

/** Refresh Instagram long-lived tokens before they expire (~60 days). */
export async function refreshExpiringInstagramTokens(): Promise<number> {
  if (!env.instagramConfigured) return 0;

  const threshold = new Date(Date.now() + REFRESH_WINDOW_MS);
  const rows = await IntegrationModel.find({
    provider: 'instagram',
    status: 'connected',
    $or: [{ tokenExpiresAt: { $lte: threshold } }, { tokenExpiresAt: null }],
  }).select('+accessToken externalAccountId');

  let refreshed = 0;
  for (const row of rows) {
    const ok = await refreshLongLivedToken(row).catch(() => false);
    if (ok) refreshed += 1;
  }
  if (refreshed > 0) logger.info({ refreshed }, 'Instagram tokens refreshed');
  return refreshed;
}

export function startInstagramTokenMaintenance(): void {
  if (timer || !env.instagramConfigured) return;
  void refreshExpiringInstagramTokens().catch(() => undefined);
  timer = setInterval(() => void refreshExpiringInstagramTokens().catch(() => undefined), REFRESH_INTERVAL_MS);
}

export function stopInstagramTokenMaintenance(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
