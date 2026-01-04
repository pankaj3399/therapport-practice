import { db } from '../config/database';
import { creditLedgers, memberships } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMonthYear } from '../utils/date.util';

const DEFAULT_MONTHLY_CREDIT = 105.0;

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
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1; // 1-12

    // Format: YYYY-MM-DD (first day of month in UTC)
    // Use Date.UTC to create dates in UTC timezone
    const currentMonthStr = formatMonthYear(new Date(Date.UTC(currentYear, currentMonth - 1, 1)));

    // Calculate next month in UTC
    const nextMonthDate = new Date(Date.UTC(currentYear, currentMonth, 1));
    const nextMonthStr = formatMonthYear(nextMonthDate);

    // Get current month's credit ledger
    const currentLedger = await db.query.creditLedgers.findFirst({
      where: and(eq(creditLedgers.userId, userId), eq(creditLedgers.monthYear, currentMonthStr)),
    });

    // Get or create next month's credit ledger (for display)
    let nextLedger = await db.query.creditLedgers.findFirst({
      where: and(eq(creditLedgers.userId, userId), eq(creditLedgers.monthYear, nextMonthStr)),
    });

    // If next month doesn't exist yet, we'll show the default credit amount
    const nextMonthCredit = nextLedger
      ? parseFloat(nextLedger.monthlyCredit.toString())
      : DEFAULT_MONTHLY_CREDIT;

    const currentMonthData = currentLedger
      ? {
          monthYear: currentMonthStr,
          monthlyCredit: parseFloat(currentLedger.monthlyCredit.toString()),
          usedCredit: parseFloat(currentLedger.usedCredit.toString()),
          remainingCredit: parseFloat(currentLedger.remainingCredit.toString()),
        }
      : {
          monthYear: currentMonthStr,
          monthlyCredit: DEFAULT_MONTHLY_CREDIT,
          usedCredit: 0,
          remainingCredit: DEFAULT_MONTHLY_CREDIT,
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
