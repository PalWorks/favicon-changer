import React, { useState, useEffect, useRef } from 'react';
import { Accordion } from '../Accordion';
import { Button } from '../Button';
import { drawOverlay, drawBadge, BadgePosition } from '../../utils/canvas';
import { logger } from '../../utils/logger';

interface BadgeSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    sourceIconUrl: string;
    onSave: (url: string, type: 'custom') => void;
}

export const BadgeSection: React.FC<BadgeSectionProps> = ({ isOpen, onToggle, sourceIconUrl, onSave }) => {
    const [mode, setMode] = useState<'overlay' | 'badge'>('overlay');

    // Overlay State
    const [overlayColor, setOverlayColor] = useState('#3b82f6'); // Blue default
    const [overlayOpacity, setOverlayOpacity] = useState(0.5);

    // Badge State
    const [badgeText, setBadgeText] = useState('1');
    const [badgeBgColor, setBadgeBgColor] = useState('#ef4444'); // Red default
    const [badgeTextColor, setBadgeTextColor] = useState('#ffffff');
    const [badgePosition, setBadgePosition] = useState<BadgePosition>('bottom');

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Generate Preview
    useEffect(() => {
        if (!isOpen || !sourceIconUrl) return;

        const generate = async () => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = sourceIconUrl;

            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

            const canvas = document.createElement('canvas');
            const SIZE = 128;
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw Base
            ctx.clearRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, 0, 0, SIZE, SIZE);

            if (mode === 'overlay') {
                drawOverlay(ctx, SIZE, SIZE, overlayColor, overlayOpacity);
            } else {
                drawBadge(ctx, SIZE, SIZE, badgeText, badgeBgColor, badgeTextColor, badgePosition);
            }

            setPreviewUrl(canvas.toDataURL('image/png'));
        };

        generate();
    }, [isOpen, sourceIconUrl, mode, overlayColor, overlayOpacity, badgeText, badgeBgColor, badgeTextColor, badgePosition]);

    const handleApply = () => {
        if (previewUrl) {
            onSave(previewUrl, 'custom');
        }
    };

    return (
        <Accordion title="Add Badge or Overlay" icon="🏷️" isOpen={isOpen} onToggle={onToggle}>
            <div className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('overlay')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'overlay' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Color Overlay
                    </button>
                    <button
                        onClick={() => setMode('badge')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'badge' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Notification Badge
                    </button>
                </div>

                {/* Preview Area */}
                <div className="flex justify-center bg-white p-4 rounded-lg border border-slate-200">
                    {previewUrl ? (
                        <img src={previewUrl} className="w-16 h-16 object-contain" />
                    ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded animate-pulse" />
                    )}
                </div>

                {/* Controls */}
                {mode === 'overlay' ? (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Overlay Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={overlayColor}
                                    onChange={(e) => setOverlayColor(e.target.value)}
                                    className="h-8 w-12 p-0 border-0 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={overlayColor}
                                    onChange={(e) => setOverlayColor(e.target.value)}
                                    className="flex-1 border border-slate-200 rounded px-2 text-xs font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Opacity: {Math.round(overlayOpacity * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={overlayOpacity}
                                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                                className="w-full accent-indigo-600"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Badge Text (Max 3)</label>
                            <input
                                type="text"
                                maxLength={3}
                                value={badgeText}
                                onChange={(e) => setBadgeText(e.target.value)}
                                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Background</label>
                                <div className="flex items-center gap-1">
                                    <input type="color" value={badgeBgColor} onChange={(e) => setBadgeBgColor(e.target.value)} className="h-6 w-6 p-0 border-0 rounded cursor-pointer" />
                                    <span className="text-xs text-slate-500 font-mono">{badgeBgColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Text Color</label>
                                <div className="flex items-center gap-1">
                                    <input type="color" value={badgeTextColor} onChange={(e) => setBadgeTextColor(e.target.value)} className="h-6 w-6 p-0 border-0 rounded cursor-pointer" />
                                    <span className="text-xs text-slate-500 font-mono">{badgeTextColor}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Position</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['top', 'bottom'] as BadgePosition[]).map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => setBadgePosition(pos)}
                                        className={`py-1 px-2 text-[10px] uppercase font-bold rounded border ${badgePosition === pos ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <Button onClick={handleApply} className="w-full">Apply to Favicon</Button>
            </div>
        </Accordion>
    );
};
