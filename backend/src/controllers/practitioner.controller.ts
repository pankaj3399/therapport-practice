import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/database';
import { bookings, rooms, locations, memberships } from '../db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { VoucherService } from '../services/voucher.service';
import { CreditService } from '../services/credit.service';
import { logger } from '../utils/logger.util';

export class PractitionerController {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get free booking hours
      const voucherSummary = await VoucherService.getRemainingFreeHours(userId);

      // Get credit balance
      const creditSummary = await CreditService.getCreditBalance(userId);

      // Get upcoming bookings (confirmed, not cancelled, in the future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get upcoming bookings with room and location info
      const upcomingBookingsData = await db
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
            eq(bookings.status, 'confirmed'),
            gte(bookings.bookingDate, today.toISOString().split('T')[0])
          )
        )
        .orderBy(asc(bookings.bookingDate), asc(bookings.startTime))
        .limit(10);

      // Format bookings for response
      const formattedBookings = upcomingBookingsData.map(({ booking, room, location }) => ({
        id: booking.id,
        roomName: room.name,
        locationName: location.name,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalPrice: parseFloat(booking.totalPrice.toString()),
        status: booking.status,
      }));

      res.status(200).json({
        success: true,
        data: {
          freeBookingHours: {
            remaining: voucherSummary.remainingHours,
            totalAllocated: voucherSummary.totalHoursAllocated,
            totalUsed: voucherSummary.totalHoursUsed,
            earliestExpiry: voucherSummary.earliestExpiry,
          },
          credit: creditSummary,
          upcomingBookings: formattedBookings,
        },
      });
    } catch (error: any) {
      logger.error(
        'Failed to get dashboard data',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }
}

export const practitionerController = new PractitionerController();

