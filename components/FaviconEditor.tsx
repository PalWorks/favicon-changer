import React, { useState, useEffect, useRef } from 'react';
import { getCurrentTabInfo, getStorageData, saveRule, deleteRule, generateId, openOptionsPage, isAllowedFileSchemeAccess, exportRulesAsJson, importRulesFromJson } from '../utils/storage';
import { logger } from '../utils/logger';
import { FaviconRule, TabInfo } from '../types';
import { Button } from './Button';
import { FaviconPreview } from './FaviconPreview';
import { UploadSection } from './editor/UploadSection';
import { EmojiSection } from './editor/EmojiSection';
import { BadgeSection } from './editor/BadgeSection';

interface FaviconEditorProps {
    mode: 'popup' | 'options';
    initialRule?: FaviconRule | null;
    onRuleSaved?: () => void;
}

export const FaviconEditor: React.FC<FaviconEditorProps> = ({ mode, initialRule, onRuleSaved }) => {
    const [currentTab, setCurrentTab] = useState<TabInfo>({ url: '', domain: '', favIconUrl: '' });
    const [rules, setRules] = useState<FaviconRule[]>([]);
    const [openSection, setOpenSection] = useState<'upload' | 'emoji' | 'badge' | null>(null);

    // Inputs
    const [manualUrl, setManualUrl] = useState('');
    const [applyScope, setApplyScope] = useState<'domain' | 'exact_url'>('exact_url');
    const [fileAccess, setFileAccess] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        logger.log(`FaviconEditor Mounted - Mode: ${mode}`);
        refreshData();
    }, [mode]);

    // When initialRule changes (in Options mode), load it
    useEffect(() => {
        if (mode === 'options' && initialRule) {
            setManualUrl(initialRule.matcher);
            setApplyScope(initialRule.matchType === 'regex' ? 'exact_url' : initialRule.matchType);

            try {
                const urlObj = new URL(initialRule.matcher.startsWith('http') ? initialRule.matcher : `https://${initialRule.matcher}`);
                setCurrentTab({
                    url: initialRule.matcher,
                    domain: urlObj.hostname,
                    favIconUrl: initialRule.faviconUrl
                });
            } catch (e) {
                setCurrentTab({
                    url: initialRule.matcher,
                    domain: initialRule.matcher,
                    favIconUrl: initialRule.faviconUrl
                });
            }
        } else if (mode === 'options' && !initialRule) {
            setManualUrl('');
            setCurrentTab({ url: '', domain: '', favIconUrl: '' });
        }
    }, [initialRule, mode]);

    const refreshData = async () => {
        if (mode === 'popup') {
            const info = await getCurrentTabInfo();
            setCurrentTab(info);
        }
        const data = await getStorageData();
        setRules(Object.values(data.rules));
        const allowed = await isAllowedFileSchemeAccess();
        setFileAccess(allowed);
    };

    const handleSave = async (url: string, sourceType: FaviconRule['sourceType']) => {
        const targetUrl = mode === 'popup' ? currentTab.url : manualUrl;
        const targetDomain = mode === 'popup' ? currentTab.domain : (manualUrl ? new URL(manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`).hostname : '');

        if (!targetUrl) {
            setStatusMessage({ type: 'error', text: 'No target URL specified.' });
            return;
        }

        const matcher = applyScope === 'domain' ? targetDomain : targetUrl;
        const existingRule = rules.find(r => r.matcher === matcher && r.matchType === applyScope);

        const newRule: FaviconRule = {
            id: existingRule?.id || generateId(),
            matcher,
            matchType: applyScope,
            faviconUrl: url,
            originalUrl: existingRule?.originalUrl || (sourceType === 'custom' ? currentTab.favIconUrl : undefined),
            sourceType,
            createdAt: Date.now()
        };

        await saveRule(newRule);
        refreshData();
        if (onRuleSaved) onRuleSaved();

        setStatusMessage({ type: 'success', text: 'Favicon updated successfully!' });

        setTimeout(() => {
            setStatusMessage(null);
        }, 2000);
    };

    const handleDelete = async (id: string) => {
        await deleteRule(id);
        refreshData();
        if (onRuleSaved) onRuleSaved();
    };

    const handleDownloadOriginal = async () => {
        if (!currentTab.favIconUrl) return;
        try {
            const response = await fetch(currentTab.favIconUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `favicon-${currentTab.domain}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            window.open(currentTab.favIconUrl, '_blank');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const result = await importRulesFromJson(content);
            if (result.success) {
                alert(`Successfully imported ${result.count} rules!`);
                refreshData();
                if (onRuleSaved) onRuleSaved();
            } else {
                alert('Failed to import rules. Invalid file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const toggleSection = (section: 'upload' | 'emoji' | 'badge') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    const activeRule = rules.find(r => {
        const targetMatcher = mode === 'popup' ? (applyScope === 'domain' ? currentTab.domain : currentTab.url) : manualUrl;
        return r.matcher === targetMatcher && r.matchType === applyScope;
    });

    const hasValidTarget = mode === 'popup' ? !!currentTab.url : !!manualUrl;

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col">
            {/* Header - Only show in Popup mode */}
            {mode === 'popup' && (
                <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="icons/FaviconChangerLogo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-contain" />
                        <h1 className="text-lg font-bold text-slate-800">Favicon Changer</h1>
                    </div>

                    <div className="flex gap-1">
                        <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />

                        <button
                            onClick={() => importInputRef.current?.click()}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Import Rules"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </button>
                        <button
                            onClick={exportRulesAsJson}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Export Rules"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        <div className="w-px h-5 bg-slate-200 mx-1 self-center"></div>
                        <button
                            onClick={openOptionsPage}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Open Dashboard & Settings"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>
                </header>
            )}

            <main className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-5">
                    {/* Status Message */}
                    {statusMessage && (
                        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <span>{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Target Status */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Page</h2>
                            <div className="flex items-center gap-2">
                                {activeRule ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase tracking-wide">Active</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-bold uppercase tracking-wide">Inactive</span>
                                )}

                                <button
                                    onClick={() => activeRule && handleDelete(activeRule.id)}
                                    disabled={!activeRule}
                                    className={`h-6 px-3 text-[10px] uppercase font-bold tracking-wide rounded border transition-all ${activeRule
                                        ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                                        : 'border-slate-100 text-slate-300 cursor-not-allowed'
                                        }`}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* URL Input / Display */}
                        {mode === 'options' ? (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Enter URL or Domain to Configure</label>
                                <input
                                    type="text"
                                    value={manualUrl}
                                    onChange={(e) => setManualUrl(e.target.value)}
                                    placeholder="e.g. google.com or https://example.com/page"
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FaviconPreview url={activeRule?.faviconUrl || currentTab.favIconUrl} size="md" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]" title={currentTab.url}>{currentTab.domain}</p>
                                        <p className="text-xs text-slate-500 truncate">{activeRule ? `Overridden by ${activeRule.matchType}` : 'Using original'}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleDownloadOriginal}
                                    disabled={!currentTab.favIconUrl}
                                    title="Export Original Favicon"
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Scope Toggles */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setApplyScope('domain')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${applyScope === 'domain' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Entire Domain
                            </button>
                            <button
                                onClick={() => setApplyScope('exact_url')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${applyScope === 'exact_url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                This Page Only
                            </button>
                        </div>
                    </div>

                    {!fileAccess && currentTab.url.startsWith('file:') && (
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex flex-col gap-2">
                            <p><strong>Permission Required:</strong> To change icons for local files, you need to enable "Allow access to file URLs" in settings.</p>
                            <Button size="sm" variant="secondary" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id })}>
                                Open Settings
                            </Button>
                        </div>
                    )}

                    <div className={!hasValidTarget ? 'opacity-50 pointer-events-none grayscale' : ''}>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 px-1">Customize</h3>

                        <UploadSection
                            isOpen={openSection === 'upload'}
                            onToggle={() => toggleSection('upload')}
                            onSave={handleSave}
                            onError={(msg) => setStatusMessage({ type: 'error', text: msg })}
                            onSuccess={(msg) => msg ? setStatusMessage({ type: 'success', text: msg }) : setStatusMessage(null)}
                        />

                        <EmojiSection
                            isOpen={openSection === 'emoji'}
                            onToggle={() => toggleSection('emoji')}
                            onSave={handleSave}
                        />

                        <BadgeSection
                            isOpen={openSection === 'badge'}
                            onToggle={() => toggleSection('badge')}
                            sourceIconUrl={activeRule?.originalUrl || currentTab.favIconUrl}
                            onSave={handleSave}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
