import { db } from '../config/database';
import { creditTransactions, bookings, freeBookingVouchers, rooms, locations } from '../db/schema';
import { eq, and, gte, lte, asc, sql } from 'drizzle-orm';
import { getMonthRange } from '../utils/date.util';

/**
 * Format time from DB (string or Date) to "H:MMam/pm" format for display.
 */
function formatTimeForDisplay(t: string | Date): string {
  let hours: number;
  let minutes: number;
  
  if (typeof t === 'string') {
    const parts = t.trim().split(':');
    hours = parseInt(parts[0] || '0', 10);
    minutes = parseInt(parts[1] || '0', 10);
  } else {
    hours = t.getUTCHours();
    minutes = t.getUTCMinutes();
  }
  
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours % 12 || 12;
  const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
  return `${displayHour}${displayMinutes}${ampm}`;
}

export interface TransactionHistoryEntry {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive for credits, negative for spending, 0 for vouchers
  type: 'credit_grant' | 'credit_used' | 'booking' | 'voucher_allocation';
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
    .orderBy(asc(bookings.bookingDate), asc(bookings.startTime));

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
    });
  }

  // Get voucher allocations for the month
  const allVouchers = await db
    .select()
    .from(freeBookingVouchers)
    .where(eq(freeBookingVouchers.userId, userId))
    .orderBy(asc(freeBookingVouchers.createdAt));

  // Filter vouchers by month (createdAt is a timestamp)
  const vouchers = allVouchers.filter((voucher) => {
    const createdAtDate = voucher.createdAt.toISOString().split('T')[0];
    return createdAtDate >= firstDay && createdAtDate <= lastDay;
  });

  for (const voucher of vouchers) {
    const hours = parseFloat(voucher.hoursAllocated.toString());
    transactions.push({
      date: voucher.createdAt.toISOString().split('T')[0],
      description: `${hours} hours free booking expiring ${voucher.expiryDate} allocated`,
      amount: 0,
      type: 'voucher_allocation',
    });
  }

  // Sort all transactions by date, then by creation time
  transactions.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // For same date, prefer grants before bookings
    if (a.type === 'credit_grant' && b.type !== 'credit_grant') return -1;
    if (a.type !== 'credit_grant' && b.type === 'credit_grant') return 1;
    return 0;
  });

  return transactions;
}

