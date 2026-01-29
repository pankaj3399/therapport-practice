import { db } from '../config/database';
import { memberships } from '../db/schema';
import { eq } from 'drizzle-orm';
import { formatMonthYear } from '../utils/date.util';
import { logger } from '../utils/logger.util';
import * as CreditTransactionService from './credit-transaction.service';

export interface CreditSummary {
  currentMonth: {
    monthYear: string;
    totalGranted: number;
    totalUsed: number;
    remainingCredit: number;
  } | null;
  /** For ad_hoc there is no next-month allocation; nextMonthAllocation is 0. */
  nextMonth: {
    monthYear: string;
    nextMonthAllocation: number;
  } | null;
  membershipType: 'permanent' | 'ad_hoc' | null;
}

export class CreditService {
  /**
   * Get credit balance for a user.
   * For ad_hoc members: uses transaction-based credits (non-expired, sum of remainingAmount).
   * For permanent members: returns null (no monthly credit in this system).
   * Response shape is compatible with dashboard (currentMonth, nextMonth, membershipType).
   */
  static async getCreditBalance(userId: string): Promise<CreditSummary> {
    try {
      const membership = await db.query.memberships.findFirst({
        where: eq(memberships.userId, userId),
      });

      if (!membership || membership.type !== 'ad_hoc') {
        return {
          currentMonth: null,
          nextMonth: null,
          membershipType: membership?.type ?? null,
        };
      }

      const now = new Date();
      const currentMonthStr = formatMonthYear(now);
      const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const nextMonthStr = formatMonthYear(nextMonthDate);

      const totals = await CreditTransactionService.getCreditBalanceTotals(userId);

      return {
        currentMonth: {
          monthYear: currentMonthStr,
          totalGranted: totals.totalGranted,
          totalUsed: totals.totalUsed,
          remainingCredit: totals.totalAvailable,
        },
        nextMonth: {
          monthYear: nextMonthStr,
          nextMonthAllocation: 0,
        },
        membershipType: membership.type,
      };
    } catch (error) {
      const now = new Date();
      const currentMonthStr = formatMonthYear(now);
      const nextMonthStr = formatMonthYear(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      );
      logger.error(
        'Failed to get credit balance',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId,
          currentMonthYear: currentMonthStr,
          nextMonthYear: nextMonthStr,
        }
      );
      throw error;
    }
  }
}
