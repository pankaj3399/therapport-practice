import { db } from '../config/database';
import { bookings, rooms, locations, memberships, users, freeBookingVouchers } from '../db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { todayUtcString, formatTimeForEmail } from '../utils/date.util';
import * as PricingService from './pricing.service';
import * as CreditTransactionService from './credit-transaction.service';
import { VoucherService } from './voucher.service';
import { BookingValidationError, BookingNotFoundError } from '../errors/booking.errors';
import { logger } from '../utils/logger.util';
import { emailService } from './email.service';

type LocationName = PricingService.LocationName;

const ALLOWED_LOCATIONS: LocationName[] = ['Pimlico', 'Kensington'];

const ALLOWED_BOOKING_STATUSES = ['confirmed', 'cancelled', 'completed'] as const;

const TIME_PATTERN = /^\d{1,2}(:\d{1,2})?(:\d{1,2})?$/;

/**
 * Normalize time to "HH:mm:ss" for DB storage.
 * @throws {Error} Invalid time string if input is empty or does not match time pattern.
 */
function toTimeString(t: string): string {
  const trimmed = t.trim();
  if (!trimmed || !TIME_PATTERN.test(trimmed)) {
    throw new Error('Invalid time string');
  }
  const parts = trimmed.split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = (parts[1] ?? '00').padStart(2, '0');
  const s = (parts[2] ?? '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Parse time string to decimal hours for duration.
 */
function timeToHours(t: string): number {
  const parts = t.trim().split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const s = parseInt(parts[2] ?? '0', 10);
  return h + m / 60 + s / 3600;
}

/**
 * Check if user can make bookings: active membership, not suspended, ad_hoc within period.
 */
export async function canUserBook(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const [userRow] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) return { ok: false, reason: 'User not found' };
  if (userRow.status === 'suspended') return { ok: false, reason: 'Account is suspended' };

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!membership) return { ok: false, reason: 'No membership' };

  const today = todayUtcString();
  if (membership.type === 'ad_hoc') {
    if (membership.subscriptionEndDate && membership.subscriptionEndDate < today) {
      return { ok: false, reason: 'Ad-hoc subscription has ended' };
    }
    if (membership.suspensionDate && membership.suspensionDate <= today) {
      return { ok: false, reason: 'Membership is suspended' };
    }
  }
  return { ok: true };
}

/**
 * Get room with location name (for pricing). Throws if room not found.
 */
async function getRoomWithLocation(
  roomId: string
): Promise<{ room: typeof rooms.$inferSelect; locationName: LocationName }> {
  const rows = await db
    .select({ room: rooms, locationName: locations.name })
    .from(rooms)
    .innerJoin(locations, eq(rooms.locationId, locations.id))
    .where(eq(rooms.id, roomId))
    .limit(1);
  if (!rows.length) throw new BookingNotFoundError('Room not found');
  const loc = rows[0].locationName as string;
  if (!ALLOWED_LOCATIONS.includes(loc as LocationName)) {
    throw new BookingValidationError(
      `Invalid location: ${loc}. Allowed: ${ALLOWED_LOCATIONS.join(', ')}`
    );
  }
  return { room: rows[0].room, locationName: loc as LocationName };
}

/**
 * Check availability: no overlapping confirmed booking for same room on same date.
 */
export async function checkAvailability(
  roomId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const start = toTimeString(startTime);
  const end = toTimeString(endTime);
  const overlapping = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, roomId),
        eq(bookings.bookingDate, date),
        eq(bookings.status, 'confirmed'),
        sql`${bookings.startTime} < ${end}::time AND ${bookings.endTime} > ${start}::time`
      )
    )
    .limit(1);
  return overlapping.length === 0;
}

/**
 * Fetch all confirmed bookings for a room on a date (for availability computation).
 */
async function getConfirmedBookingsForRoomDate(
  roomId: string,
  date: string
): Promise<Array<{ startTime: string; endTime: string }>> {
  const rows = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, roomId),
        eq(bookings.bookingDate, date),
        eq(bookings.status, 'confirmed')
      )
    );
  return rows.map((r) => {
    const st = r.startTime as string | Date;
    const et = r.endTime as string | Date;
    return {
      startTime: toTimeString(
        typeof st === 'object' && st instanceof Date
          ? `${st.getUTCHours().toString().padStart(2, '0')}:${st.getUTCMinutes().toString().padStart(2, '0')}:${st.getUTCSeconds().toString().padStart(2, '0')}`
          : String(st)
      ),
      endTime: toTimeString(
        typeof et === 'object' && et instanceof Date
          ? `${et.getUTCHours().toString().padStart(2, '0')}:${et.getUTCMinutes().toString().padStart(2, '0')}:${et.getUTCSeconds().toString().padStart(2, '0')}`
          : String(et)
      ),
    };
  });
}

