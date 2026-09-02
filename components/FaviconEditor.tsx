import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getCurrentTabInfo, getStorageData, saveRule, deleteRule, generateId, openOptionsPage, isAllowedFileSchemeAccess, exportRulesAsJson, importRulesFromJson, openExpandedEditor, consumePendingEditorTarget, getOpenTabs, OpenTab } from '../utils/storage';
import { logger } from '../utils/logger';
import { findConflictingRule, patternMatches } from '../utils/matcher';
import { popupClosesOnFileDialog } from '../utils/platform';
import { hostnameFromInput, suggestPrefix, suggestRegex } from '../utils/patterns';
import { describeImport } from '../utils/importRules';
import { isValidRegex } from '../utils/validation';

import { FaviconRule, MatchType, TabInfo } from '../types';
import { Button } from './Button';
import { FaviconPreview } from './FaviconPreview';
import { UploadSection } from './editor/UploadSection';
import { EmojiSection } from './editor/EmojiSection';
import { BadgeSection } from './editor/BadgeSection';

// The scope control. Order is deliberate: the original two come first so
// existing users' muscle memory still works, with the two pattern types after.
const SCOPES: { type: MatchType; label: string; hint: string }[] = [
    { type: 'domain', label: 'Entire Domain', hint: 'Every page on this site, subdomains included.' },
    { type: 'exact_url', label: 'This Page Only', hint: 'Only this exact address, query string and all.' },
    { type: 'prefix', label: 'URL Starts With', hint: 'Every address beginning with this text. Good for one document across its views.' },
    { type: 'regex', label: 'Regex', hint: 'A regular expression tested against the whole URL. Unanchored unless you add ^.' },
];

// Scopes whose matcher is a pattern the user edits, rather than being taken
// from the target page.
const PATTERN_SCOPES: MatchType[] = ['prefix', 'regex'];

interface FaviconEditorProps {
    mode: 'popup' | 'options';
    // 'action'  = the toolbar popup bubble (closes on blur; can't host a file dialog)
    // 'expanded' = the standalone upload window opened by the action popup
    context?: 'action' | 'expanded';
    initialRule?: FaviconRule | null;
    onRuleSaved?: () => void;
}

