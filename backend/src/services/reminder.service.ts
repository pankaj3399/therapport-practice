import { db } from '../config/database';
import { emailNotifications, documents } from '../db/schema';
import { eq, and, lte, gte, isNotNull, sql } from 'drizzle-orm';
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
      // Create a copy of expiry date to avoid mutation
      const expiry = new Date(expiryDate);
      const normalizedExpiry = new Date(expiry);
      normalizedExpiry.setUTCHours(0, 0, 0, 0);

      const metadata: DocumentReminderMetadata = {
        documentId,
        documentType,
        documentName,
        expiryDate,
      };

      // Reminder 1: On expiry date (to practitioner)
      const reminder1Date = new Date(normalizedExpiry);

      // Reminder 2: 2 weeks after expiry (escalation to admin)
      const reminder2Date = new Date(normalizedExpiry);
      reminder2Date.setUTCDate(reminder2Date.getUTCDate() + 14);

      // Reminder 3: 4 weeks after expiry (final admin escalation)
      const reminder3Date = new Date(normalizedExpiry);
      reminder3Date.setUTCDate(reminder3Date.getUTCDate() + 28);

      // Build notification objects
      const notifications = [
        {
          userId,
          notificationType: `${documentType}_expiry_reminder`,
          status: 'pending' as const,
          metadata: metadata,
          scheduledAt: reminder1Date,
        },
        {
          userId,
          notificationType: `${documentType}_expiry_escalation`,
          status: 'pending' as const,
          metadata: metadata,
          scheduledAt: reminder2Date,
        },
        {
          userId,
          notificationType: `${documentType}_expiry_final_escalation`,
          status: 'pending' as const,
          metadata: metadata,
          scheduledAt: reminder3Date,
        },
      ];

      // Bulk insert all three reminders atomically in a transaction
      await db.transaction(async (tx) => {
        await tx.insert(emailNotifications).values(notifications);
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
      // Bulk delete pending notifications matching documentId in metadata
      await db
        .delete(emailNotifications)
        .where(
          and(
            sql`${emailNotifications.metadata} ->> 'documentId' = ${documentId}`,
            eq(emailNotifications.status, 'pending')
          )
        );

      logger.info('Document reminders cancelled', {
        documentId,
      });
    } catch (error) {
      logger.error('Failed to cancel document reminders', error, { documentId });
      // Don't throw - reminder cancellation failure shouldn't break document update
    }
  }

  /**
   * Get pending reminders that are due to be sent
   * Returns reminders where scheduledAt <= now and status is 'pending'
   * @param userId - Optional userId to filter reminders by a specific user
   */
  static async getPendingReminders(userId?: string): Promise<Array<{
    id: string;
    userId: string | null;
    notificationType: string;
    metadata: any;
    scheduledAt: Date | null;
  }>> {
    const now = new Date();

    // Build where conditions
    const conditions = [
      eq(emailNotifications.status, 'pending'),
      isNotNull(emailNotifications.scheduledAt),
      lte(emailNotifications.scheduledAt, now),
    ];

    // Add userId filter if provided
    if (userId) {
      conditions.push(eq(emailNotifications.userId, userId));
    }

    // Get pending notifications that are due (scheduledAt <= now)
    const dueReminders = await db.query.emailNotifications.findMany({
      where: and(...conditions),
      orderBy: (notifications, { asc }) => [asc(notifications.scheduledAt)],
      limit: 100, // Process up to 100 reminders per run
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

