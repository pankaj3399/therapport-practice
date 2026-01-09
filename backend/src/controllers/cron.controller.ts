import { Request, Response } from 'express';
import { ReminderService } from '../services/reminder.service';
import { emailService } from '../services/email.service';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.util';
import type { DocumentReminderMetadata } from '../services/reminder.service';

export class CronController {
  /**
   * Process pending reminders
   * This endpoint is called by:
   * - Vercel Cron Jobs (with x-vercel-signature header)
   * - Linux node-cron or external services (with x-cron-secret header)
   */
  async processReminders(req: Request, res: Response) {
    try {
      // Hybrid security: accept either Vercel signature or CRON_SECRET
      const vercelSignature = req.headers['x-vercel-signature'];
      const providedSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET;

      const isVercelRequest = !!vercelSignature;
      const hasValidSecret = providedSecret === expectedSecret && expectedSecret;

      if (!isVercelRequest && !hasValidSecret) {
        logger.warn('Unauthorized cron request attempt', {
          hasVercelSignature: !!vercelSignature,
          hasSecret: !!providedSecret,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
        });
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Get pending reminders
      const pendingReminders = await ReminderService.getPendingReminders();

      if (pendingReminders.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No pending reminders to process',
          processed: 0,
        });
      }

      let processed = 0;
      let failed = 0;

      // Process each reminder
      for (const reminder of pendingReminders) {
        try {
          if (!reminder.userId) {
            logger.warn('Reminder has no userId, skipping', { reminderId: reminder.id });
            await ReminderService.markReminderFailed(reminder.id);
            failed++;
            continue;
          }

          // Get user details
          const user = await db.query.users.findFirst({
            where: eq(users.id, reminder.userId),
          });

          if (!user) {
            logger.warn('User not found for reminder', {
              reminderId: reminder.id,
              userId: reminder.userId,
            });
            await ReminderService.markReminderFailed(reminder.id);
            failed++;
            continue;
          }

          const metadata = reminder.metadata as DocumentReminderMetadata | null;
          if (!metadata) {
            logger.warn('Reminder metadata is invalid', { reminderId: reminder.id });
            await ReminderService.markReminderFailed(reminder.id);
            failed++;
            continue;
          }

          // Determine reminder type and send appropriate email
          if (reminder.notificationType.includes('_expiry_reminder')) {
            // Send reminder to practitioner
            await emailService.sendDocumentExpiryReminder({
              firstName: user.firstName,
              email: user.email,
              documentType: metadata.documentType,
              documentName: metadata.documentName,
              expiryDate: metadata.expiryDate,
            });
          } else if (
            reminder.notificationType.includes('_expiry_escalation') ||
            reminder.notificationType.includes('_expiry_final_escalation')
          ) {
            // Send escalation to admin
            const expiryDate = new Date(metadata.expiryDate);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            expiryDate.setUTCHours(0, 0, 0, 0);
            const daysOverdue = Math.ceil((today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));

            await emailService.sendAdminEscalation({
              practitionerName: `${user.firstName} ${user.lastName}`,
              practitionerEmail: user.email,
              documentType: metadata.documentType,
              documentName: metadata.documentName,
              expiryDate: metadata.expiryDate,
              daysOverdue: Math.max(0, daysOverdue),
            });
          } else {
            logger.warn('Unknown reminder type', {
              reminderId: reminder.id,
              notificationType: reminder.notificationType,
            });
            await ReminderService.markReminderFailed(reminder.id);
            failed++;
            continue;
          }

          // Mark reminder as sent
          await ReminderService.markReminderSent(reminder.id);
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
          await ReminderService.markReminderFailed(reminder.id);
          failed++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Processed ${processed} reminders, ${failed} failed`,
        processed,
        failed,
        total: pendingReminders.length,
      });
    } catch (error) {
      logger.error('Failed to process reminders', error, {
        method: req.method,
        url: req.originalUrl,
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const cronController = new CronController();