/**
 * Check if interval [start, end) overlaps any booking (times in "HH:mm:ss" or comparable).
 */
function timeRangesOverlap(
  start: string,
  end: string,
  bookings: Array<{ startTime: string; endTime: string }>
): boolean {
  const s = toTimeString(start);
  const e = toTimeString(end);
  return bookings.some((b) => b.startTime < e && b.endTime > s);
}

/**
 * Get rooms, optionally filtered by location name.
 */
export async function getRooms(locationName?: LocationName) {
  const conditions = [eq(rooms.active, true)];
  if (locationName) conditions.push(eq(locations.name, locationName));
  const rows = await db
    .select({
      id: rooms.id,
      locationId: rooms.locationId,
      name: rooms.name,
      roomNumber: rooms.roomNumber,
      active: rooms.active,
      locationName: locations.name,
    })
    .from(rooms)
    .innerJoin(locations, eq(rooms.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(asc(rooms.roomNumber));
  return rows.map((r) => ({
    id: r.id,
    locationId: r.locationId,
    name: r.name,
    roomNumber: parseFloat(r.roomNumber.toString()),
    active: r.active,
    locationName: r.locationName,
  }));
}

/**
 * Get available time slots for a room on a date (hourly 08:00-22:00).
 * Uses a single query for confirmed bookings, then computes availability in memory.
 */
export async function getAvailableSlots(
  roomId: string,
  date: string
): Promise<Array<{ startTime: string; endTime: string; available: boolean }>> {
  const existingBookings = await getConfirmedBookingsForRoomDate(roomId, date);
  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  for (let h = 8; h < 22; h++) {
    const start = `${h.toString().padStart(2, '0')}:00`;
    const end = `${(h + 1).toString().padStart(2, '0')}:00`;
    const available = !timeRangesOverlap(start, end, existingBookings);
    slots.push({ startTime: start, endTime: end, available });
  }
  return slots;
}

/**
 * Validate booking request: 1-month advance, within window, room exists, availability.
 */
export async function validateBookingRequest(
  userId: string,
  roomId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ valid: boolean; error?: string }> {
  const can = await canUserBook(userId);
  if (!can.ok) return { valid: false, error: can.reason };

  const today = todayUtcString();
  if (date < today) return { valid: false, error: 'Booking date must be today or in the future' };

  const [y, m, d] = today.split('-').map(Number);
  const maxDate = new Date(Date.UTC(y, m - 1, d));
  maxDate.setUTCMonth(maxDate.getUTCMonth() + 1);
  const maxDateStr = maxDate.toISOString().split('T')[0];
  if (date > maxDateStr)
    return { valid: false, error: 'Bookings can only be made up to 1 month in advance' };

  try {
    const { locationName } = await getRoomWithLocation(roomId);
    const dateObj = new Date(date + 'T12:00:00Z');
    PricingService.calculateTotalPrice(locationName, dateObj, startTime, endTime);
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid room or time' };
  }

  try {
    const available = await checkAvailability(roomId, date, startTime, endTime);
    if (!available) return { valid: false, error: 'Time slot is not available' };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid time string' };
  }

  return { valid: true };
}

/**
 * Create a booking using credits and/or vouchers. Rejects when insufficient credits (no Stripe in PR3).
 */
export async function createBooking(
  userId: string,
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
  bookingType: 'permanent_recurring' | 'ad_hoc' | 'free' | 'internal' = 'ad_hoc'
): Promise<{ id: string }> {
  const validation = await validateBookingRequest(userId, roomId, date, startTime, endTime);
  if (!validation.valid) throw new BookingValidationError(validation.error!);

  const { room, locationName } = await getRoomWithLocation(roomId);
  const dateObj = new Date(date + 'T12:00:00Z');
  const totalPrice = PricingService.calculateTotalPrice(locationName, dateObj, startTime, endTime);
  const durationHours = timeToHours(endTime) - timeToHours(startTime);
  if (durationHours <= 0) throw new BookingValidationError('Invalid booking span');

  const pricePerHour = totalPrice / durationHours;
  let startTimeDb: string;
  let endTimeDb: string;
  try {
    startTimeDb = toTimeString(startTime);
    endTimeDb = toTimeString(endTime);
  } catch {
    throw new BookingValidationError('Invalid time string');
  }
  const todayStr = todayUtcString();

  const result = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1);
    if (!membership) throw new BookingValidationError('No membership');

    const voucherRows = await tx
      .select()
      .from(freeBookingVouchers)
      .where(
        and(eq(freeBookingVouchers.userId, userId), gte(freeBookingVouchers.expiryDate, todayStr))
      )
      .orderBy(asc(freeBookingVouchers.expiryDate));
    const remainingVoucherHours = voucherRows.reduce((sum, v) => {
      const used = parseFloat(v.hoursUsed.toString());
      const allocated = parseFloat(v.hoursAllocated.toString());
      return sum + Math.max(0, allocated - used);
    }, 0);
    const voucherHoursToUse = Math.min(remainingVoucherHours, durationHours);
    const totalPriceCents = Math.round(totalPrice * 100);
    const creditAmountCents =
      voucherHoursToUse >= durationHours
        ? 0
        : Math.round((totalPriceCents * (durationHours - voucherHoursToUse)) / durationHours);
    const creditAmountNeeded = creditAmountCents / 100;

    const [created] = await tx
      .insert(bookings)
      .values({
        userId,
        roomId,
        membershipId: membership.id,
        bookingDate: date,
        startTime: startTimeDb,
        endTime: endTimeDb,
        pricePerHour: pricePerHour.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        status: 'confirmed',
        bookingType,
      })
      .returning({ id: bookings.id });
    if (!created) throw new BookingValidationError('Failed to create booking');

    if (voucherHoursToUse > 0) {
      let remainingToDeduct = voucherHoursToUse;
      for (const v of voucherRows) {
        if (remainingToDeduct <= 0) break;
        const used = parseFloat(v.hoursUsed.toString());
        const allocated = parseFloat(v.hoursAllocated.toString());
        const remaining = allocated - used;
        const deduct = Math.min(remaining, remainingToDeduct);
        await tx
          .update(freeBookingVouchers)
          .set({
            hoursUsed: (used + deduct).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(freeBookingVouchers.id, v.id));
        remainingToDeduct -= deduct;
      }
    }

    if (creditAmountNeeded > 0) {
      await CreditTransactionService.useCreditsWithinTransaction(tx, userId, creditAmountNeeded);
    }

    return { id: created.id, creditUsed: creditAmountNeeded };
  });

  // Send confirmation email (fire-and-forget; do not fail the request if email fails)
  const [userRow] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow) {
    const creditUsed = result.creditUsed > 0 ? result.creditUsed.toFixed(2) : undefined;
    emailService
      .sendBookingConfirmation({
        firstName: userRow.firstName,
        email: userRow.email,
        roomName: room.name,
        locationName,
        bookingDate: date,
        startTime: startTimeDb,
        endTime: endTimeDb,
        totalPrice: totalPrice.toFixed(2),
        creditUsed,
      })
      .catch((err) =>
        logger.error('Failed to send booking confirmation email', err, {
          userId,
          bookingId: result.id,
        })
      );
  }

  return { id: result.id };
}

