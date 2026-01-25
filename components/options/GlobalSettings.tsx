import React, { useRef } from 'react';
import { GlobalSettings as GlobalSettingsType } from '../../types';
import { FaviconPreview } from '../FaviconPreview';
import { Button } from '../Button';
import { exportRulesAsJson, importRulesFromJson } from '../../utils/storage';

interface GlobalSettingsProps {
    settings: GlobalSettingsType;
    onSettingsChange: (newSettings: GlobalSettingsType) => void;
    onRefresh: () => void;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ settings, onSettingsChange, onRefresh }) => {
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const result = await importRulesFromJson(content);
            if (result.success) {
                alert(`Successfully imported ${result.count} rules!`);
                onRefresh();
            } else {
                alert('Failed to import rules. Please check the file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleGlobalFallbackChange = async (url: string) => {
        onSettingsChange({ ...settings, defaultFaviconUrl: url || undefined });
    };

    return (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">⚙️</span> Global Settings
            </h2>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Default Fallback Favicon</label>
                    <p className="text-xs text-slate-500 mb-3">If a site has no favicon (and no specific rule matches), use this one.</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Image URL..."
                            value={settings.defaultFaviconUrl || ''}
                            onChange={(e) => onSettingsChange({ ...settings, defaultFaviconUrl: e.target.value })}
                            onBlur={(e) => handleGlobalFallbackChange(e.target.value)}
                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                        />
                        <div className="w-10 h-10 shrink-0">
                            <FaviconPreview url={settings.defaultFaviconUrl || ''} />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-2">
                    <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
                    <Button size="sm" variant="secondary" onClick={() => importInputRef.current?.click()}>
                        📥 Import JSON
                    </Button>
                    <Button size="sm" variant="secondary" onClick={exportRulesAsJson}>
                        📤 Export JSON
                    </Button>
                </div>
            </div>
        </section>
    );
};
