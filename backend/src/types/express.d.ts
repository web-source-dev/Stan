import type { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth: the authenticated principal. */
      user?: {
        id: string;
        role: UserRole;
        emailVerified: boolean;
      };
      /** Populated by requirePortalAuth: the signed-in customer (buyer). */
      portal?: {
        email: string;
        creatorId: string;
      };
    }
  }
}

export {};
