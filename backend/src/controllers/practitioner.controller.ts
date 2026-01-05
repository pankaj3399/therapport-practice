import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/database';
import { bookings, rooms, locations, documents } from '../db/schema';
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

      if (!R2_BUCKET_NAME) {
        logger.error(
          'R2_BUCKET_NAME is not configured',
          error,
          {
            userId: req.user?.id,
            method: req.method,
            url: req.originalUrl,
          }
        );
        return res.status(500).json({ 
          success: false, 
          error: 'File storage service is not configured' 
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

      // Delete old document if exists
      if (data.oldDocumentId) {
        const oldDocument = await db.query.documents.findFirst({
          where: and(
            eq(documents.id, data.oldDocumentId),
            eq(documents.userId, req.user.id),
            eq(documents.documentType, 'insurance')
          ),
        });

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
            // Continue even if deletion fails
          }
        }
      }

      // Create or update insurance document
      // For now, we'll create a new document entry (can be updated to update existing if needed)
      const [newDocument] = await db
        .insert(documents)
        .values({
          userId: req.user.id,
          documentType: 'insurance',
          fileUrl: data.filePath, // Store file path, not full URL
          fileName: data.fileName,
          expiryDate: data.expiryDate,
        })
        .returning();

      // Generate presigned URL for viewing
      const documentUrl = await FileService.generatePresignedGetUrl(data.filePath, 'documents');

      res.status(200).json({
        success: true,
        data: {
          id: newDocument.id,
          fileName: newDocument.fileName,
          expiryDate: newDocument.expiryDate,
          documentUrl, // Presigned URL for viewing
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
      today.setHours(0, 0, 0, 0);
      const expiryDate = document.expiryDate ? new Date(document.expiryDate) : null;
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
}

export const practitionerController = new PractitionerController();

