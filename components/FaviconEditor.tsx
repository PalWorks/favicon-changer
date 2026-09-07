import React from 'react';
import { exportRulesAsJson, openOptionsPage } from '../utils/storage';
import { isPatternScope } from '../utils/ruleScope';

import { FaviconRule } from '../types';
import { Button } from './Button';
import { FaviconPreview } from './FaviconPreview';
import { UploadSection } from './editor/UploadSection';
import { EmojiSection } from './editor/EmojiSection';
import { BadgeSection } from './editor/BadgeSection';
import { ConflictBanner } from './editor/ConflictBanner';
import { EditorHeader } from './editor/EditorHeader';
import { PatternField } from './editor/PatternField';
import { ScopeSelector } from './editor/ScopeSelector';
import { useRuleEditor } from './editor/useRuleEditor';

/**
 * The rule editor, shared by the toolbar popup and the settings page (ADR-010).
 *
 * This file draws; it decides nothing. The behaviour lives in
 * [editor/useRuleEditor.ts](editor/useRuleEditor.ts), and the scope and pattern
 * rules in [utils/ruleScope.ts](../utils/ruleScope.ts) where they are unit
 * tested. See ROADMAP R-15 for why they were separated: with logic and markup
 * in one 771-line scope, the rule about when a value is recomputed could be
 * stated in four places and agreed on in none, which is how R-42 shipped.
 *
 * `mode` decides the surface. In `options` the URL field is the target, so the
 * scope control sits above it, since it decides how that text will be read. In
 * the popup the target is the current tab and the site line is the header's
 * subtitle, so the control follows it rather than splitting a heading from its
 * subtitle.
 */
interface FaviconEditorProps {
    mode: 'popup' | 'options';
    // 'action'   = the toolbar popup bubble (closes on blur; can't host a file dialog)
    // 'expanded' = the standalone upload window opened by the action popup
    context?: 'action' | 'expanded';
    initialRule?: FaviconRule | null;
    onRuleSaved?: () => void;
}

