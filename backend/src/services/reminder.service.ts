import { db } from '../config/database';
import { emailNotifications, documents } from '../db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { logger } from '../utils/logger.util';

export interface DocumentReminderMetadata {
  documentId: string;
  documentType: 'insurance' | 'clinical_registration';
  documentName: string;
  expiryDate: string;
}

export class ReminderService {
  /**
   * Schedule reminders for a document when it's uploaded/updated
   * Creates reminders for:
   * - On expiry date
   * - 2 weeks after expiry (escalation to admin)
   * - 4 weeks after expiry (final admin escalation)
   */
  static async scheduleDocumentReminders(
    userId: string,
    documentId: string,
    documentType: 'insurance' | 'clinical_registration',
    documentName: string,
    expiryDate: string
  ): Promise<void> {
    try {
      const expiry = new Date(expiryDate);
      expiry.setUTCHours(0, 0, 0, 0);

      const metadata: DocumentReminderMetadata = {
        documentId,
        documentType,
        documentName,
        expiryDate,
      };

      // Reminder 1: On expiry date (to practitioner)
      const reminder1Date = new Date(expiry);
      await db.insert(emailNotifications).values({
        userId,
        notificationType: `${documentType}_expiry_reminder`,
        status: 'pending',
        metadata: metadata,
        scheduledAt: reminder1Date,
      });

      // Reminder 2: 2 weeks after expiry (escalation to admin)
      const reminder2Date = new Date(expiry);
      reminder2Date.setDate(reminder2Date.getDate() + 14);
      await db.insert(emailNotifications).values({
        userId,
        notificationType: `${documentType}_expiry_escalation`,
        status: 'pending',
        metadata: metadata,
        scheduledAt: reminder2Date,
      });

      // Reminder 3: 4 weeks after expiry (final admin escalation)
      const reminder3Date = new Date(expiry);
      reminder3Date.setDate(reminder3Date.getDate() + 28);
      await db.insert(emailNotifications).values({
        userId,
        notificationType: `${documentType}_expiry_final_escalation`,
        status: 'pending',
        metadata: metadata,
        scheduledAt: reminder3Date,
      });

      logger.info('Document reminders scheduled', {
        userId,
        documentId,
        documentType,
        expiryDate,
      });
    } catch (error) {
      logger.error('Failed to schedule document reminders', error, {
        userId,
        documentId,
        documentType,
        expiryDate,
      });
      // Don't throw - reminder scheduling failure shouldn't break document upload
    }
  }

  /**
   * Cancel/delete existing reminders for a document when it's updated/replaced
   */
  static async cancelDocumentReminders(documentId: string): Promise<void> {
    try {
      // Get all pending notifications and filter by documentId in metadata
      const pendingNotifications = await db.query.emailNotifications.findMany({
        where: eq(emailNotifications.status, 'pending'),
      });

      const notificationsToDelete = pendingNotifications.filter((notif) => {
        const metadata = notif.metadata as DocumentReminderMetadata | null;
        return metadata?.documentId === documentId;
      });

      // Delete each matching notification
      for (const notif of notificationsToDelete) {
        await db.delete(emailNotifications).where(eq(emailNotifications.id, notif.id));
      }

      if (notificationsToDelete.length > 0) {
        logger.info('Document reminders cancelled', {
          documentId,
          cancelledCount: notificationsToDelete.length,
        });
      }
    } catch (error) {
      logger.error('Failed to cancel document reminders', error, { documentId });
      // Don't throw - reminder cancellation failure shouldn't break document update
    }
  }

  /**
   * Get pending reminders that are due to be sent
   * Returns reminders where scheduledAt <= now and status is 'pending'
   */
  static async getPendingReminders(): Promise<Array<{
    id: string;
    userId: string | null;
    notificationType: string;
    metadata: any;
    scheduledAt: Date | null;
  }>> {
    const now = new Date();

    // Get all pending notifications and filter by scheduledAt
    const allPending = await db.query.emailNotifications.findMany({
      where: eq(emailNotifications.status, 'pending'),
      orderBy: (notifications, { asc }) => [asc(notifications.scheduledAt)],
      limit: 100, // Process up to 100 reminders per run
    });

    // Filter to only those where scheduledAt <= now (and scheduledAt is not null)
    const dueReminders = allPending.filter((r) => {
      if (!r.scheduledAt) return false;
      return r.scheduledAt <= now;
    });

    return dueReminders.map((r) => ({
      id: r.id,
      userId: r.userId,
      notificationType: r.notificationType,
      metadata: r.metadata,
      scheduledAt: r.scheduledAt,
    }));
  }

  /**
   * Mark a reminder as sent
   */
  static async markReminderSent(reminderId: string): Promise<void> {
    await db
      .update(emailNotifications)
      .set({
        status: 'sent',
        sentAt: new Date(),
      })
      .where(eq(emailNotifications.id, reminderId));
  }

  /**
   * Mark a reminder as failed
   */
  static async markReminderFailed(reminderId: string): Promise<void> {
    await db
      .update(emailNotifications)
      .set({
        status: 'failed',
      })
      .where(eq(emailNotifications.id, reminderId));
  }
}

