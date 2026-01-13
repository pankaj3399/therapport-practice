import sharp from 'sharp';

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
}

/**
 * Process a cropped image from base64 data URL
 * The image is already cropped by the frontend, just needs resizing and compression
 * 
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @returns Processed image buffer as JPEG, 512x512, under 500KB
 */
export async function processBase64Image(base64Data: string): Promise<Buffer> {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');

    // Process the image
    return processProfilePhoto(imageBuffer);
}

/**
 * Get image metadata (useful for debugging)
 */
export async function getImageMetadata(imageBuffer: Buffer) {
    return sharp(imageBuffer).metadata();
}
