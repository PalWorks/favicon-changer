import { Shape } from '../types';

interface GenerateFaviconOptions {
    sourceUrl: string;
    color: string;
    shape: Shape;
    text: string;
}

export type BadgePosition = 'top' | 'bottom';

export const drawOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string,
    opacity: number
) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
};

export const drawBadge = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    text: string,
    bgColor: string,
    textColor: string,
    position: BadgePosition
) => {
    ctx.save();
    // Compact font size
    const fontSize = Math.floor(height * 0.35); // 35% of icon size
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const paddingX = fontSize * 0.6;
    const paddingY = fontSize * 0.3;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Approximation

    // Calculate badge dimensions (Compact Rectangle)
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = textHeight + paddingY * 2;
    const borderRadius = 4; // Slight rounding

    // Calculate position
    let x = 0;
    let y = 0;
    const margin = height * 0.05; // 5% margin from edge

    if (position === 'top') {
        x = width / 2;
        y = margin + badgeHeight / 2;
    } else {
        // Bottom
        x = width / 2;
        y = height - margin - badgeHeight / 2;
    }

    // Draw Badge Background (Rounded Rect)
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x - badgeWidth / 2, y - badgeHeight / 2, badgeWidth, badgeHeight, borderRadius);
    ctx.fill();

    // Draw Text
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y + (fontSize * 0.05)); // Slight vertical adjustment
    ctx.restore();
};

export const generateFavicon = async (options: GenerateFaviconOptions): Promise<string> => {
    const { sourceUrl, color, shape, text } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const SIZE = 128;
                canvas.width = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw original favicon
                ctx.drawImage(img, 0, 0, SIZE, SIZE);

                // Draw Badge if text is present
                if (text) {
                    drawBadge(
                        ctx,
                        SIZE,
                        SIZE,
                        text,
                        color || '#FF0000', // Default red if no color provided
                        '#FFFFFF',          // White text
                        'bottom'            // Default position
                    );
                }

                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);

            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load source favicon image'));
        };

        img.src = sourceUrl;
    });
};

export const compressFaviconDataUrl = async (dataUrl: string, maxSizeKB = 50): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Max dimensions for favicon (128x128 is plenty for extension storage)
            const MAX_SIZE = 128;
            if (width > MAX_SIZE || height > MAX_SIZE) {
                if (width > height) {
                    height = Math.round((height * MAX_SIZE) / width);
                    width = MAX_SIZE;
                } else {
                    width = Math.round((width * MAX_SIZE) / height);
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Start with high quality
            let quality = 0.9;
            let compressedUrl = canvas.toDataURL('image/png', quality);

            // If still too big, try JPEG (though PNG is better for transparency)
            // For favicons, we really want PNG. If it's too big, we might just have to accept it 
            // or resize further. 50KB is actually quite a lot for 128x128.
            // A 128x128 PNG is usually ~20-30KB max.
            
            // Simple check: string length * 0.75 ~= bytes
            while (compressedUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.1) {
                quality -= 0.1;
                // PNG doesn't support quality param in toDataURL, so this loop is mostly for if we switch to jpeg
                // or if browser supports webp. Let's stick to resizing if needed.
                // Actually, let's just enforce the size limit by resizing if needed.
                
                width = Math.floor(width * 0.9);
                height = Math.floor(height * 0.9);
                canvas.width = width;
                canvas.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                compressedUrl = canvas.toDataURL('image/png');
            }

            resolve(compressedUrl);
        };
        img.onerror = (e) => reject(new Error('Failed to load image for compression'));
        img.src = dataUrl;
    });
};
