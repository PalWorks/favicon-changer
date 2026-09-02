import React, { useEffect, useRef, useState } from 'react';
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
    const [newExcludedDomain, setNewExcludedDomain] = useState('');
    // Held locally while typing. Committing on every keystroke wrote to
    // chrome.storage AND broadcast RulesUpdated to every open tab per character
    // (LIMITATIONS L-07), which on a 40-character URL meant 40 writes and 40
    // full-tab fan-outs. Commit happens on blur or Enter instead.
    const [fallbackDraft, setFallbackDraft] = useState(settings.defaultFaviconUrl || '');

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const result = await importRulesFromJson(content);
            if (result.success) {
                const note = result.remoteCount > 0
                    ? `\n\nNote: ${result.remoteCount} rule(s) use a remote image URL that will be fetched from its source whenever the rule applies.`
                    : '';
                alert(`Successfully imported ${result.count} rules!${note}`);
                onRefresh();
            } else {
                alert('Failed to import rules. Please check the file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Re-sync when the value changes elsewhere (the popup, or another options
    // tab via storage.onChanged). Keyed on the stored value, so this cannot fire
    // mid-typing: nothing is stored until the field is committed.
    useEffect(() => {
        setFallbackDraft(settings.defaultFaviconUrl || '');
    }, [settings.defaultFaviconUrl]);

    const commitFallback = () => {
        const next = fallbackDraft.trim() || undefined;
        // Skip a no-op save so blurring an untouched field does not broadcast.
        if (next === (settings.defaultFaviconUrl || undefined)) return;
        onSettingsChange({ ...settings, defaultFaviconUrl: next });
    };

    const excludedDomains = settings.excludedDomains ?? [];

    const handleAddExclusion = () => {
        const domain = newExcludedDomain.trim().toLowerCase();
        if (!domain || excludedDomains.includes(domain)) return;
        onSettingsChange({ ...settings, excludedDomains: [...excludedDomains, domain] });
        setNewExcludedDomain('');
    };

    const handleRemoveExclusion = (domain: string) => {
        onSettingsChange({ ...settings, excludedDomains: excludedDomains.filter(d => d !== domain) });
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
                            value={fallbackDraft}
                            onChange={(e) => setFallbackDraft(e.target.value)}
                            onBlur={commitFallback}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitFallback(); }}
                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                        />
                        <div className="w-10 h-10 shrink-0">
                            <FaviconPreview url={fallbackDraft} />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Excluded Sites</label>
                    <p className="text-xs text-slate-500 mb-3">
                        The extension will never touch these domains: no favicon changes, no DOM mutations.
                    </p>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="e.g. analytics.google.com"
                            value={newExcludedDomain}
                            onChange={e => setNewExcludedDomain(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddExclusion(); }}
                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                        />
                        <Button size="sm" variant="secondary" onClick={handleAddExclusion}>
                            Add
                        </Button>
                    </div>
                    {excludedDomains.length > 0 && (
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                            {excludedDomains.map(domain => (
                                <li key={domain} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-sm">
                                    <span className="text-slate-700 font-mono text-xs">{domain}</span>
                                    <button
                                        onClick={() => handleRemoveExclusion(domain)}
                                        className="text-slate-400 hover:text-red-500 transition-colors ml-2 text-base leading-none"
                                        aria-label={`Remove ${domain}`}
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
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
