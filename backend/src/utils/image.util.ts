import sharp, { Metadata } from 'sharp';

// TODO: CropData interface may be used in future for client-side crop coordinates
// interface CropData { x: number; y: number; width: number; height: number; }

/**
 * Process a profile photo:
 * 1. Resize to 512x512 with cover fit
 * 2. Convert to JPEG
 * 3. Compress to under 500KB
 * 
 * @param imageBuffer - The raw image buffer
 * @returns Processed image buffer as JPEG, 512x512, under 500KB
 */
export async function processProfilePhoto(imageBuffer: Buffer): Promise<Buffer> {
    try {
        // Validate input buffer
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Image buffer is empty or invalid');
        }

        // Target file size: 500KB = 500 * 1024 bytes
        const maxSizeBytes = 500 * 1024;

        // First resize once (this is the expensive operation)
        const resizedBuffer = await sharp(imageBuffer)
            .resize(512, 512, {
                fit: 'cover',
                position: 'center',
            })
            .toBuffer();

        // Start with quality 90 and reduce if necessary
        let quality = 90;
        let processedBuffer: Buffer;

        do {
            processedBuffer = await sharp(resizedBuffer)
                .jpeg({
                    quality,
                    progressive: true,
                    mozjpeg: true, // Use mozjpeg for better compression
                })
                .toBuffer();

            // If still too large, reduce quality
            if (processedBuffer.length > maxSizeBytes) {
                quality -= 5;
            }
        } while (processedBuffer.length > maxSizeBytes && quality >= 30);

        // If we still can't get under 500KB with quality 30, just return what we have
        // This should be extremely rare for a 512x512 image

        return processedBuffer;
    } catch (error: any) {
        // Rethrow with descriptive context
        throw new Error(`Failed to process profile photo: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Validate base64 string format
 */
function isValidBase64(str: string): boolean {
    if (!str || str.length === 0) return false;
    // Remove any whitespace that some encoders might add
    str = str.replace(/\s/g, '');
    if (str.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
}

/**
 * Process a cropped image from base64 data URL
 * The image is already cropped by the frontend, just needs resizing and compression
 * 
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @returns Processed image buffer as JPEG, 512x512, under 500KB
 */
export async function processBase64Image(base64Data: string): Promise<Buffer> {
    try {
        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        let base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '').trim();

        // Validate base64 format
        if (!isValidBase64(base64Image)) {
            throw new Error('Invalid base64 image data');
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Image, 'base64');

        // Process the image
        return await processProfilePhoto(imageBuffer);
    } catch (error: any) {
        // Rethrow with context
        throw new Error(`Failed to process base64 image: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Get image metadata (useful for debugging)
 */
export async function getImageMetadata(imageBuffer: Buffer): Promise<Metadata> {
    return sharp(imageBuffer).metadata();
}
