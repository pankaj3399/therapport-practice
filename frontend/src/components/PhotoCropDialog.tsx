import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Icon } from '@/components/ui/Icon';

interface PhotoCropDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (imageData: string) => Promise<void>;
    currentPhotoUrl?: string;
}

const CANVAS_SIZE = 300;
const CROP_SIZE = 250;

// Allowed file types - single source of truth
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function PhotoCropDialog({
    open,
    onOpenChange,
    onSave,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentPhotoUrl: _currentPhotoUrl, // Available for future use
}: PhotoCropDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
            setImageData(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setError(null);
            setUploading(false);
            imageRef.current = null; // Clear stale image reference
        }
    }, [open]);

    // Draw image on canvas
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imageRef.current;

        if (!canvas || !ctx || !img) return;

        // Clear canvas
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Calculate scaled dimensions
        const scale = zoom;
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;

        // Calculate position to center image
        const x = (CANVAS_SIZE - imgWidth) / 2 + position.x;
        const y = (CANVAS_SIZE - imgHeight) / 2 + position.y;

        // Draw image
        ctx.drawImage(img, x, y, imgWidth, imgHeight);

        // Draw semi-transparent overlay outside the circle
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.restore();

        // Draw circle border
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [zoom, position]);

    // Redraw canvas when dependencies change
    useEffect(() => {
        drawCanvas();
    }, [drawCanvas, imageData, zoom, position]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type against explicit whitelist
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            setError('Please select a valid image file (JPEG, PNG, or WebP)');
            return;
        }

        // Validate file size (10MB max for raw image)
        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB');
            return;
        }

        setError(null);
        setSelectedFile(file);

        // Load image
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setImageData(dataUrl);

            // Create image element for canvas
            const img = new Image();
            img.onload = () => {
                imageRef.current = img;

                // Calculate initial zoom to fit image in canvas
                const minDimension = Math.min(img.width, img.height);
                const initialZoom = CROP_SIZE / minDimension;
                setZoom(Math.max(initialZoom, 0.5));
                setPosition({ x: 0, y: 0 });
                // useEffect watching imageData will trigger drawCanvas
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    // Mouse/Touch handlers for dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!imageData) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    // Touch handlers for mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!imageData || e.touches.length !== 1) return;
        e.preventDefault(); // Prevent page scrolling during drag
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault(); // Prevent page scrolling during drag
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y,
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    // Get cropped image data
    const getCroppedImage = (): string | null => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imageRef.current;

        if (!canvas || !ctx || !img) return null;

        // Create a temporary canvas for the cropped output
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = 512;
        outputCanvas.height = 512;
        const outputCtx = outputCanvas.getContext('2d');

        if (!outputCtx) return null;

        // Create circular clipping mask
        outputCtx.beginPath();
        outputCtx.arc(256, 256, 256, 0, Math.PI * 2);
        outputCtx.closePath();
        outputCtx.clip();

        // Calculate scaled dimensions
        const scale = zoom;
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;

        // Calculate the visible portion of the image in the crop circle
        const cropCenterX = CANVAS_SIZE / 2;
        const cropCenterY = CANVAS_SIZE / 2;

        // Image position on canvas
        const imgX = (CANVAS_SIZE - imgWidth) / 2 + position.x;
        const imgY = (CANVAS_SIZE - imgHeight) / 2 + position.y;

        // Calculate the portion of the image visible in the crop circle
        const cropLeft = cropCenterX - CROP_SIZE / 2;
        const cropTop = cropCenterY - CROP_SIZE / 2;

        // Source coordinates on the original image
        const srcX = (cropLeft - imgX) / scale;
        const srcY = (cropTop - imgY) / scale;
        const srcWidth = CROP_SIZE / scale;
        const srcHeight = CROP_SIZE / scale;

        // Draw the cropped portion scaled to 512x512
        outputCtx.drawImage(
            img,
            srcX, srcY, srcWidth, srcHeight,
            0, 0, 512, 512
        );

        // Return as JPEG data URL (with decent quality - server will optimize further)
        return outputCanvas.toDataURL('image/jpeg', 0.9);
    };

    const handleSave = async () => {
        if (!imageData) return;

        const croppedData = getCroppedImage();
        if (!croppedData) {
            setError('Failed to crop image');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            await onSave(croppedData);
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = () => {
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Icon name="photo_camera" className="text-primary" />
                        Upload Profile Photo
                    </DialogTitle>
                    <DialogDescription>
                        Select an image, then drag to position and use the slider to zoom.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                    {/* File Input */}
                    <div className="w-full flex-shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="photo-crop-input"
                            disabled={uploading}
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex-shrink-0 min-w-fit px-3"
                            >
                                <Icon name="upload" size={18} className="mr-2" />
                                Choose file
                            </Button>
                            <span className="text-sm text-slate-500 truncate max-w-[200px]">
                                {selectedFile?.name || 'No file selected'}
                            </span>
                        </div>
                    </div>

                    {/* Canvas for image preview and cropping */}
                    <div
                        className="relative border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 flex-shrink-0"
                        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                    >
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_SIZE}
                            height={CANVAS_SIZE}
                            className={isDragging ? 'cursor-grabbing' : imageData ? 'cursor-grab' : 'cursor-default'}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        />
                        {!imageData && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <Icon name="image" size={48} className="mx-auto mb-2" />
                                    <p className="text-sm">Select an image to preview</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Zoom Slider */}
                    {imageData && (
                        <div className="w-full space-y-2 flex-shrink-0 px-1">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm text-slate-500">Zoom</Label>
                                <span className="text-sm text-slate-500">{Math.round(zoom * 100)}%</span>
                            </div>
                            <Slider
                                value={[zoom]}
                                onValueChange={(values) => setZoom(values[0])}
                                min={0.5}
                                max={3}
                                step={0.1}
                                disabled={uploading}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
                            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                                <Icon name="error" size={18} />
                                {error}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={uploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!imageData || uploading}
                    >
                        {uploading ? (
                            <>
                                <Icon name="sync" size={18} className="mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Icon name="check" size={18} className="mr-2" />
                                Save
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
