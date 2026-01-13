import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from '../config/r2';

export interface FileUploadMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
}

export interface PresignedUploadUrlResponse {
  presignedUrl: string;
  filePath: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export class FileService {
  // Allowed file types for photos
  private static readonly ALLOWED_PHOTO_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  // Allowed file types for documents
  private static readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  // Max file sizes (in bytes)
  private static readonly MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

  // Presigned URL expiry times (in seconds)
  // Note: S3/R2 presigned URLs have a maximum expiry of 7 days (604800 seconds)
  private static readonly PHOTO_GET_URL_EXPIRY = 604800; // 7 days (max allowed)
  private static readonly DOCUMENT_GET_URL_EXPIRY = 3600; // 1 hour

  /**
   * Validate file for photo upload
   */
  static validatePhotoFile(metadata: FileUploadMetadata): FileValidationResult {
    if (!this.ALLOWED_PHOTO_TYPES.includes(metadata.fileType.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${this.ALLOWED_PHOTO_TYPES.join(', ')}`,
      };
    }

    if (metadata.fileSize > this.MAX_PHOTO_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.MAX_PHOTO_SIZE / 1024 / 1024}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate file for document upload
   */
  static validateDocumentFile(metadata: FileUploadMetadata): FileValidationResult {
    if (!this.ALLOWED_DOCUMENT_TYPES.includes(metadata.fileType.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${this.ALLOWED_DOCUMENT_TYPES.join(', ')}`,
      };
    }

    if (metadata.fileSize > this.MAX_DOCUMENT_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate a unique file path
   */
  static generateFilePath(
    userId: string,
    category: 'photos' | 'documents',
    filename: string
  ): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${category}/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * Generate presigned URL for file upload (PUT)
   */
  static async generatePresignedUploadUrl(
    filePath: string,
    contentType: string,
    expiresIn: number = 300 // 5 minutes default
  ): Promise<PresignedUploadUrlResponse> {
    if (!R2_BUCKET_NAME) {
      throw new Error('R2_BUCKET_NAME environment variable is required');
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });

    return {
      presignedUrl,
      filePath,
    };
  }

  /**
   * Generate presigned URL for file download/viewing (GET)
   * Photos get longer expiry (7 days - S3/R2 maximum), documents get shorter (1 hour)
   */
  static async generatePresignedGetUrl(
    filePath: string,
    category: 'photos' | 'documents'
  ): Promise<string> {
    if (!R2_BUCKET_NAME) {
      throw new Error('R2_BUCKET_NAME environment variable is required');
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
    });

    const expiresIn = category === 'photos'
      ? this.PHOTO_GET_URL_EXPIRY
      : this.DOCUMENT_GET_URL_EXPIRY;

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });

    return presignedUrl;
  }

  /**
   * Delete file from R2
   */
  static async deleteFile(filePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath, // filePath should be the key, not a URL
    });

    await r2Client.send(command);
  }

  /**
   * Upload a buffer directly to R2 (for processed images)
   * @param filePath - The path/key in R2
   * @param buffer - The file buffer to upload
   * @param contentType - MIME type of the file
   */
  static async uploadBufferToR2(
    filePath: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    if (!R2_BUCKET_NAME) {
      throw new Error('R2_BUCKET_NAME environment variable is required');
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await r2Client.send(command);
    } catch (error: any) {
      throw new Error(`Failed to upload file to R2: ${error.message}`);
    }
  }

  /**
   * Extract file path from stored path (for backward compatibility)
   * Since we store file paths directly, this just returns the path as-is
   */
  static extractFilePath(filePathOrUrl: string): string {
    // If it's already a path (no http), return as-is
    if (!filePathOrUrl.startsWith('http')) {
      return filePathOrUrl;
    }

    // If it's a URL, try to extract the path (for backward compatibility)
    // This handles old data that might have URLs stored
    const urlParts = filePathOrUrl.split('/');
    const pathIndex = urlParts.findIndex(part => part.includes('photos') || part.includes('documents'));
    if (pathIndex !== -1) {
      return urlParts.slice(pathIndex).join('/');
    }

    return filePathOrUrl;
  }
}

