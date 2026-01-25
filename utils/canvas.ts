import { Shape } from '../types';

interface GenerateFaviconOptions {
    sourceUrl: string;
    color: string;
    shape: Shape;
    text: string;
}

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

                // Apply tag overlay based on shape
                ctx.fillStyle = color;

                switch (shape) {
                    case 'circle':
                        // Bottom right corner circle
                        ctx.beginPath();
                        ctx.arc(SIZE - 20, SIZE - 20, 18, 0, Math.PI * 2);
                        ctx.fill();
                        break;

                    case 'square':
                        // Bottom right corner square
                        ctx.fillRect(SIZE - 36, SIZE - 36, 32, 32);
                        break;

                    case 'banner':
                        // Top banner
                        ctx.fillRect(0, 0, SIZE, 24);
                        break;

                    case 'border':
                        // Border around entire icon
                        ctx.lineWidth = 6;
                        ctx.strokeStyle = color;
                        ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6);
                        break;
                }

                // Add text if provided
                if (text && text.length > 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let textX = SIZE / 2;
                    let textY = SIZE / 2;

                    if (shape === 'circle' || shape === 'square') {
                        textX = SIZE - 20;
                        textY = SIZE - 20;
                    } else if (shape === 'banner') {
                        textY = 12;
                    }

                    ctx.fillText(text.charAt(0).toUpperCase(), textX, textY);
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
