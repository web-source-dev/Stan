import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const USER_ROLES = ['creator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Auth identity. A user is the login principal; their public creator presence
 * lives in `creator_profiles`. Buyers are tracked separately (by email on
 * orders/entitlements) and do not require a User account in the foundation phase.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'creator', index: true },

    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },

    // Onboarding completion gates access to certain dashboard areas.
    onboardingCompletedAt: { type: Date },

    status: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: 'active',
      index: true,
    },

    lastLoginAt: { type: Date },
    // Bumping this invalidates all previously issued refresh tokens for the user.
    tokenVersion: { type: Number, default: 0 },

    twoFactorEnabled: { type: Boolean, default: false },

    // Email notification preferences surfaced in Settings → Email Notifications.
    notificationPrefs: {
      calendarBookings: { type: Boolean, default: true },
      ordersFulfillment: { type: Boolean, default: true },
      purchaseConfirmations: { type: Boolean, default: true },
      leadCaptured: { type: Boolean, default: true },
      membershipCancellations: { type: Boolean, default: true },
      recurringPayments: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
