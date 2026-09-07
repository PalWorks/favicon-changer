import React, { useState, useRef, useEffect } from 'react';

import { isValidFileType, isValidFileSize, isAllowedFaviconUrl } from '../../utils/validation';
import { compressFaviconDataUrl, normalizeImageDataUrl } from '../../utils/canvas';
import { Button } from '../Button';
import { Accordion } from '../Accordion';
import { logger } from '../../utils/logger';
import { FaviconRule } from '../../types';

type ImageMode = 'contain' | 'cover' | 'stretch';

interface UploadSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    initialValues?: FaviconRule['metadata'];
    onSave: (url: string, type: 'upload' | 'url', metadata: FaviconRule['metadata']) => Promise<void>;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
    isLoading?: boolean;
    // When provided (action popup only), clicking "Browse" hands off to a
    // standalone window instead of opening a native dialog, because the action
    // popup closes itself the moment an OS file dialog steals focus.
    onRequestExpand?: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ isOpen, onToggle, initialValues, onSave, onError, onSuccess, isLoading, onRequestExpand }) => {
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [imageMode, setImageMode] = useState<ImageMode>('contain');
    const [processedPreview, setProcessedPreview] = useState<string | null>(null);
    const [customUrl, setCustomUrl] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialValues?.imageMode) {
            setImageMode(initialValues.imageMode);
        }
    }, [initialValues]);

    // Process image whenever mode or source changes
    useEffect(() => {
        if (!pendingImage) {
            setProcessedPreview(null);
            return;
        }

        logger.log('Processing image started. Mode:', imageMode);
        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const SIZE = 128; // Standardize
                canvas.width = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.clearRect(0, 0, SIZE, SIZE);

                // SVGs sized only by viewBox report width/height of 0 in some
                // browsers; fall back to a square so the aspect math can't divide
                // by zero (which would produce NaN draw coords -> a blank icon).
                const iw = img.width || img.naturalWidth || SIZE;
                const ih = img.height || img.naturalHeight || SIZE;
                const aspect = iw / ih;
                let dx = 0, dy = 0, dw = SIZE, dh = SIZE;

                if (imageMode === 'contain') {
                    if (aspect > 1) { // Wider
                        dh = SIZE / aspect;
                        dy = (SIZE - dh) / 2;
                    } else {
                        dw = SIZE * aspect;
                        dx = (SIZE - dw) / 2;
                    }
                } else if (imageMode === 'cover') {
                    const scale = Math.max(SIZE / iw, SIZE / ih);
                    const scaledWidth = iw * scale;
                    const scaledHeight = ih * scale;
                    dx = (SIZE - scaledWidth) / 2;
                    dy = (SIZE - scaledHeight) / 2;
                    dw = scaledWidth;
                    dh = scaledHeight;
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, dx, dy, dw, dh);

                const dataUrl = canvas.toDataURL('image/png');
                setProcessedPreview(dataUrl);
            } catch (err) {
                logger.error('Critical Error processing image on canvas:', err);
                onError('Crash during image processing.');
            }
        };

        img.onerror = (err) => {
            logger.error('Image load error:', err);
            // A frequent cause is a MIME mismatch: an SVG saved/served with the
            // wrong (e.g. .png) type, so the bytes can't decode under that label.
            // Sniff + relabel once and retry before giving up.
            if (pendingImage.startsWith('data:')) {
                const fixed = normalizeImageDataUrl(pendingImage);
                if (fixed !== pendingImage) {
                    logger.log('Retrying image with corrected MIME type (svg).');
                    setPendingImage(fixed); // re-runs this effect with the fixed URL
                    return;
                }
            }
            // Genuinely undecodable, so surface an error instead of rendering a
            // broken preview the user can't act on.
            onError('Could not read that image. Try a PNG, JPEG, SVG, or WebP file.');
            setPendingImage(null);
        };

        if (pendingImage.startsWith('http')) {
            img.crossOrigin = 'anonymous';
        }
        img.src = pendingImage;
    }, [pendingImage, imageMode]);

    // Shared by the file picker and drag-and-drop. Neither opens an OS dialog
    // once we have the File object, so this is safe even inside the popup.
    const processFile = (file: File) => {
        if (!isValidFileType(file)) {
            onError('Invalid file type. Please upload PNG, JPEG, SVG, or WebP.');
            return;
        }

        if (!isValidFileSize(file)) {
            onError('File too large. Max size is 5MB.');
            return;
        }

        onSuccess('File selected. Processing...');

        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                // Correct a mislabeled MIME (e.g. an SVG saved as .png) up front so
                // the image decodes on the first try instead of erroring + retrying.
                setPendingImage(normalizeImageDataUrl(reader.result as string));
                setImageMode('contain');
                onSuccess(''); // Clear status
            } catch (err) {
                logger.error('Failed to load image data:', err);
                onError('Failed to load image data.');
            }
        };
        reader.onerror = () => {
            logger.error('FileReader error', reader.error);
            onError('Failed to read the selected file.');
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (!file) return;
        processFile(file);
    };

    // In the action popup, opening a native file dialog closes the popup, so
    // hand off to a standalone window. Everywhere else, open the dialog directly.
    const handleBrowse = () => {
        if (onRequestExpand) {
            onRequestExpand();
            return;
        }
        fileInputRef.current?.click();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleApply = async () => {
        if (!processedPreview) return;
        try {
            const compressed = await compressFaviconDataUrl(processedPreview);
            await onSave(compressed, 'upload', { imageMode });
            setPendingImage(null);
        } catch (e) {
            // handleSave already showed the error via statusMessage; keep pendingImage so the user can retry
            logger.error('Apply failed:', e);
        }
    };

    const handleUrlApply = async () => {
        if (!customUrl) return;
        // The same guard imported rules are held to, rather than "does new URL()
        // parse this": that accepted any scheme at all, so a typed rule could be
        // saved with something an imported one would have been rejected for.
        if (!isAllowedFaviconUrl(customUrl.trim())) {
            onError('Paste an image address starting with https:// or http://');
            return;
        }
        try {
            await onSave(customUrl.trim(), 'url', {});
            setCustomUrl('');
        } catch (e) {
            logger.error('URL apply failed:', e);
        }
    };

    return (
        <Accordion title="Upload Image or URL" icon={<svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} isOpen={isOpen} onToggle={onToggle}>
            <div className="space-y-3">
                {pendingImage ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">Adjust Image</div>
                        <div className="flex justify-center mb-3 bg-white p-2 rounded border border-slate-100 min-h-[80px] items-center">
                            {processedPreview ? (
                                <img
                                    src={processedPreview}
                                    className="w-16 h-16 border border-slate-200 rounded object-contain"
                                    // Inline CSS checkerboard (shows transparency behind the
                                    // preview), which avoids a third-party image request.
                                    style={{
                                        backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)',
                                        backgroundSize: '16px 16px',
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    <span className="text-[10px] text-slate-400">Processing...</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1 mb-3">
                            <button onClick={() => setImageMode('contain')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'contain' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Fit (Pad)</button>
                            <button onClick={() => setImageMode('cover')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'cover' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Fill (Crop)</button>
                            <button onClick={() => setImageMode('stretch')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'stretch' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Stretch</button>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setPendingImage(null)} className="flex-1">Cancel</Button>
                            <Button size="sm" onClick={handleApply} isLoading={isLoading} className="flex-1">Apply Icon</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Compact File Upload Row (click to browse / drop a file) */}
                        <div
                            className={`relative h-10 w-full border rounded-lg flex items-center pl-2 pr-1 cursor-pointer transition-all group ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-white hover:ring-2 hover:ring-indigo-500'}`}
                            onClick={handleBrowse}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            title={onRequestExpand ? 'Open the upload window to choose a file' : 'Click to choose a file, or drop one here'}
                        >
                            <div className="flex items-center gap-2 pl-1 flex-1 min-w-0">
                                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-slate-500 truncate group-hover:text-indigo-600 transition-colors">
                                    {isDragging ? 'Drop image to upload' : 'Upload icon, click or drag & drop'}
                                </span>
                            </div>
                            <div className="w-16 justify-center bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded shadow-sm group-hover:border-indigo-200 h-7 flex items-center">
                                {onRequestExpand ? 'Open' : 'Browse'}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="Choose an image file for the favicon" onChange={handleFileSelect} />
                        </div>
                        {onRequestExpand && (
                            <p className="text-[10px] text-slate-400 px-1 -mt-1 leading-tight">
                                Opens a small window so the file picker works reliably on every OS. You can also drag an image straight onto the box above.
                            </p>
                        )}

                        {/* URL Row */}
                        <div className="relative h-10 w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            </div>
                            <input
                                type="text"
                                aria-label="Image URL"
                                placeholder="Or paste image URL..."
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                className="w-full h-full border border-slate-200 bg-slate-50 rounded-lg pl-8 pr-20 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                // isLoading as well as the empty check: this one
                                // is a plain button rather than <Button>, so it
                                // was the one save control a second click could
                                // still reach mid-save (R-65).
                                disabled={!customUrl || isLoading}
                                onClick={handleUrlApply}
                                className="absolute right-1 top-1.5 bottom-1.5 w-16 justify-center bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded hover:bg-slate-50 disabled:opacity-50 h-7 flex items-center"
                            >
                                Apply
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Accordion>
    );
};