// Status banner styling, keyed by tone. An SVG rather than an emoji, so the
// glyph is the same on every platform and a screen reader reads the message
// rather than the name of a picture (the icon is aria-hidden; the text carries
// the meaning). Amber is the tone this file gained with R-61: a save that
// landed in storage without producing a visible change is neither a success
// nor an error.
const STATUS_TONE: Record<'success' | 'warning' | 'error', string> = {
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_ICON: Record<'success' | 'warning' | 'error', string> = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01M5.072 19h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export const FaviconEditor: React.FC<FaviconEditorProps> = ({
    mode, context = 'action', initialRule, onRuleSaved,
}) => {
    const editor = useRuleEditor({ mode, context, initialRule, onRuleSaved });
    const {
        currentTab, openSection, isSaving, manualUrl, fileAccess, statusMessage,
        popupDropsFileDialog, conflictRule, importInputRef,
        applyScope, scopeLabel, pattern, patternOverridden, patternError, patternPreview,
        targetUrl, activeRule, hasValidTarget,
    } = editor;

    const scopeSelector = <ScopeSelector value={applyScope} onSelect={editor.selectScope} />;

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative">
            {mode === 'popup' && (
                <EditorHeader
                    importInputRef={importInputRef}
                    onImportFile={editor.handleImport}
                    onExport={exportRulesAsJson}
                    onOpenSettings={openOptionsPage}
                />
            )}

            <main className="flex-1 p-4 overflow-y-auto relative">
                <div className="space-y-5">
                    {/* Announced as well as shown: a save result that only exists
                        visually is invisible to a screen reader. Assertive for
                        errors, polite for confirmations. */}
                    {statusMessage && (
                        <div
                            role="status"
                            aria-live={statusMessage.type === 'success' ? 'polite' : 'assertive'}
                            className={`sticky top-0 z-20 p-3 rounded-lg text-xs font-medium flex items-start gap-2 shadow-md mb-2 border ${STATUS_TONE[statusMessage.type]}`}
                        >
                            <svg className="w-4 h-4 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={STATUS_ICON[statusMessage.type]} />
                            </svg>
                            <div className="min-w-0 flex-1">
                                <span>{statusMessage.text}</span>
                                {statusMessage.action && (
                                    <button
                                        onClick={statusMessage.action.run}
                                        className="block mt-2 px-2 py-1 bg-white border border-current rounded text-[10px] font-bold uppercase tracking-wide hover:opacity-80"
                                    >
                                        {statusMessage.action.label}
                                    </button>
                                )}
                            </div>
                            {/* A confirmation clears itself after two seconds; a
                                warning stays, because it is the only place the
                                user is told the change is not visible yet and
                                some of them carry a button. On the settings
                                page, which is long-lived, that needs a way out
                                other than saving something else. */}
                            <button
                                onClick={() => editor.setStatusMessage(null)}
                                aria-label="Dismiss this message"
                                className="shrink-0 -mr-1 -mt-1 rounded p-1 opacity-60 hover:opacity-100"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {conflictRule && (
                        <ConflictBanner
                            conflictRule={conflictRule}
                            editingScopeLabel={scopeLabel}
                            onSwitch={editor.switchToConflictRule}
                        />
                    )}

                    {/* Target */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Page</h2>
                            <div className="flex items-center gap-2">
                                {activeRule && activeRule.enabled === false ? (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-bold uppercase tracking-wide" title="This rule exists but is paused in Settings">Paused</span>
                                ) : activeRule ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase tracking-wide">Active</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-bold uppercase tracking-wide">Inactive</span>
                                )}

                                <button
                                    onClick={() => activeRule && editor.handleDelete(activeRule.id)}
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

                        {mode === 'options' && scopeSelector}

                        {mode === 'options' ? (
                            <div className="mb-4">
                                <label htmlFor="fc-target-url" className="block text-xs font-medium text-slate-500 mb-1">Enter URL or Domain to Configure</label>
                                <input
                                    id="fc-target-url"
                                    type="text"
                                    value={manualUrl}
                                    onChange={(e) => editor.setManualUrl(e.target.value)}
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
                                    onClick={editor.handleDownloadOriginal}
                                    disabled={!currentTab.favIconUrl}
                                    title="Export Original Favicon" aria-label="Download this site's original favicon"
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {mode === 'popup' && scopeSelector}

                        {isPatternScope(applyScope) && (
                            <PatternField
                                scope={applyScope}
                                value={pattern}
                                onChange={editor.editPattern}
                                // Offered only when it would change something: with no
                                // override the field already holds the suggestion.
                                onSuggest={targetUrl && patternOverridden ? editor.useSuggestedPattern : undefined}
                                error={patternError}
                                preview={patternPreview}
                                mode={mode}
                            />
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
                            onToggle={() => editor.toggleSection('upload')}
                            initialValues={initialRule?.metadata}
                            onSave={editor.handleSave}
                            isLoading={isSaving}
                            onError={(msg) => editor.setStatusMessage({ type: 'error', text: msg })}
                            onSuccess={(msg) => msg ? editor.setStatusMessage({ type: 'success', text: msg }) : editor.setStatusMessage(null)}
                            onRequestExpand={mode === 'popup' && context === 'action' && popupDropsFileDialog ? editor.requestExpandedUpload : undefined}
                        />

                        <EmojiSection
                            isOpen={openSection === 'emoji'}
                            onToggle={() => editor.toggleSection('emoji')}
                            initialValues={initialRule?.metadata}
                            onSave={editor.handleSave}
                            isSaving={isSaving}
                        />

                        <BadgeSection
                            isOpen={openSection === 'badge'}
                            onToggle={() => editor.toggleSection('badge')}
                            sourceIconUrl={activeRule?.originalUrl || currentTab.favIconUrl}
                            initialValues={initialRule?.metadata}
                            onSave={editor.handleSave}
                            isLoading={isSaving}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
