import { db } from '../config/database';
import { creditTransactions, bookings, freeBookingVouchers, rooms, locations } from '../db/schema';
import { eq, and, gte, lte, asc, sql } from 'drizzle-orm';
import { getMonthRange, formatTimeForDisplay } from '../utils/date.util';

export interface TransactionHistoryEntry {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive for credits, negative for spending, 0 for vouchers
  type: 'credit_grant' | 'credit_used' | 'booking' | 'voucher_allocation';
  createdAt?: Date; // Internal field for sorting (not exposed to frontend)
}

/**
 * Get transaction history for a user for a specific month.
 * Combines credit transactions, bookings, and voucher allocations.
 */
export async function getTransactionHistory(
  userId: string,
  month: string // YYYY-MM format
): Promise<TransactionHistoryEntry[]> {
  const { firstDay, lastDay } = getMonthRange(`${month}-01`);
  const transactions: TransactionHistoryEntry[] = [];

  // Get credit transactions (grants) for the month
  const creditGrants = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        gte(creditTransactions.grantDate, firstDay),
        lte(creditTransactions.grantDate, lastDay),
        eq(creditTransactions.revoked, false)
      )
    )
    .orderBy(asc(creditTransactions.grantDate), asc(creditTransactions.createdAt));

  for (const grant of creditGrants) {
    const amount = parseFloat(grant.amount.toString());
    let description = grant.description || 'Credit grant';
    
    // Format description based on source type
    if (grant.sourceType === 'ad_hoc_subscription') {
      description = 'Ad hoc membership Stripe credit';
    } else if (grant.sourceType === 'monthly_subscription') {
      description = 'Monthly subscription credit';
    } else if (grant.sourceType === 'pay_difference') {
      description = 'Stripe transaction';
    } else if (grant.sourceType === 'manual') {
      description = grant.description || 'Manual credit allocation';
    }

    transactions.push({
      date: grant.grantDate,
      description,
      amount,
      type: 'credit_grant',
      createdAt: grant.createdAt,
    });
  }

  // Get bookings for the month
  const bookingRows = await db
    .select({
      booking: bookings,
      room: rooms,
      location: locations,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(locations, eq(rooms.locationId, locations.id))
    .where(
      and(
        eq(bookings.userId, userId),
        gte(bookings.bookingDate, firstDay),
        lte(bookings.bookingDate, lastDay),
        eq(bookings.status, 'confirmed')
      )
    )
    .orderBy(asc(bookings.bookingDate), asc(bookings.createdAt));

  for (const { booking, room, location } of bookingRows) {
    const startTime = formatTimeForDisplay(booking.startTime);
    const endTime = formatTimeForDisplay(booking.endTime);
    const creditUsed = parseFloat(booking.creditUsed.toString());
    
    // Show the credit used as negative (what was deducted from credits)
    // The pay_difference Stripe transaction will show separately as positive
    transactions.push({
      date: booking.bookingDate,
      description: `Booking ${room.name}, ${startTime} to ${endTime}`,
      amount: -creditUsed,
      type: 'booking',
      createdAt: booking.createdAt,
    });
  }

  // Get voucher allocations for the month
  // Convert firstDay/lastDay strings to Date objects for timestamp comparison
  const firstDayDate = new Date(firstDay + 'T00:00:00Z');
  const lastDayDate = new Date(lastDay + 'T23:59:59.999Z');
  
  const vouchers = await db
    .select()
    .from(freeBookingVouchers)
    .where(
      and(
        eq(freeBookingVouchers.userId, userId),
        gte(freeBookingVouchers.createdAt, firstDayDate),
        lte(freeBookingVouchers.createdAt, lastDayDate)
      )
    )
    .orderBy(asc(freeBookingVouchers.createdAt));

  for (const voucher of vouchers) {
    const hours = parseFloat(voucher.hoursAllocated.toString());
    
    // Format expiry date as DD.MM.YYYY
    const [year, month, day] = voucher.expiryDate.split('-');
    const formattedExpiryDate = `${day}.${month}.${year}`;
    
    transactions.push({
      date: voucher.createdAt.toISOString().split('T')[0],
      description: `${hours} hours free booking expiring ${formattedExpiryDate} allocated`,
      amount: 0,
      type: 'voucher_allocation',
      createdAt: voucher.createdAt,
    });
  }

  // Sort all transactions by date, then by creation time (chronological order)
  transactions.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // For same date, sort by creation timestamp (chronological order)
    if (a.createdAt && b.createdAt) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    // Fallback: if createdAt is missing, maintain current order
    return 0;
  });

  // Remove createdAt from final result (it was only used for sorting)
  return transactions.map(({ createdAt, ...rest }) => rest);

  return transactions;
}

