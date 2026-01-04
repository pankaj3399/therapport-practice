import { db } from '../config/database';
import { creditLedgers, memberships } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface CreditSummary {
  currentMonth: {
    monthYear: string;
    monthlyCredit: number;
    usedCredit: number;
    remainingCredit: number;
  } | null;
  nextMonth: {
    monthYear: string;
    monthlyCredit: number;
  } | null;
  membershipType: 'permanent' | 'ad_hoc' | null;
}

export class CreditService {
  /**
   * Get credit balance for a user
   * Only applies to ad-hoc members (permanent members don't have monthly credit)
   */
  static async getCreditBalance(userId: string): Promise<CreditSummary> {
    // Get user's membership
    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.userId, userId),
    });

    if (!membership || membership.type !== 'ad_hoc') {
      // Permanent members don't have monthly credit
      return {
        currentMonth: null,
        nextMonth: null,
        membershipType: membership?.type || null,
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Format: YYYY-MM-DD (first day of month)
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    
    // Calculate next month
    const nextMonthDate = new Date(currentYear, currentMonth, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth() + 1;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // Get current month's credit ledger
    const currentLedger = await db.query.creditLedgers.findFirst({
      where: and(
        eq(creditLedgers.userId, userId),
        eq(creditLedgers.monthYear, currentMonthStr)
      ),
    });

    // Get or create next month's credit ledger (for display)
    let nextLedger = await db.query.creditLedgers.findFirst({
      where: and(
        eq(creditLedgers.userId, userId),
        eq(creditLedgers.monthYear, nextMonthStr)
      ),
    });

    // If next month doesn't exist yet, we'll show the default credit amount
    const nextMonthCredit = nextLedger
      ? parseFloat(nextLedger.monthlyCredit.toString())
      : 105.00; // Default monthly credit for ad-hoc members

    const currentMonthData = currentLedger
      ? {
          monthYear: currentMonthStr,
          monthlyCredit: parseFloat(currentLedger.monthlyCredit.toString()),
          usedCredit: parseFloat(currentLedger.usedCredit.toString()),
          remainingCredit: parseFloat(currentLedger.remainingCredit.toString()),
        }
      : {
          monthYear: currentMonthStr,
          monthlyCredit: 105.00, // Default if not created yet
          usedCredit: 0,
          remainingCredit: 105.00,
        };

    return {
      currentMonth: currentMonthData,
      nextMonth: {
        monthYear: nextMonthStr,
        monthlyCredit: nextMonthCredit,
      },
      membershipType: membership.type,
    };
  }
}

