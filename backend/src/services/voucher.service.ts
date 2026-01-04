import { db } from '../config/database';
import { freeBookingVouchers } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface VoucherSummary {
  totalHoursAllocated: number;
  totalHoursUsed: number;
  remainingHours: number;
  earliestExpiry: string | null;
  vouchers: Array<{
    id: string;
    hoursAllocated: number;
    hoursUsed: number;
    remainingHours: number;
    expiryDate: string;
    reason: string | null;
  }>;
}

export class VoucherService {
  /**
   * Calculate remaining free booking hours for a user
   * Only includes active vouchers (not expired)
   */
  static async getRemainingFreeHours(userId: string): Promise<VoucherSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active (non-expired) vouchers for the user
    const activeVouchers = await db.query.freeBookingVouchers.findMany({
      where: and(
        eq(freeBookingVouchers.userId, userId),
        gte(freeBookingVouchers.expiryDate, today.toISOString().split('T')[0])
      ),
    });

    let totalHoursAllocated = 0;
    let totalHoursUsed = 0;

    const vouchers = activeVouchers.map((voucher) => {
      const allocated = parseFloat(voucher.hoursAllocated.toString());
      const used = parseFloat(voucher.hoursUsed.toString());
      const remaining = allocated - used;

      totalHoursAllocated += allocated;
      totalHoursUsed += used;

      return {
        id: voucher.id,
        hoursAllocated: allocated,
        hoursUsed: used,
        remainingHours: Math.max(0, remaining), // Don't go negative
        expiryDate: voucher.expiryDate,
        reason: voucher.reason,
      };
    });

    const totalRemaining = Math.max(0, totalHoursAllocated - totalHoursUsed);

    // Get the earliest expiry date for display
    // Compare expiryDate strings lexicographically (ISO YYYY-MM-DD format compares correctly as strings)
    const earliestExpiry = vouchers.reduce<string | null>((min, voucher) => {
      const expiryDate = voucher.expiryDate;
      if (!expiryDate || typeof expiryDate !== 'string' || expiryDate.trim() === '') {
        return min;
      }
      return min === null || expiryDate < min ? expiryDate : min;
    }, null);

    return {
      totalHoursAllocated,
      totalHoursUsed,
      remainingHours: totalRemaining,
      vouchers,
      earliestExpiry,
    };
  }
}