/**
 * Cancel a booking and refund credits (full amount as manual credit for PR3; voucher hours not refunded).
 * Booking update and credit grant run in a single transaction so both succeed or both roll back.
 */
export async function cancelBooking(bookingId: string, userId: string): Promise<void> {
  let emailData: {
    firstName: string;
    email: string;
    roomName: string;
    locationName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    refundAmount: string;
  } | null = null;

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        booking: bookings,
        userEmail: users.email,
        userFirstName: users.firstName,
        roomName: rooms.name,
        locationName: locations.name,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .innerJoin(locations, eq(rooms.locationId, locations.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
      .limit(1);

    if (!row) throw new BookingNotFoundError('Booking not found');
    const booking = row.booking;
    if (booking.status === 'cancelled')
      throw new BookingValidationError('Booking is already cancelled');

    const totalPrice = parseFloat(booking.totalPrice.toString());
    await tx
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled by user',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    if (totalPrice > 0) {
      const bookingDate = String(booking.bookingDate);
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(bookingDate)) {
        throw new BookingValidationError(
          `Invalid booking date format for refund: ${bookingDate}. Expected YYYY-MM or YYYY-MM-DD.`
        );
      }
      const parts = bookingDate.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      if (m < 1 || m > 12) {
        throw new BookingValidationError(
          `Invalid month in booking date: ${bookingDate}. Month must be 1-12.`
        );
      }
      const lastDay = new Date(Date.UTC(y, m, 0));
      const expiryDate = lastDay.toISOString().split('T')[0];
      // TODO(PR3): Temporary behavior. Replace with logic to refund/restore original debit transactions (or preserve original expiries) in a future change.
      logger.info('Manual end-of-month grant created for booking cancellation', {
        bookingId,
        bookingDate: booking.bookingDate,
        totalPrice,
        expiryDate,
        grantType: 'manual',
      });
      await CreditTransactionService.grantCreditsWithinTransaction(
        tx,
        userId,
        totalPrice,
        expiryDate,
        'manual',
        undefined,
        'Refund for booking cancellation'
      );
    }

    emailData = {
      firstName: row.userFirstName,
      email: row.userEmail,
      roomName: String(row.roomName),
      locationName: String(row.locationName),
      bookingDate: String(booking.bookingDate),
      startTime: formatTimeForEmail(booking.startTime as string | Date),
      endTime: formatTimeForEmail(booking.endTime as string | Date),
      refundAmount: totalPrice.toFixed(2),
    };
  });

  if (emailData) {
    emailService.sendBookingCancellation(emailData).catch((err) =>
      logger.error('Failed to send booking cancellation email', err, {
        userId,
        bookingId,
      })
    );
  }
}