export const FaviconEditor: React.FC<FaviconEditorProps> = ({ mode, context = 'action', initialRule, onRuleSaved }) => {
    const [currentTab, setCurrentTab] = useState<TabInfo>({ url: '', domain: '', favIconUrl: '' });
    const [rules, setRules] = useState<FaviconRule[]>([]);
    const [openSection, setOpenSection] = useState<'upload' | 'emoji' | 'badge' | null>(null);

    const [isSaving, setIsSaving] = useState(false);

    // Inputs
    const [manualUrl, setManualUrl] = useState('');
    const [applyScope, setApplyScope] = useState<MatchType>('exact_url');
    // The matcher for the pattern scopes (prefix, regex), which the user edits
    // directly. patternDraftFor records which scope the current draft was built
    // for, so switching prefix <-> regex regenerates it (the syntaxes differ)
    // while switching away and back keeps the user's edits.
    const [patternDraft, setPatternDraft] = useState('');
    const [patternDraftFor, setPatternDraftFor] = useState<MatchType | null>(null);
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [fileAccess, setFileAccess] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    // Whether this OS kills the action popup when a file dialog opens, so the
    // upload has to be handed to a standalone window (ADR-007). Resolved from
    // the same helper the service worker uses, so the button label cannot
    // describe behaviour the service worker did not configure.
    const [popupDropsFileDialog, setPopupDropsFileDialog] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        popupClosesOnFileDialog().then(setPopupDropsFileDialog);
        getOpenTabs().then(setOpenTabs);
    }, []);

    useEffect(() => {
        logger.info(`FaviconEditor Mounted - Mode: ${mode} / Context: ${context}`);
        refreshData();
    }, [mode]);

    // Expanded upload window: load the target the action popup handed off, then
    // auto-open the relevant section so the user can pick a file immediately.
    useEffect(() => {
        if (mode !== 'popup' || context !== 'expanded') return;
        (async () => {
            const target = await consumePendingEditorTarget();
            if (target) {
                logger.debug('Expanded editor: loaded handoff target', target);
                setCurrentTab({ url: target.url, domain: target.domain, favIconUrl: target.favIconUrl });
                setApplyScope(target.scope);
                if (PATTERN_SCOPES.includes(target.scope)) {
                    setPatternDraft(target.matcher || suggestionFor(target.scope, target.url));
                    setPatternDraftFor(target.scope);
                }
                // Icon-opened window: collapsed like the bubble. Browse-handoff: open upload.
                setOpenSection(target.section || null);
            } else {
                // Opened directly (e.g. user navigated here). Fall back to active tab.
                const info = await getCurrentTabInfo();
                setCurrentTab(info);
                setOpenSection('upload');
            }
        })();
    }, [mode, context]);

    // Prefills a pattern that covers "this document" rather than this exact
    // page, so prefix and regex rules are usually one click rather than a
    // text-editing exercise. See utils/patterns.ts.
    const suggestionFor = (scope: MatchType, url: string): string => {
        if (!url) return '';
        if (scope === 'prefix') return suggestPrefix(url);
        if (scope === 'regex') return suggestRegex(url);
        return '';
    };

    const selectScope = (scope: MatchType) => {
        setApplyScope(scope);
        // Regenerate only when the draft was built for a different scope, so
        // toggling away and back does not throw away the user's edits.
        if (PATTERN_SCOPES.includes(scope) && patternDraftFor !== scope) {
            setPatternDraft(suggestionFor(scope, mode === 'popup' ? currentTab.url : manualUrl));
            setPatternDraftFor(scope);
        }
    };

    // Action popup can't host a native file dialog without closing itself, so the
    // "Browse" action hands the current target off to a standalone window.
    const requestExpandedUpload = async () => {
        try {
            await openExpandedEditor({
                url: currentTab.url,
                domain: currentTab.domain,
                favIconUrl: currentTab.favIconUrl,
                scope: applyScope,
                matcher: patternDraft,
                section: 'upload',
            });
        } catch (e) {
            logger.error('Failed to open upload window', e);
            setStatusMessage({ type: 'error', text: 'Could not open the upload window.' });
        }
    };

    // When initialRule changes (in Options mode), load it
    // 1. Handle Rule Selection / Deselection (Reset)
    useEffect(() => {
        if (mode !== 'options') return;

        if (initialRule) {
            logger.debug('Loading initial rule', initialRule);
            setManualUrl(initialRule.matcher);
            setApplyScope(initialRule.matchType);
            if (PATTERN_SCOPES.includes(initialRule.matchType)) {
                setPatternDraft(initialRule.matcher);
                setPatternDraftFor(initialRule.matchType);
            } else {
                setPatternDraft('');
                setPatternDraftFor(null);
            }

            // Auto-expand section based on sourceType or metadata
            if (initialRule.sourceType === 'emoji') {
                setOpenSection('emoji');
            } else if (initialRule.sourceType === 'custom') {
                setOpenSection('badge');
            } else if (initialRule.sourceType === 'upload' || initialRule.sourceType === 'url') {
                setOpenSection('upload');
            }

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
        } else {
            // Reset to "New Rule" state
            logger.debug('Resetting editor for new rule');
            setManualUrl('');
            setApplyScope('exact_url');
            setPatternDraft('');
            setPatternDraftFor(null);
            setOpenSection(null);
            setCurrentTab({ url: '', domain: '', favIconUrl: '' });
        }
    }, [initialRule, mode]);

    // 2. Handle Manual URL Typing (Live Preview)
    useEffect(() => {
        if (mode !== 'options' || initialRule) return; // Only for new rule creation

        if (manualUrl) {
            try {
                const urlObj = new URL(manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`);
                const domain = urlObj.hostname;
                // Use Google's favicon service as a reliable fallback for the options page
                const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                
                setCurrentTab({
                    url: manualUrl,
                    domain: domain,
                    favIconUrl: googleFaviconUrl
                });
            } catch (e) {
                // Invalid URL, just reset
                setCurrentTab({ url: manualUrl, domain: '', favIconUrl: '' });
            }
        } else {
            setCurrentTab({ url: '', domain: '', favIconUrl: '' });
        }
    }, [manualUrl, mode, initialRule]);

    const refreshData = async () => {
        try {
            // Action popup: re-query the active tab (idempotent). Expanded window:
            // the target is loaded once by the effect below and must not be
            // overwritten here — getCurrentTabInfo() in a window would return the
            // window's own (empty) tab and blank out the target after a save.
            if (mode === 'popup' && context === 'action') {
                const info = await getCurrentTabInfo();
                logger.debug('Popup: Retrieved tab info', info);
                setCurrentTab(info);
            }
            const data = await getStorageData();
            logger.debug('Storage data loaded', { ruleCount: Object.keys(data.rules).length });
            setRules(Object.values(data.rules));
            const allowed = await isAllowedFileSchemeAccess();
            setFileAccess(allowed);
        } catch (err) {
            logger.error('Failed to refresh data', err);
        }
    };

    // --- Target and matcher derivation ---------------------------------------
    // One place that decides what this rule will match, shared by the save path,
    // the Active/Inactive pill and the live pattern preview, so the three can
    // never disagree about which rule is being edited.
    const targetUrl = mode === 'popup' ? currentTab.url : manualUrl;
    const targetDomain = mode === 'popup' ? currentTab.domain : hostnameFromInput(manualUrl);

    const currentMatcher =
        applyScope === 'domain' ? targetDomain
            : applyScope === 'exact_url' ? targetUrl
                : patternDraft.trim();

    const patternError = useMemo(() => {
        if (!PATTERN_SCOPES.includes(applyScope)) return null;
        const value = patternDraft.trim();
        if (!value) return null; // incomplete rather than wrong; the save path handles empty
        if (applyScope === 'regex' && !isValidRegex(value)) {
            return 'That is not a valid regular expression.';
        }
        if (applyScope === 'prefix' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            // A prefix is compared against the whole URL, so it has to start
            // where the URL starts.
            return 'A prefix has to start from the beginning of the address, e.g. https://example.com/docs';
        }
        return null;
    }, [applyScope, patternDraft]);

    // Which of the user's open tabs this pattern would cover. Shown live, so a
    // pattern can be sanity-checked before it is saved rather than after.
    const patternPreview = useMemo(() => {
        if (!PATTERN_SCOPES.includes(applyScope) || !currentMatcher || patternError) return null;
        return {
            matched: openTabs.filter(tab => patternMatches(applyScope, currentMatcher, tab.url, tab.hostname)),
            total: openTabs.length,
            coversTarget: !!targetUrl && patternMatches(applyScope, currentMatcher, targetUrl, targetDomain),
        };
    }, [applyScope, currentMatcher, patternError, openTabs, targetUrl, targetDomain]);

    const activeScope = SCOPES.find(s => s.type === applyScope);

    const handleSave = async (url: string, sourceType: FaviconRule['sourceType'], metadata?: FaviconRule['metadata']) => {
        setIsSaving(true);
        logger.info('Attempting to save rule', { sourceType, metadata });

        try {
            if (!targetUrl) {
                logger.warn('Save failed: No target URL specified');
                setStatusMessage({ type: 'error', text: 'No target URL specified.' });
                throw new Error('No target URL specified.');
            }

            const matchType = applyScope;
            const matcher = currentMatcher;

            if (!matcher) {
                const message = matchType === 'domain'
                    ? 'Could not read a domain from that address.'
                    : 'Enter a pattern to match.';
                setStatusMessage({ type: 'error', text: message });
                throw new Error(message);
            }
            if (patternError) {
                setStatusMessage({ type: 'error', text: patternError });
                throw new Error(patternError);
            }

            // When a known rule is loaded in the editor, keep editing THAT rule.
            // Looking it up by matcher + matchType used to miss any rule whose
            // type the editor had coerced, so the save created a duplicate under
            // a fresh id and left the broken original behind (LIMITATIONS L-03).
            const existingRule = initialRule
                ? rules.find(r => r.id === initialRule.id)
                : rules.find(r => r.matcher === matcher && r.matchType === matchType);

            const newRule: FaviconRule = {
                id: existingRule?.id || generateId(),
                matcher,
                matchType,
                faviconUrl: url,
                originalUrl: existingRule?.originalUrl || (sourceType === 'custom' ? currentTab.favIconUrl : undefined),
                sourceType,
                metadata,
                // createdAt used to be overwritten on every save, which made the
                // rules list's "Created" column a last-modified stamp and
                // destroyed the only ordering signal a rule carries
                // (LIMITATIONS L-10).
                createdAt: existingRule?.createdAt ?? Date.now(),
                updatedAt: Date.now()
            };

            logger.info('Saving rule', newRule);
            await saveRule(newRule);
            await refreshData();
            if (onRuleSaved) onRuleSaved();

            setStatusMessage({ type: 'success', text: 'Favicon updated successfully!' });

            setTimeout(() => {
                setStatusMessage(null);
            }, 2000);
        } catch (error: any) {
            logger.error('Failed to save rule', error);
            const isQuota = error?.message?.toLowerCase().includes('quota');
            const msg = isQuota
                ? 'Storage full. Try deleting unused rules to free space.'
                : (error?.message || 'Failed to save favicon. Please try again.');
            setStatusMessage({ type: 'error', text: msg });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        logger.info('Deleting rule', { id });
        await deleteRule(id);
        refreshData();
        if (onRuleSaved) onRuleSaved();
    };

    const handleDownloadOriginal = async () => {
        if (!currentTab.favIconUrl) return;
        try {
            const response = await fetch(currentTab.favIconUrl);
            const blob = await response.blob();
            // Derive the extension from the real content type — many sites (e.g.
            // GitHub) serve an SVG favicon. Saving it as .png produced a file whose
            // bytes don't match its name, which then failed to decode on re-upload.
            const extByMime: Record<string, string> = {
                'image/svg+xml': 'svg',
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/x-icon': 'ico',
                'image/vnd.microsoft.icon': 'ico',
            };
            const ext = extByMime[blob.type.split(';')[0].trim()] || 'png';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `favicon-${currentTab.domain}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            logger.error('Failed to download original favicon', e);
            window.open(currentTab.favIconUrl, '_blank');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            try {
                const report = await importRulesFromJson(content);
                logger.info('Import finished', { success: report.success, count: report.count, rejected: report.rejected.length });
                // Rejected rules are reported individually with a reason, rather
                // than dropped silently as they were before R-07.
                alert(describeImport(report));
                if (report.success) {
                    refreshData();
                    if (onRuleSaved) onRuleSaved();
                }
            } catch (err) {
                logger.error('Import crashed', err);
                alert('Could not read that file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const toggleSection = (section: 'upload' | 'emoji' | 'badge') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    const activeRule = rules.find(r => r.matcher === currentMatcher && r.matchType === applyScope);

    const hasValidTarget = mode === 'popup' ? !!currentTab.url : !!manualUrl;


    const [conflictRule, setConflictRule] = useState<FaviconRule | null>(null);

    // Check for conflicts/shadowing. Any rule in a strictly higher precedence
    // tier that also matches this page will win, so the edit would have no
    // visible effect and the user should be told before they save.
    useEffect(() => {
        if (!targetUrl) {
            setConflictRule(null);
            return;
        }
        // A rule being edited cannot shadow itself.
        const others = initialRule ? rules.filter(r => r.id !== initialRule.id) : rules;
        setConflictRule(findConflictingRule(targetUrl, applyScope, others, targetDomain));
    }, [applyScope, targetUrl, targetDomain, rules, initialRule]);

    // Re-targets the editor at the rule that would win, so the user can edit
    // that one instead. Every match type is representable in the editor now
    // (R-02), so this can always act; it used to be a button that did nothing
    // in every case (L-08).
    const switchToConflictRule = () => {
        if (!conflictRule) return;

        selectScope(conflictRule.matchType);
        if (PATTERN_SCOPES.includes(conflictRule.matchType)) {
            setPatternDraft(conflictRule.matcher);
            setPatternDraftFor(conflictRule.matchType);
        }
        if (mode === 'options') setManualUrl(conflictRule.matcher);

        const label = SCOPES.find(s => s.type === conflictRule.matchType)?.label || conflictRule.matchType;
        setStatusMessage({ type: 'success', text: `Now editing the ${label} rule for this page.` });
        setTimeout(() => setStatusMessage(null), 2500);
    };

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative">
            {/* Header - Only show in Popup mode */}
            {mode === 'popup' && (
                <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="icons/logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-contain" />
                        <h1 className="text-lg font-bold text-slate-800">Favicon Changer Ultimate</h1>
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

            <main className="flex-1 p-4 overflow-y-auto relative">
                <div className="space-y-5">
                    {/* Status Message - Sticky */}
                    {statusMessage && (
                        <div className={`sticky top-0 z-20 p-3 rounded-lg text-xs font-medium flex items-center gap-2 shadow-md mb-2 ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <span>{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Conflict Warning */}
                    {conflictRule && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2 flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <div>
                                    <p className="text-xs font-bold text-orange-800">Another rule wins here</p>
                                    <p className="text-[10px] text-orange-700 leading-tight mt-1">
                                        You are editing a <strong>{activeScope?.label || applyScope}</strong> rule, but a more specific <strong>{SCOPES.find(s => s.type === conflictRule.matchType)?.label || conflictRule.matchType}</strong> rule already matches this page (<span className="font-mono break-all">{conflictRule.matcher}</span>). Your change will be saved, but that rule takes precedence.
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={switchToConflictRule} className="w-full text-[10px] h-7 bg-white border-orange-200 text-orange-700 hover:bg-orange-100">
                                Edit that rule instead
                            </Button>
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

                        {/* Scope selector. A 2x2 grid rather than one row so the
                            labels stay readable in the 400px popup. */}
                        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                            {SCOPES.map(scope => (
                                <button
                                    key={scope.type}
                                    onClick={() => selectScope(scope.type)}
                                    title={scope.hint}
                                    aria-pressed={applyScope === scope.type}
                                    className={`py-1.5 px-1 text-xs font-medium rounded-md transition-all ${applyScope === scope.type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {scope.label}
                                </button>
                            ))}
                        </div>

                        {activeScope && (
                            <p className="text-[10px] text-slate-400 leading-snug mt-2 px-1">{activeScope.hint}</p>
                        )}

                        {/* Pattern editor, for the scopes whose matcher is not
                            taken from the target page. */}
                        {PATTERN_SCOPES.includes(applyScope) && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label htmlFor="fc-pattern" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                        {applyScope === 'prefix' ? 'URL starts with' : 'Regular expression'}
                                    </label>
                                    {targetUrl && (
                                        <button
                                            onClick={() => {
                                                setPatternDraft(suggestionFor(applyScope, targetUrl));
                                                setPatternDraftFor(applyScope);
                                            }}
                                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                                        >
                                            Suggest from this page
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="fc-pattern"
                                    type="text"
                                    value={patternDraft}
                                    onChange={(e) => { setPatternDraft(e.target.value); setPatternDraftFor(applyScope); }}
                                    spellCheck={false}
                                    placeholder={applyScope === 'prefix' ? 'https://example.com/docs' : '^https://example\\.com/docs'}
                                    className={`w-full border rounded-md px-3 py-2 text-xs font-mono outline-none focus:ring-2 ${patternError ? 'border-red-300 focus:ring-red-400' : 'border-slate-300 focus:ring-indigo-500'}`}
                                />

                                {patternError ? (
                                    <p className="text-[10px] text-red-600 leading-snug">{patternError}</p>
                                ) : patternPreview ? (
                                    <div className="text-[10px] leading-snug">
                                        <p className={patternPreview.coversTarget || mode === 'options' ? 'text-slate-500' : 'text-amber-700'}>
                                            {mode === 'popup' && (patternPreview.coversTarget
                                                ? 'Matches this page. '
                                                : 'Does not match this page. ')}
                                            {patternPreview.total > 0
                                                ? `Matches ${patternPreview.matched.length} of your ${patternPreview.total} open tab${patternPreview.total === 1 ? '' : 's'}.`
                                                : 'No open tabs to check against.'}
                                        </p>
                                        {patternPreview.matched.length > 0 && (
                                            <ul className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                                                {patternPreview.matched.slice(0, 4).map((tab, i) => (
                                                    <li key={`${tab.url}-${i}`} className="text-slate-400 truncate" title={tab.url}>
                                                        {tab.title || tab.hostname}
                                                    </li>
                                                ))}
                                                {patternPreview.matched.length > 4 && (
                                                    <li className="text-slate-400">and {patternPreview.matched.length - 4} more</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400">
                                        {applyScope === 'prefix'
                                            ? 'Every address beginning with this text will use your icon.'
                                            : 'Tested against the whole URL. Add ^ to anchor it to the start.'}
                                    </p>
                                )}
                            </div>
                        )}
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
                            initialValues={initialRule?.metadata}
                            onSave={handleSave}
                            isLoading={isSaving}
                            onError={(msg) => setStatusMessage({ type: 'error', text: msg })}
                            onSuccess={(msg) => msg ? setStatusMessage({ type: 'success', text: msg }) : setStatusMessage(null)}
                            onRequestExpand={mode === 'popup' && context === 'action' && popupDropsFileDialog ? requestExpandedUpload : undefined}
                        />

                        <EmojiSection
                            isOpen={openSection === 'emoji'}
                            onToggle={() => toggleSection('emoji')}
                            initialValues={initialRule?.metadata}
                            onSave={handleSave}
                        />

                        <BadgeSection
                            isOpen={openSection === 'badge'}
                            onToggle={() => toggleSection('badge')}
                            sourceIconUrl={activeRule?.originalUrl || currentTab.favIconUrl}
                            initialValues={initialRule?.metadata}
                            onSave={handleSave}
                            isLoading={isSaving}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
