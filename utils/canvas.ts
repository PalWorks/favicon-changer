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
