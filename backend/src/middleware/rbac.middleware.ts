import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { UserRole } from '../types';
import { db } from '../config/database';
import { memberships } from '../db/schema';
import { eq } from 'drizzle-orm';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Middleware to check if user has marketing add-on enabled
 * Requires authentication (should be used after authenticate middleware)
 */
export async function checkMarketingAddon(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Get user's membership
    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.userId, req.user.id),
    });

    if (!membership || !membership.marketingAddon) {
      res.status(403).json({
        success: false,
        error: 'Marketing add-on is required to access this feature',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify marketing add-on status' });
  }
}

