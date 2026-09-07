import React, { useEffect, useRef, useState } from 'react';
import { GlobalSettings as GlobalSettingsType } from '../../types';
import { FaviconPreview } from '../FaviconPreview';
import { Button } from '../Button';
import { exportRulesAsJson, importRulesFromJson } from '../../utils/storage';
import { StorageMeter } from './StorageMeter';
import { describeImport } from '../../utils/importRules';
import { isAllowedFaviconUrl } from '../../utils/validation';
import { hostnameFromInput } from '../../utils/patterns';

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
    // Rejections from the two free-text fields, announced rather than swallowed.
    const [fallbackError, setFallbackError] = useState('');
    const [exclusionError, setExclusionError] = useState('');

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const report = await importRulesFromJson(content);
            alert(describeImport(report));
            if (report.success) onRefresh();
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
        // Held to the same standard as an imported rule's icon. This field had
        // no validation at all, so a typo became the icon on every site with no
        // rule of its own, which is the widest blast radius in the product.
        if (next && !isAllowedFaviconUrl(next)) {
            setFallbackError('That has to be an image address starting with https:// or http://, or an inline image.');
            return;
        }
        setFallbackError('');
        onSettingsChange({ ...settings, defaultFaviconUrl: next });
    };

    const excludedDomains = settings.excludedDomains ?? [];

    const handleAddExclusion = () => {
        const raw = newExcludedDomain.trim();
        if (!raw) return;
        // Normalised to a hostname, so pasting a full address works instead of
        // adding an entry that could never match. The content script compares
        // this against window.location.hostname exactly.
        const domain = hostnameFromInput(raw).toLowerCase();
        if (!domain) {
            setExclusionError('Enter a site, for example analytics.google.com.');
            return;
        }
        setExclusionError('');
        setNewExcludedDomain('');
        if (excludedDomains.includes(domain)) return;
        onSettingsChange({ ...settings, excludedDomains: [...excludedDomains, domain] });
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
                    <label htmlFor="fc-fallback-url" className="block text-sm font-medium text-slate-700 mb-2">Fallback Favicon</label>
                    {/* The old copy said "if a site has no favicon", which is not what
                        the code does and read as the extension going rogue across the
                        whole web. Detecting whether a site really has an icon is not
                        possible without a network request per page, which the privacy
                        position rules out, so the copy tells the truth instead. See
                        ROADMAP R-25. */}
                    <p className="text-xs text-slate-500 mb-3">
                        Applies to <strong>every site that has no matching rule</strong>, replacing whatever icon it
                        normally shows. Leave this empty to keep each site's own favicon.
                    </p>
                    <div className="flex gap-2">
                        <input
                            id="fc-fallback-url"
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

                    {!!fallbackError && (
                        <p role="status" aria-live="assertive" className="mt-2 text-[11px] text-red-700">
                            {fallbackError}
                        </p>
                    )}

                    {settings.defaultFaviconUrl && (
                        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-snug">
                            This is replacing the favicon on every site you visit that has no rule of its own. Clear
                            the field above to stop that.
                        </p>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <label htmlFor="fc-exclude-domain" className="block text-sm font-medium text-slate-700 mb-2">Excluded Sites</label>
                    <p className="text-xs text-slate-500 mb-3">
                        The extension will never touch these domains: no favicon changes, no DOM mutations.
                    </p>
                    <div className="flex gap-2 mb-3">
                        <input
                            id="fc-exclude-domain"
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
                    {!!exclusionError && (
                        <p role="status" aria-live="assertive" className="-mt-2 mb-3 text-[11px] text-red-700">
                            {exclusionError}
                        </p>
                    )}
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

                <StorageMeter />

                <div className="pt-4 border-t border-slate-100 flex gap-2">
                    <input type="file" ref={importInputRef} className="hidden" accept=".json" aria-label="Choose a rules JSON file to import" onChange={handleImport} />
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
