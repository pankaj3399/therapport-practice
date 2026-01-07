import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/database';
import { bookings, rooms, locations, documents, clinicalExecutors } from '../db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { VoucherService } from '../services/voucher.service';
import { CreditService } from '../services/credit.service';
import { FileService } from '../services/file.service';
import { logger } from '../utils/logger.util';
import { z, ZodError } from 'zod';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '../config/r2';

const futureDate = z.string().refine(
  (date) => {
    const expiry = new Date(date);
    expiry.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return expiry > today;
  },
  { message: 'Expiry date must be in the future' }
);

const insuranceUploadUrlSchema = z.object({
  filename: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().positive(),
  expiryDate: futureDate,
});

const insuranceConfirmSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  expiryDate: futureDate,
  oldDocumentId: z.string().uuid().optional(),
});

export class PractitionerController {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Compute todayUtc first
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);

      // Start all three promises in parallel
      const [voucherSummary, creditSummary, upcomingBookingsData] = await Promise.all([
        VoucherService.getRemainingFreeHours(userId),
        CreditService.getCreditBalance(userId),
        db
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
              gte(bookings.bookingDate, todayUtc.toISOString().split('T')[0])
            )
          )
          .orderBy(asc(bookings.bookingDate), asc(bookings.startTime))
          .limit(10),
      ]);

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
    } catch (error: unknown) {
      // Normalize error for logging
      const isError = error instanceof Error;
      const errorMessage = isError ? error.message : String(error);
      const errorStack = isError ? error.stack : undefined;
      
      // Set errorDetails once: use errorMessage for Error instances, otherwise stringify
      const errorDetails: string = isError
        ? errorMessage
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();

      const errorForLogger = isError ? error : new Error(errorDetails);

      logger.error(
        'Failed to get dashboard data',
        errorForLogger,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
          errorDetails: errorDetails,
          errorStack: errorStack,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getInsuranceUploadUrl(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Validate R2 configuration upfront
      if (!R2_BUCKET_NAME) {
        logger.error(
          'R2_BUCKET_NAME is not configured',
          new Error('R2_BUCKET_NAME environment variable is missing'),
          {
            userId: req.user.id,
            method: req.method,
            url: req.originalUrl,
          }
        );
        return res.status(500).json({ 
          success: false, 
          error: 'File storage service is not configured' 
        });
      }

      const data = insuranceUploadUrlSchema.parse(req.body);

      // Validate file
      const validation = FileService.validateDocumentFile({
        filename: data.filename,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });

      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      // Get current insurance document if exists
      const currentDocument = await db.query.documents.findFirst({
        where: and(
          eq(documents.userId, req.user.id),
          eq(documents.documentType, 'insurance')
        ),
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      });

      // Generate file path
      const filePath = FileService.generateFilePath(req.user.id, 'documents', data.filename);

      // Generate presigned URL
      const { presignedUrl, filePath: generatedPath } = await FileService.generatePresignedUploadUrl(
        filePath,
        data.fileType
      );

      res.status(200).json({
        success: true,
        data: {
          presignedUrl,
          filePath: generatedPath,
          oldDocumentId: currentDocument?.id,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors.map(e => e.message).join(', ') 
        });
      }

      logger.error(
        'Failed to generate insurance document upload URL',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async confirmInsuranceUpload(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = insuranceConfirmSchema.parse(req.body);

      // Verify the uploaded file actually exists in R2 before updating DB
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: data.filePath,
        });
        await r2Client.send(headCommand);
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          logger.error(
            'Insurance document file not found in R2 before DB update',
            error,
            {
              userId: req.user.id,
              filePath: data.filePath,
              method: req.method,
              url: req.originalUrl,
            }
          );
          return res.status(400).json({ 
            success: false, 
            error: 'Uploaded file not found. Please try uploading again.' 
          });
        }
        
        logger.error(
          'R2 error while verifying insurance document file',
          error,
          {
            userId: req.user.id,
            filePath: data.filePath,
            method: req.method,
            url: req.originalUrl,
          }
        );
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to verify uploaded file' 
        });
      }

      // Fetch old document if exists (for R2 deletion after transaction)
      let oldDocument: typeof documents.$inferSelect | null = null;
      if (data.oldDocumentId) {
        const found = await db.query.documents.findFirst({
          where: and(
            eq(documents.id, data.oldDocumentId),
            eq(documents.userId, req.user.id),
            eq(documents.documentType, 'insurance')
          ),
        });
        oldDocument = found || null;
      }

      // Atomic DB operations: insert new document and delete old DB record in a transaction
      const userId = req.user.id; // Capture userId for use in transaction
      const [newDocument] = await db.transaction(async (tx) => {
        // Insert new document
        const [newDoc] = await tx
          .insert(documents)
          .values({
            userId: userId,
            documentType: 'insurance',
            fileUrl: data.filePath, // Store file path, not full URL
            fileName: data.fileName,
            expiryDate: data.expiryDate,
          })
          .returning();

        // Delete old document DB record if exists
        if (data.oldDocumentId) {
          await tx
            .delete(documents)
            .where(
              and(
                eq(documents.id, data.oldDocumentId),
                eq(documents.userId, userId),
                eq(documents.documentType, 'insurance')
              )
            );
        }

        return [newDoc];
      });

      // Delete old R2 file after successful transaction (external service, not in transaction)
      if (oldDocument) {
        try {
          await FileService.deleteFile(FileService.extractFilePath(oldDocument.fileUrl));
        } catch (error) {
          logger.error(
            'Failed to delete old insurance document from R2',
            error,
            {
              userId: req.user.id,
              oldDocumentId: data.oldDocumentId,
              method: req.method,
              url: req.originalUrl,
            }
          );
          // Continue even if R2 deletion fails - DB transaction already committed
        }
      }

      // Generate presigned URL for viewing
      const documentUrl = await FileService.generatePresignedGetUrl(data.filePath, 'documents');

      // Calculate expiry status (similar to getInsuranceDocument)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiryDate = newDocument.expiryDate ? new Date(newDocument.expiryDate) : null;
      if (expiryDate) {
        expiryDate.setUTCHours(0, 0, 0, 0);
      }
      const daysUntilExpiry = expiryDate 
        ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const isExpired = expiryDate && expiryDate < today;
      const isExpiringSoon = expiryDate && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;

      res.status(200).json({
        success: true,
        data: {
          id: newDocument.id,
          fileName: newDocument.fileName,
          expiryDate: newDocument.expiryDate,
          documentUrl, // Presigned URL for viewing
          isExpired,
          isExpiringSoon,
          daysUntilExpiry,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors.map(e => e.message).join(', ') 
        });
      }

      logger.error(
        'Failed to confirm insurance document upload',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getInsuranceDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Get current insurance document
      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.userId, req.user.id),
          eq(documents.documentType, 'insurance')
        ),
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      });

      if (!document) {
        return res.status(404).json({ success: false, error: 'No insurance document found' });
      }

      // Generate presigned URL for viewing
      const documentUrl = await FileService.generatePresignedGetUrl(document.fileUrl, 'documents');

      // Check if expired or expiring soon (within 30 days)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiryDate = document.expiryDate ? new Date(document.expiryDate) : null;
      if (expiryDate) {
        expiryDate.setUTCHours(0, 0, 0, 0);
      }
      const daysUntilExpiry = expiryDate 
        ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const isExpired = expiryDate && expiryDate < today;
      const isExpiringSoon = expiryDate && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;
      res.status(200).json({
        success: true,
        data: {
          id: document.id,
          fileName: document.fileName,
          expiryDate: document.expiryDate,
          documentUrl,
          isExpired,
          isExpiringSoon,
          daysUntilExpiry,
        },
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get insurance document',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getClinicalUploadUrl(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Validate R2 configuration upfront
      if (!R2_BUCKET_NAME) {
        logger.error(
          'R2_BUCKET_NAME is not configured',
          new Error('R2_BUCKET_NAME environment variable is missing'),
          {
            userId: req.user.id,
            method: req.method,
            url: req.originalUrl,
          }
        );
        return res.status(500).json({ 
          success: false, 
          error: 'File storage service is not configured' 
        });
      }

      const data = insuranceUploadUrlSchema.parse(req.body); // Reuse same schema

      // Validate file
      const validation = FileService.validateDocumentFile({
        filename: data.filename,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });

      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      // Get current clinical document if exists
      const currentDocument = await db.query.documents.findFirst({
        where: and(
          eq(documents.userId, req.user.id),
          eq(documents.documentType, 'clinical_registration')
        ),
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      });

      // Generate file path
      const filePath = FileService.generateFilePath(req.user.id, 'documents', data.filename);

      // Generate presigned URL
      const { presignedUrl, filePath: generatedPath } = await FileService.generatePresignedUploadUrl(
        filePath,
        data.fileType
      );

      res.status(200).json({
        success: true,
        data: {
          presignedUrl,
          filePath: generatedPath,
          oldDocumentId: currentDocument?.id,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors.map(e => e.message).join(', ') 
        });
      }

      logger.error(
        'Failed to generate clinical document upload URL',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async confirmClinicalUpload(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = insuranceConfirmSchema.parse(req.body); // Reuse same schema

      // Verify the uploaded file actually exists in R2 before updating DB
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: data.filePath,
        });
        await r2Client.send(headCommand);
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          logger.error(
            'Clinical document file not found in R2 before DB update',
            error,
            {
              userId: req.user.id,
              filePath: data.filePath,
              method: req.method,
              url: req.originalUrl,
            }
          );
          return res.status(400).json({ 
            success: false, 
            error: 'Uploaded file not found. Please try uploading again.' 
          });
        }
        
        logger.error(
          'R2 error while verifying clinical document file',
          error,
          {
            userId: req.user.id,
            filePath: data.filePath,
            method: req.method,
            url: req.originalUrl,
          }
        );
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to verify uploaded file' 
        });
      }

      // Fetch old document if exists (for R2 deletion after transaction)
      let oldDocument: typeof documents.$inferSelect | null = null;
      if (data.oldDocumentId) {
        const found = await db.query.documents.findFirst({
          where: and(
            eq(documents.id, data.oldDocumentId),
            eq(documents.userId, req.user.id),
            eq(documents.documentType, 'clinical_registration')
          ),
        });
        oldDocument = found || null;
      }

      // Atomic DB operations: insert new document and delete old DB record in a transaction
      const userId = req.user.id;
      const [newDocument] = await db.transaction(async (tx) => {
        // Insert new document
        const [newDoc] = await tx
          .insert(documents)
          .values({
            userId: userId,
            documentType: 'clinical_registration',
            fileUrl: data.filePath,
            fileName: data.fileName,
            expiryDate: data.expiryDate,
          })
          .returning();

        // Delete old document DB record if exists
        if (data.oldDocumentId) {
          await tx
            .delete(documents)
            .where(
              and(
                eq(documents.id, data.oldDocumentId),
                eq(documents.userId, userId),
                eq(documents.documentType, 'clinical_registration')
              )
            );
        }

        return [newDoc];
      });

      // Delete old R2 file after successful transaction
      if (oldDocument) {
        try {
          await FileService.deleteFile(FileService.extractFilePath(oldDocument.fileUrl));
        } catch (error) {
          logger.error(
            'Failed to delete old clinical document from R2',
            error,
            {
              userId: req.user.id,
              oldDocumentId: data.oldDocumentId,
              method: req.method,
              url: req.originalUrl,
            }
          );
        }
      }

      // Generate presigned URL for viewing
      const documentUrl = await FileService.generatePresignedGetUrl(data.filePath, 'documents');

      // Calculate expiry status
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiryDate = newDocument.expiryDate ? new Date(newDocument.expiryDate) : null;
      if (expiryDate) {
        expiryDate.setUTCHours(0, 0, 0, 0);
      }
      const daysUntilExpiry = expiryDate 
        ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const isExpired = expiryDate && expiryDate < today;
      const isExpiringSoon = expiryDate && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;

      res.status(200).json({
        success: true,
        data: {
          id: newDocument.id,
          fileName: newDocument.fileName,
          expiryDate: newDocument.expiryDate,
          documentUrl,
          isExpired,
          isExpiringSoon,
          daysUntilExpiry,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors.map(e => e.message).join(', ') 
        });
      }

      logger.error(
        'Failed to confirm clinical document upload',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getClinicalDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Get current clinical document
      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.userId, req.user.id),
          eq(documents.documentType, 'clinical_registration')
        ),
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      });

      if (!document) {
        return res.status(404).json({ success: false, error: 'No clinical registration document found' });
      }

      // Generate presigned URL for viewing
      const documentUrl = await FileService.generatePresignedGetUrl(document.fileUrl, 'documents');

      // Check if expired or expiring soon (within 30 days)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiryDate = document.expiryDate ? new Date(document.expiryDate) : null;
      if (expiryDate) {
        expiryDate.setUTCHours(0, 0, 0, 0);
      }
      const daysUntilExpiry = expiryDate 
        ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const isExpired = expiryDate && expiryDate < today;
      const isExpiringSoon = expiryDate && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;

      res.status(200).json({
        success: true,
        data: {
          id: document.id,
          fileName: document.fileName,
          expiryDate: document.expiryDate,
          documentUrl,
          isExpired,
          isExpiringSoon,
          daysUntilExpiry,
        },
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get clinical document',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async createOrUpdateClinicalExecutor(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const executorSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email format'),
        phone: z.string().min(1, 'Phone is required'),
      });

      const data = executorSchema.parse(req.body);

      // Check if executor already exists
      const existingExecutor = await db.query.clinicalExecutors.findFirst({
        where: eq(clinicalExecutors.userId, req.user.id),
      });

      let executor;
      if (existingExecutor) {
        // Update existing executor
        const [updated] = await db
          .update(clinicalExecutors)
          .set({
            name: data.name,
            email: data.email,
            phone: data.phone,
            updatedAt: new Date(),
          })
          .where(eq(clinicalExecutors.userId, req.user.id))
          .returning();
        executor = updated;
      } else {
        // Create new executor
        const [created] = await db
          .insert(clinicalExecutors)
          .values({
            userId: req.user.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
          })
          .returning();
        executor = created;
      }

      res.status(200).json({
        success: true,
        data: {
          id: executor.id,
          name: executor.name,
          email: executor.email,
          phone: executor.phone,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors.map(e => e.message).join(', ') 
        });
      }

      logger.error(
        'Failed to create/update clinical executor',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getClinicalExecutor(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const executor = await db.query.clinicalExecutors.findFirst({
        where: eq(clinicalExecutors.userId, req.user.id),
      });

      if (!executor) {
        return res.status(404).json({ success: false, error: 'No clinical executor found' });
      }

      res.status(200).json({
        success: true,
        data: {
          id: executor.id,
          name: executor.name,
          email: executor.email,
          phone: executor.phone,
        },
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to get clinical executor',
        error,
        {
          userId: req.user?.id,
          method: req.method,
          url: req.originalUrl,
        }
      );
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const practitionerController = new PractitionerController();

