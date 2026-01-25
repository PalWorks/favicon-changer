import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../Button';
import { Accordion } from '../Accordion';
import { logger } from '../../utils/logger';

type ImageMode = 'contain' | 'cover' | 'stretch';

interface UploadSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    onSave: (url: string, type: 'upload' | 'url') => void;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ isOpen, onToggle, onSave, onError, onSuccess }) => {
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [imageMode, setImageMode] = useState<ImageMode>('contain');
    const [processedPreview, setProcessedPreview] = useState<string | null>(null);
    const [customUrl, setCustomUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

                const aspect = img.width / img.height;
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
                    const scale = Math.max(SIZE / img.width, SIZE / img.height);
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
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
            if (pendingImage.startsWith('data:')) {
                setProcessedPreview(pendingImage);
            } else {
                onError('Failed to process image.');
                setPendingImage(null);
            }
        };

        if (pendingImage.startsWith('http')) {
            img.crossOrigin = 'anonymous';
        }
        img.src = pendingImage;
    }, [pendingImage, imageMode]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSuccess('File selected. Processing...');
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                const result = reader.result as string;
                setTimeout(() => {
                    try {
                        setPendingImage(result);
                        setImageMode('contain');
                        onSuccess(''); // Clear status
                    } catch (innerErr) {
                        logger.error('Crash inside setTimeout:', innerErr);
                    }
                }, 500);
            } catch (err) {
                onError('Failed to load image data.');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleApply = () => {
        if (processedPreview) {
            onSave(processedPreview, 'upload');
            setPendingImage(null);
        }
    };

    const handleUrlApply = () => {
        if (customUrl) {
            onSave(customUrl, 'url');
            setCustomUrl('');
        }
    };

    return (
        <Accordion title="Upload Image or URL" icon="📂" isOpen={isOpen} onToggle={onToggle}>
            <div className="space-y-3">
                {pendingImage ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">Adjust Image</div>
                        <div className="flex justify-center mb-3 bg-white p-2 rounded border border-slate-100 min-h-[80px] items-center">
                            {processedPreview ? (
                                <img src={processedPreview} className="w-16 h-16 border border-slate-200 rounded object-contain bg-[url('https://www.transparenttextures.com/patterns/checkerboard-cross.png')]" />
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
                            <Button size="sm" onClick={handleApply} className="flex-1">Apply Icon</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Compact File Upload Row */}
                        <div
                            className="relative h-10 w-full border border-slate-200 bg-slate-50 rounded-lg flex items-center pl-2 pr-1 cursor-pointer hover:bg-white hover:ring-2 hover:ring-indigo-500 transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                            title="Click to choose a file"
                        >
                            <div className="flex items-center gap-2 pl-1 flex-1 min-w-0">
                                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-slate-500 truncate group-hover:text-indigo-600 transition-colors">
                                    Upload icon (PNG/SVG, 48x48px+)
                                </span>
                            </div>
                            <div className="w-16 justify-center bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded shadow-sm group-hover:border-indigo-200 h-7 flex items-center">
                                Browse
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/svg+xml" onChange={handleFileSelect} />
                        </div>

                        {/* URL Row */}
                        <div className="relative h-10 w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-xs">🔗</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Or paste image URL..."
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                className="w-full h-full border border-slate-200 bg-slate-50 rounded-lg pl-8 pr-20 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                disabled={!customUrl}
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
