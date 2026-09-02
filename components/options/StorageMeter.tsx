import React, { useCallback, useEffect, useState } from 'react';
import { getStorageUsage, StorageUsage } from '../../utils/storage';

// Above this, the warning appears. Chosen so there is room to act before a save
// actually fails, which is how users used to find out (LIMITATIONS L-12).
const WARN_AT_PERCENT = 75;

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Shows how much of the browser's storage quota the rules occupy. Self-refreshing
 * via storage.onChanged, so it needs no wiring from the page around it.
 */
export const StorageMeter: React.FC = () => {
    const [usage, setUsage] = useState<StorageUsage | null>(null);

    const read = useCallback(() => {
        getStorageUsage().then(setUsage).catch(() => setUsage(null));
    }, []);

    useEffect(() => {
        read();
        if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
        const onChanged = (_changes: any, area: string) => {
            if (area === 'local') read();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, [read]);

    if (!usage) return null;

    const percent = Math.min(100, usage.percent);
    const isWarning = percent >= WARN_AT_PERCENT;

    return (
        <div className="pt-4 border-t border-slate-100">
            <div className="flex items-baseline justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Storage Used</label>
                <span className={`text-xs font-mono ${isWarning ? 'text-amber-700' : 'text-slate-500'}`}>
                    {formatBytes(usage.bytes)} of {formatBytes(usage.quota)}
                </span>
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
                <div
                    className={`h-full rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.max(percent, 0.5)}%` }}
                />
            </div>

            <p className="text-xs text-slate-500 mt-2 leading-snug">
                {isWarning
                    ? 'Running low. Uploaded images take the most room, so deleting a few image rules frees the most space.'
                    : 'Icons are stored on your device, so rules use a share of the browser storage quota.'}
            </p>
        </div>
    );
};
