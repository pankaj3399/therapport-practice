import { Request, Response } from 'express';
import { ReminderService } from '../services/reminder.service';
import { emailService } from '../services/email.service';
import { db } from '../config/database';
import { users, bookings, rooms, locations, memberships } from '../db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { logger } from '../utils/logger.util';
import { addDaysUtcString, formatTimeForEmail, todayUtcString } from '../utils/date.util';
import type { DocumentReminderMetadata } from '../services/reminder.service';

export class CronController {
  /**
   * Safely mark a reminder as failed, catching and logging any errors without rethrowing
   */
  private async safeMarkFailed(reminderId: string, notificationType: string): Promise<void> {
    try {
      await ReminderService.markReminderFailed(reminderId);
    } catch (error) {
      logger.error('Failed to mark reminder as failed', error, {
        reminderId,
        notificationType,
      });
    }
  }

  /**
   * Safely mark a reminder as sent, catching and logging any errors without rethrowing
   */
  private async safeMarkSent(reminderId: string, notificationType: string): Promise<void> {
    try {
      await ReminderService.markReminderSent(reminderId);
    } catch (error) {
      logger.error('Failed to mark reminder as sent', error, {
        reminderId,
        notificationType,
      });
    }
  }

  /**
   * Internal function to process pending reminders
   * Returns a result object with processed, failed, and total counts
   * This can be called directly (e.g., from node-cron) or via HTTP endpoint
   */
  async processRemindersInternal(): Promise<{ processed: number; failed: number; total: number }> {
    logger.info('Starting reminder processing');

    // Get pending reminders
    const pendingReminders = await ReminderService.getPendingReminders();

    if (pendingReminders.length === 0) {
      logger.info('No pending reminders found to process');
      return { processed: 0, failed: 0, total: 0 };
    }

    logger.info(`Found ${pendingReminders.length} pending reminder(s) to process`);

    let processed = 0;
    let failed = 0;

    // Collect all unique userIds from reminders
    const userIds = Array.from(
      new Set(pendingReminders.map((r) => r.userId).filter((id): id is string => id !== null))
    );

    // Fetch all users in a single query to avoid N+1 problem
    const allUsers =
      userIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, userIds),
          })
        : [];

    // Build in-memory map for O(1) lookup
    const userMap = new Map(allUsers.map((user) => [user.id, user]));

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        if (!reminder.userId) {
          logger.warn('Reminder has no userId, skipping', { reminderId: reminder.id });
          await this.safeMarkFailed(reminder.id, reminder.notificationType);
          failed++;
          continue;
        }

        // Get user details from map
        const user = userMap.get(reminder.userId);

        if (!user) {
          logger.warn('User not found for reminder', {
            reminderId: reminder.id,
            userId: reminder.userId,
          });
          await this.safeMarkFailed(reminder.id, reminder.notificationType);
          failed++;
          continue;
        }

        const metadata = reminder.metadata as DocumentReminderMetadata | null;
        if (!metadata) {
          logger.warn('Reminder metadata is invalid', { reminderId: reminder.id });
          await this.safeMarkFailed(reminder.id, reminder.notificationType);
          failed++;
          continue;
        }

        // Determine reminder type and send appropriate email
        if (reminder.notificationType.endsWith('_expiry_reminder')) {
          // Send reminder to practitioner
          await emailService.sendDocumentExpiryReminder({
            firstName: user.firstName,
            email: user.email,
            documentType: metadata.documentType,
            documentName: metadata.documentName,
            expiryDate: metadata.expiryDate,
          });
        } else if (
          reminder.notificationType.endsWith('_expiry_escalation') ||
          reminder.notificationType.endsWith('_expiry_final_escalation')
        ) {
          // Send escalation to admin
          // Parse and validate expiryDate
          const expiryDate = new Date(metadata.expiryDate);
          if (isNaN(expiryDate.getTime())) {
            logger.warn('Invalid expiryDate in reminder metadata', {
              reminderId: reminder.id,
              notificationType: reminder.notificationType,
              expiryDate: metadata.expiryDate,
            });
            // Treat daysOverdue as 0 for invalid dates
            await emailService.sendAdminEscalation({
              practitionerName: `${user.firstName} ${user.lastName}`,
              practitionerEmail: user.email,
              documentType: metadata.documentType,
              documentName: metadata.documentName,
              expiryDate: metadata.expiryDate,
              daysOverdue: 0,
            });
          } else {
            // Normalize dates and compute daysOverdue
            const MS_PER_DAY = 1000 * 60 * 60 * 24;
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const normalizedExpiry = new Date(expiryDate);
            normalizedExpiry.setUTCHours(0, 0, 0, 0);
            const daysOverdue = Math.max(
              0,
              Math.ceil((today.getTime() - normalizedExpiry.getTime()) / MS_PER_DAY)
            );

            await emailService.sendAdminEscalation({
              practitionerName: `${user.firstName} ${user.lastName}`,
              practitionerEmail: user.email,
              documentType: metadata.documentType,
              documentName: metadata.documentName,
              expiryDate: metadata.expiryDate,
              daysOverdue,
            });
          }
        } else {
          logger.warn('Unknown reminder type', {
            reminderId: reminder.id,
            notificationType: reminder.notificationType,
          });
          await this.safeMarkFailed(reminder.id, reminder.notificationType);
          failed++;
          continue;
        }

        // Mark reminder as sent
        await this.safeMarkSent(reminder.id, reminder.notificationType);
        processed++;

        logger.info('Reminder processed successfully', {
          reminderId: reminder.id,
          userId: reminder.userId ?? undefined,
          notificationType: reminder.notificationType,
        });
      } catch (error) {
        logger.error('Failed to process reminder', error, {
          reminderId: reminder.id,
          userId: reminder.userId ?? undefined,
          notificationType: reminder.notificationType,
        });
        await this.safeMarkFailed(reminder.id, reminder.notificationType);
        failed++;
      }
    }

    logger.info('Reminder processing completed', {
      processed,
      failed,
      total: pendingReminders.length,
    });

    return { processed, failed, total: pendingReminders.length };
  }

  /**
   * Process 48h booking reminders: find confirmed bookings in 2 days and send reminder emails.
   * Returns processed, failed, and total counts.
   */
  async processBookingRemindersInternal(): Promise<{
    processed: number;
    failed: number;
    total: number;
  }> {
    logger.info('Starting 48h booking reminder processing');

    const dateIn2Days = addDaysUtcString(2);

    const rows = await db
      .select({
        bookingId: bookings.id,
        userId: bookings.userId,
        bookingDate: bookings.bookingDate,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        userEmail: users.email,
        userFirstName: users.firstName,
        roomName: rooms.name,
        locationName: locations.name,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .innerJoin(locations, eq(rooms.locationId, locations.id))
      .where(and(eq(bookings.status, 'confirmed'), eq(bookings.bookingDate, dateIn2Days)));

    if (rows.length === 0) {
      logger.info('No bookings in 48h window to remind');
      return { processed: 0, failed: 0, total: 0 };
    }

    logger.info(`Found ${rows.length} booking(s) in 48h window to remind`);

    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const bookingDateStr = String(row.bookingDate);
        await emailService.sendBookingReminder({
          firstName: row.userFirstName,
          email: row.userEmail,
          roomName: String(row.roomName),
          locationName: String(row.locationName),
          bookingDate: bookingDateStr,
          startTime: formatTimeForEmail(row.startTime as string | Date),
          endTime: formatTimeForEmail(row.endTime as string | Date),
        });
        processed++;
        logger.info('Booking reminder sent', {
          bookingId: row.bookingId,
          userId: row.userId,
          bookingDate: bookingDateStr,
        });
      } catch (error) {
        logger.error('Failed to send booking reminder', error, {
          bookingId: row.bookingId,
          userId: row.userId,
        });
        failed++;
      }
    }

    logger.info('48h booking reminder processing completed', {
      processed,
      failed,
      total: rows.length,
    });

    return { processed, failed, total: rows.length };
  }

  /**
   * Process suspension: find memberships where suspensionDate = today, set user status to suspended, send suspension email.
   * DB update determines suspension success (suspended count); email failures are tracked separately (failedEmail).
   */
  async processSuspensionInternal(): Promise<{
    suspended: number;
    failedEmail: number;
    total: number;
  }> {
    const todayStr = todayUtcString();
    logger.info('Starting suspension processing', { todayStr });
    const rows = await db
      .select({
        userId: memberships.userId,
        suspensionDate: memberships.suspensionDate,
        userEmail: users.email,
        userFirstName: users.firstName,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.suspensionDate, todayStr), eq(users.status, 'active')));

    if (rows.length === 0) {
      return { suspended: 0, failedEmail: 0, total: 0 };
    }

    let suspended = 0;
    let failedEmail = 0;
    for (const row of rows) {
      try {
        await db
          .update(users)
          .set({ status: 'suspended', updatedAt: new Date() })
          .where(eq(users.id, row.userId));
        suspended++;
      } catch (error) {
        logger.error('Failed to suspend user', error, { userId: row.userId });
        continue;
      }
      const suspensionDateStr =
        row.suspensionDate != null ? String(row.suspensionDate).slice(0, 10) : todayStr;
      try {
        await emailService.sendSuspensionNotice({
          firstName: row.userFirstName,
          email: row.userEmail,
          suspensionDate: suspensionDateStr,
        });
      } catch (error) {
        logger.error('Failed to send suspension notice email', error, { userId: row.userId });
        failedEmail++;
      }
    }
    return { suspended, failedEmail, total: rows.length };
  }

  /**
   * Process pending reminders
   * This endpoint is called by:
   * - Vercel Cron Jobs (Authorization: Bearer ${CRON_SECRET})
   * - External services like node-cron (Authorization: Bearer ${CRON_SECRET})
   */
  async processReminders(req: Request, res: Response) {
    const startTime = new Date().toISOString();

    // Log request for debugging
    logger.info('Cron endpoint hit', {
      timestamp: startTime,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      hasAuthorization: Boolean(req.headers['authorization']),
    });

    try {
      // Extract and normalize Authorization header
      const authorizationHeaderRaw = req.headers['authorization'];
      const expectedSecret = process.env.CRON_SECRET;

      // Normalize authorization header (can be string | string[] | undefined)
      const authorizationHeader = Array.isArray(authorizationHeaderRaw)
        ? authorizationHeaderRaw[0]
        : authorizationHeaderRaw;

      // Check if authorization header matches Bearer ${CRON_SECRET}
      if (!expectedSecret || authorizationHeader !== `Bearer ${expectedSecret}`) {
        logger.warn('Unauthorized cron request attempt', {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
        });
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      logger.info('Cron request authenticated successfully');

      // Process document reminders, 48h booking reminders, and suspension
      const documentResult = await this.processRemindersInternal();
      const bookingResult = await this.processBookingRemindersInternal();
      const suspensionResult = await this.processSuspensionInternal();

      const totalProcessed =
        documentResult.processed + bookingResult.processed + suspensionResult.suspended;
      const totalFailed =
        documentResult.failed + bookingResult.failed + suspensionResult.failedEmail;
      const totalItems = documentResult.total + bookingResult.total + suspensionResult.total;

      if (totalItems === 0) {
        logger.info('Cron job completed: No pending reminders or suspensions to process', {
          processed: 0,
          failed: 0,
          total: 0,
        });
        return res.status(200).json({
          success: true,
          message: 'No pending reminders or suspensions to process',
          processed: 0,
          documentReminders: documentResult,
          bookingReminders: bookingResult,
          suspension: suspensionResult,
        });
      }

      logger.info('Cron job completed successfully', {
        processed: totalProcessed,
        failed: totalFailed,
        total: totalItems,
        documentReminders: documentResult,
        bookingReminders: bookingResult,
        suspension: suspensionResult,
      });

      res.status(200).json({
        success: true,
        message: `Processed ${totalProcessed} items, ${totalFailed} failed`,
        processed: totalProcessed,
        failed: totalFailed,
        total: totalItems,
        documentReminders: documentResult,
        bookingReminders: bookingResult,
        suspension: suspensionResult,
      });
    } catch (error) {
      logger.error('Failed to process reminders', error, {
        method: req.method,
        url: req.originalUrl,
        timestamp: startTime,
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const cronController = new CronController();
