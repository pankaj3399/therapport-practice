import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/database';
import { users, memberships } from '../db/schema';
import { eq, and, or, like, SQL, count } from 'drizzle-orm';
import { logger } from '../utils/logger.util';
import { z, ZodError } from 'zod';

const updateMembershipSchema = z.object({
  type: z.enum(['permanent', 'ad_hoc']).nullable().optional(),
  marketingAddon: z.boolean().optional(),
});

export class AdminController {
  async getPractitioners(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const searchQuery = req.query.search as string | undefined;

      // Build where conditions
      const whereConditions: SQL<unknown>[] = [eq(users.role, 'practitioner')];
      
      // Add search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = `%${searchQuery.trim()}%`;
        const searchCondition = or(
          like(users.email, searchTerm),
          like(users.firstName, searchTerm),
          like(users.lastName, searchTerm)
        );
        whereConditions.push(searchCondition);
      }

      // Build query
      const practitioners = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          membershipType: memberships.type,
          marketingAddon: memberships.marketingAddon,
        })
        .from(users)
        .leftJoin(memberships, eq(users.id, memberships.userId))
        .where(and(...whereConditions));

      // Format response
      const formattedPractitioners = practitioners.map((p) => ({
        id: p.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        membership: p.membershipType
          ? {
              type: p.membershipType,
              marketingAddon: p.marketingAddon || false,
            }
          : null,
      }));

      res.status(200).json({
        success: true,
        data: formattedPractitioners,
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get practitioners list',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAdminStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Efficiently count practitioners using COUNT query
      const [result] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, 'practitioner'));

      const practitionerCount = result?.count || 0;

      res.status(200).json({
        success: true,
        data: {
          practitionerCount,
        },
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get admin stats',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getPractitioner(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { userId } = req.params;

      // Build query with leftJoin
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
          role: users.role,
          membershipId: memberships.id,
          membershipType: memberships.type,
          marketingAddon: memberships.marketingAddon,
        })
        .from(users)
        .leftJoin(memberships, eq(users.id, memberships.userId))
        .where(and(eq(users.id, userId), eq(users.role, 'practitioner')))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Practitioner not found' });
      }

      const practitioner = result[0];

      res.status(200).json({
        success: true,
        data: {
          id: practitioner.id,
          email: practitioner.email,
          firstName: practitioner.firstName,
          lastName: practitioner.lastName,
          phone: practitioner.phone || undefined,
          role: practitioner.role,
          membership: practitioner.membershipType
            ? {
                id: practitioner.membershipId,
                type: practitioner.membershipType,
                marketingAddon: practitioner.marketingAddon,
              }
            : null,
        },
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get practitioner details',
        error,
        {
          userId: req.user?.id,
          targetUserId: req.params.userId,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async updateMembership(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { userId } = req.params;
      const data = updateMembershipSchema.parse(req.body);

      // Verify practitioner exists and is a practitioner
      const practitioner = await db.query.users.findFirst({
        where: and(eq(users.id, userId), eq(users.role, 'practitioner')),
      });

      if (!practitioner) {
        return res.status(404).json({ success: false, error: 'Practitioner not found' });
      }

      // Get current membership
      const currentMembership = await db.query.memberships.findFirst({
        where: eq(memberships.userId, userId),
      });

      // Handle membership deletion (type: null)
      if (data.type === null && currentMembership) {
        await db.delete(memberships).where(eq(memberships.id, currentMembership.id));
        return res.status(200).json({
          success: true,
          data: null,
        });
      }

      // Update or create membership
      if (currentMembership) {
        // Update existing membership
        const updateData: {
          type?: 'permanent' | 'ad_hoc';
          marketingAddon?: boolean;
        } = {};

        if (data.type !== undefined && data.type !== null) {
          updateData.type = data.type;
        }

        if (data.marketingAddon !== undefined) {
          updateData.marketingAddon = data.marketingAddon;
          // If disabling marketing add-on, no type change needed
          // If enabling, we already validated type is permanent
        }

        // If type is being changed to ad_hoc, disable marketing add-on
        if (data.type === 'ad_hoc' && currentMembership.marketingAddon) {
          updateData.marketingAddon = false;
        }

        // Atomic conditional update: include expected current values in WHERE clause
        // to detect concurrent modifications (TOCTOU protection)
        const updatedRows = await db
          .update(memberships)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(memberships.id, currentMembership.id),
              eq(memberships.type, currentMembership.type),
              eq(memberships.marketingAddon, currentMembership.marketingAddon)
            )
          )
          .returning();

        // If no rows were updated, membership was modified concurrently
        if (updatedRows.length === 0) {
          return res.status(409).json({
            success: false,
            error: 'Membership was modified by another request. Please refresh and try again.',
          });
        }

        // Use the returned row from the update
        const updatedMembership = updatedRows[0];

        res.status(200).json({
          success: true,
          data: {
            id: updatedMembership.id,
            type: updatedMembership.type,
            marketingAddon: updatedMembership.marketingAddon,
          },
        });
      } else {
        // Create new membership
        if (!data.type || data.type === null) {
          return res.status(400).json({
            success: false,
            error: 'Membership type is required when creating a new membership',
          });
        }

        const [newMembership] = await db
          .insert(memberships)
          .values({
            userId,
            type: data.type,
            marketingAddon: data.marketingAddon ?? false,
          })
          .returning();

        res.status(200).json({
          success: true,
          data: {
            id: newMembership.id,
            type: newMembership.type,
            marketingAddon: newMembership.marketingAddon,
          },
        });
      }
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map((e) => e.message).join(', '),
        });
      }

      logger.error(
        'Failed to update membership',
        error,
        {
          userId: req.user?.id,
          targetUserId: req.params.userId,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const adminController = new AdminController();

