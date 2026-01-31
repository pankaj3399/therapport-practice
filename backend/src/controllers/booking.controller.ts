import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as BookingService from '../services/booking.service';
import { CreditService } from '../services/credit.service';
import { logger } from '../utils/logger.util';
import { BookingServiceError } from '../errors/booking.errors';

const DEFAULT_STATUS = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** Strict HH:MM (00:00–23:59). */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BookingController {
  async getBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
      const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const list = await BookingService.getUserBookings(req.user!.id, { fromDate, toDate, status });
      res.status(200).json({ success: true, bookings: list });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get bookings',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bookings',
      });
    }
  }

  async getBookingById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const booking = await BookingService.getBookingById(id, req.user!.id);
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }
      res.status(200).json({ success: true, booking });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get booking',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id, bookingId: req.params.id }
      );
      res.status(status).json({ success: false, error: 'Failed to get booking' });
    }
  }

  async getAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      if (!roomId || !date) {
        res.status(400).json({ success: false, error: 'roomId and date are required' });
        return;
      }
      const slots = await BookingService.getAvailableSlots(roomId, date);
      res.status(200).json({ success: true, slots });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get availability',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get availability',
      });
    }
  }

  async getQuote(req: AuthRequest, res: Response): Promise<void> {
    try {
      const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const startTime = typeof req.query.startTime === 'string' ? req.query.startTime : undefined;
      const endTime = typeof req.query.endTime === 'string' ? req.query.endTime : undefined;
      if (!roomId || !date || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          error: 'roomId, date, startTime and endTime are required',
        });
        return;
      }
      if (!UUID_REGEX.test(String(roomId))) {
        res.status(400).json({ success: false, error: 'Invalid roomId format' });
        return;
      }
      if (!DATE_REGEX.test(String(date))) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }
      if (!TIME_REGEX.test(String(startTime).trim()) || !TIME_REGEX.test(String(endTime).trim())) {
        res.status(400).json({
          success: false,
          error: 'Invalid time format. Use HH:MM',
        });
        return;
      }
      const result = await BookingService.getBookingQuote(roomId, date, startTime, endTime);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get quote';
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get booking quote',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({ success: false, error: message });
    }
  }

  async getCalendar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const location = typeof req.query.location === 'string' ? req.query.location : undefined;
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      if (!location || !date) {
        res.status(400).json({ success: false, error: 'location and date are required' });
        return;
      }
      if (location !== 'Pimlico' && location !== 'Kensington') {
        res
          .status(400)
          .json({ success: false, error: 'Invalid location. Allowed: Pimlico, Kensington' });
        return;
      }
      if (!DATE_REGEX.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }
      const includeBookerNames = req.user?.role === 'admin';
      const result = await BookingService.getDayCalendar(location, date, includeBookerNames);
      res.status(200).json({ success: true, rooms: result.rooms, bookings: result.bookings });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get calendar',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get calendar',
      });
    }
  }

  async getRooms(req: AuthRequest, res: Response): Promise<void> {
    try {
      const location = typeof req.query.location === 'string' ? req.query.location : undefined;
      if (location !== undefined && location !== 'Pimlico' && location !== 'Kensington') {
        res
          .status(400)
          .json({ success: false, error: 'Invalid location. Allowed: Pimlico, Kensington' });
        return;
      }
      const rooms = await BookingService.getRooms(location);
      res.status(200).json({ success: true, rooms });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get rooms',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get rooms',
      });
    }
  }

  async createBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { roomId, date, startTime, endTime, bookingType } = req.body;
      if (!roomId || !date || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          error: 'roomId, date, startTime and endTime are required',
        });
        return;
      }
      if (!UUID_REGEX.test(String(roomId))) {
        res.status(400).json({ success: false, error: 'Invalid roomId format' });
        return;
      }
      if (!DATE_REGEX.test(String(date))) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }
      if (!TIME_REGEX.test(String(startTime).trim()) || !TIME_REGEX.test(String(endTime).trim())) {
        res.status(400).json({
          success: false,
          error: 'Invalid time format. Use HH:MM',
        });
        return;
      }
      const ALLOWED_BOOKING_TYPES = ['permanent_recurring', 'ad_hoc', 'free', 'internal'] as const;
      const type = req.body.bookingType;
      if (
        type !== 'permanent_recurring' &&
        type !== 'ad_hoc' &&
        type !== 'free' &&
        type !== 'internal'
      ) {
        res.status(400).json({
          success: false,
          error: 'Invalid bookingType',
          allowed: [...ALLOWED_BOOKING_TYPES],
        });
        return;
      }
      if ((type === 'free' || type === 'internal') && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Only admins can create free or internal bookings',
        });
        return;
      }
      const result = await BookingService.createBooking(
        req.user!.id,
        roomId,
        date,
        startTime,
        endTime,
        type
      );
      if ('paymentRequired' in result && result.paymentRequired) {
        res.status(200).json({
          success: true,
          paymentRequired: true,
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          amountPence: result.amountPence,
        });
        return;
      }
      if ('id' in result) {
        res.status(201).json({ success: true, booking: { id: result.id } });
        return;
      }
      res.status(500).json({ success: false, error: 'Unexpected booking result' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create booking';
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to create booking',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({ success: false, error: message });
    }
  }

  async cancelBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await BookingService.cancelBooking(id, req.user!.id);
      res.status(200).json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel booking';
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to cancel booking',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id, bookingId: req.params.id }
      );
      res.status(status).json({ success: false, error: message });
    }
  }

  async getCredits(req: AuthRequest, res: Response): Promise<void> {
    try {
      const balance = await CreditService.getCreditBalance(req.user!.id);
      res.status(200).json({ success: true, credit: balance });
    } catch (error) {
      const status = error instanceof BookingServiceError ? error.statusCode : DEFAULT_STATUS;
      logger.error(
        'Failed to get credit balance',
        error instanceof Error ? error : new Error(String(error)),
        { userId: req.user?.id }
      );
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get credit balance',
      });
    }
  }
}

export const bookingController = new BookingController();
