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

/**
 * Fixes a data: URL whose MIME type lies about its contents. The common case:
 * an SVG favicon (e.g. GitHub's, served as image/svg+xml) gets downloaded with a
 * .png extension, so re-uploading it produces `data:image/png;base64,<svg-bytes>`
 * which the browser can't decode as PNG (-> broken image). We sniff the decoded
 * bytes; if they're actually SVG, we relabel the URL as image/svg+xml so it loads.
 * Returns the original URL unchanged when nothing needs fixing.
 */
export const normalizeImageDataUrl = (dataUrl: string): string => {
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match) return dataUrl;
    const [, mime, base64Flag, payload] = match;

    let text: string;
    try {
        text = base64Flag ? atob(payload).slice(0, 256) : decodeURIComponent(payload).slice(0, 256);
    } catch {
        return dataUrl;
    }

    // Looks like SVG markup (allowing a leading XML prolog / BOM / whitespace)?
    const looksSvg = /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(text);
    if (looksSvg && mime !== 'image/svg+xml') {
        return `data:image/svg+xml${base64Flag || ''},${payload}`;
    }
    return dataUrl;
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

            // PNG, always: these are icons with transparency, and toDataURL's
            // quality argument does nothing for PNG. So the only lever is size,
            // and the loop below shrinks rather than pretending to re-encode.
            let compressedUrl = canvas.toDataURL('image/png');

            // Base64 carries 3 bytes in every 4 characters.
            const tooBig = () => compressedUrl.length * 0.75 > maxSizeKB * 1024;

            // A 128x128 PNG is 20 to 30KB, so this rarely runs at all. Bounded
            // at 8 passes (down to ~43% of the starting edge) rather than
            // looping until it fits: an image that is still too big after that
            // is stored slightly oversized, which the storage meter and the
            // import cap both account for. Better than an unbounded loop in a
            // click handler.
            for (let pass = 0; pass < 8 && tooBig(); pass++) {
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
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = dataUrl;
    });
};