/**
 * Get a single booking by id (must belong to user).
 */
export async function getBookingById(
  bookingId: string,
  userId: string
): Promise<{
  id: string;
  roomId: string;
  roomName: string;
  locationName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  totalPrice: number;
  status: string;
  bookingType: string;
} | null> {
  const rows = await db
    .select({
      booking: bookings,
      roomName: rooms.name,
      locationName: locations.name,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(locations, eq(rooms.locationId, locations.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
    .limit(1);
  if (!rows.length) return null;
  const { booking: b, roomName, locationName } = rows[0];
  return {
    id: b.id,
    roomId: b.roomId,
    roomName,
    locationName,
    bookingDate: b.bookingDate,
    startTime: b.startTime,
    endTime: b.endTime,
    pricePerHour: parseFloat(b.pricePerHour.toString()),
    totalPrice: parseFloat(b.totalPrice.toString()),
    status: b.status,
    bookingType: b.bookingType,
  };
}

/**
 * Get user's bookings with room and location info.
 */
export async function getUserBookings(
  userId: string,
  filters?: { fromDate?: string; toDate?: string; status?: string }
) {
  const conditions = [eq(bookings.userId, userId)];
  if (filters?.fromDate) conditions.push(gte(bookings.bookingDate, filters.fromDate));
  if (filters?.toDate) conditions.push(sql`${bookings.bookingDate} <= ${filters.toDate}`);
  if (filters?.status) {
    const status = filters.status;
    if (status !== 'confirmed' && status !== 'cancelled' && status !== 'completed') {
      throw new BookingValidationError(
        `Invalid status: ${filters.status}. Allowed: ${ALLOWED_BOOKING_STATUSES.join(', ')}`
      );
    }
    conditions.push(eq(bookings.status, status));
  }

  const rows = await db
    .select({
      booking: bookings,
      roomName: rooms.name,
      locationName: locations.name,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(locations, eq(rooms.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(asc(bookings.bookingDate), asc(bookings.startTime));

  return rows.map(({ booking: b, roomName, locationName }) => ({
    id: b.id,
    roomId: b.roomId,
    roomName,
    locationName,
    bookingDate: b.bookingDate,
    startTime: b.startTime,
    endTime: b.endTime,
    pricePerHour: parseFloat(b.pricePerHour.toString()),
    totalPrice: parseFloat(b.totalPrice.toString()),
    status: b.status,
    bookingType: b.bookingType,
  }));
}
