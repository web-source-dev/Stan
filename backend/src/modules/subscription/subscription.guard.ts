import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import {
  SubscriptionModel,
  PLAN_FEATURES,
  effectiveTier,
  storageQuotaBytes,
  type PlanFeatures,
  type PlanTier,
} from '../../models/Subscription';

/** Resolve a user's current tier + the feature set it unlocks. */
export async function getEntitlements(userId: string): Promise<{ tier: PlanTier; features: PlanFeatures }> {
  const sub = await SubscriptionModel.findOne({ userId });
  const tier = sub ? effectiveTier(sub) : 'free';
  return { tier, features: PLAN_FEATURES[tier] };
}

/** Resolve a user's media-storage quota: tier baseline + purchased extra packs. */
export async function getStorageInfo(userId: string): Promise<{
  tier: PlanTier;
  baseBytes: number | null;
  extraBytes: number;
  quotaBytes: number;
}> {
  const sub = await SubscriptionModel.findOne({ userId });
  const tier = sub ? effectiveTier(sub) : 'free';
  const features = PLAN_FEATURES[tier];
  const extraBytes = sub?.extraStorageBytes ?? 0;
  return {
    tier,
    baseBytes: features.maxStorageBytes,
    extraBytes,
    quotaBytes: storageQuotaBytes(features, extraBytes),
  };
}

/** Keys of PlanFeatures whose value is a boolean (the gateable on/off features). */
type BooleanFeature = {
  [K in keyof PlanFeatures]: PlanFeatures[K] extends boolean ? K : never;
}[keyof PlanFeatures];

/**
 * Express middleware that blocks a request unless the authenticated creator's
 * plan includes `feature`. Responds 403 `upgrade_required` with the feature and
 * current tier so the client can show a targeted upgrade prompt.
 */
export function requireFeature(feature: BooleanFeature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const { tier, features } = await getEntitlements(req.user.id);
      if (features[feature]) return next();
      next(new AppError(403, 'upgrade_required', 'Your plan does not include this feature. Upgrade to unlock it.', { feature, tier }));
    } catch (err) {
      next(err);
    }
  };
}
