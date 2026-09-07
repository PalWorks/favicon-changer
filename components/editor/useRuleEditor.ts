import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
    OpenTab,
    consumePendingEditorTarget,
    deleteRule,
    findTabForRule,
    generateId,
    getCurrentTabInfo,
    getOpenTabs,
    getStorageData,
    isAllowedFileSchemeAccess,
    importRulesFromJson,
    openExpandedEditor,
    requestApplyReport,
    saveRule,
    saveSettings,
} from '../../utils/storage';
import { SaveOutcome, SaveVerification, describeSaveOutcome } from '../../utils/applyReport';
import { probeIconUrl } from '../../utils/iconProbe';
import { logger } from '../../utils/logger';
import { findConflictingRule, patternMatches } from '../../utils/matcher';
import { popupClosesOnFileDialog } from '../../utils/platform';
import { LATE_APPLY_REPORT_TIMEOUT_MS } from '../../constants';
import { hostnameFromInput } from '../../utils/patterns';
import { describeImport } from '../../utils/importRules';
import {
    INITIAL_SCOPE_STATE,
    isPatternOverridden,
    isPatternScope,
    loadRuleEvent,
    matcherFor,
    patternErrorFor,
    patternValue,
    scopeLabel,
    scopeReducer,
} from '../../utils/ruleScope';
import { FaviconRule, MatchType, TabInfo } from '../../types';

/**
 * Everything the favicon editor does that is not drawing.
 *
 * Extracted per ROADMAP R-15. The component it came out of was 771 lines of
 * state, effects and JSX in one scope, which is where every editor defect this
 * project has shipped was born: the rule for when a value gets recomputed was
 * spread across handlers, effects and inline callbacks, so two of them could
 * disagree and nothing said which was right.
 *
 * The scope and pattern half of that, which is the half that kept breaking, now
 * lives in [utils/ruleScope.ts](../../utils/ruleScope.ts) as a pure reducer with
 * its own tests. What is left here is genuine plumbing: chrome.* calls, the
 * mode/context lifecycle, and the save path.
 *
 * `mode` x `context` still decides which effects may fire, and that has to stay
 * explicit. See docs/DECISIONS.md ADR-010 for why the popup and the settings
 * page share one editor at all, and ADR-016 for the derivation model.
 */

export interface UseRuleEditorArgs {
    mode: 'popup' | 'options';
    context: 'action' | 'expanded';
    initialRule?: FaviconRule | null;
    onRuleSaved?: () => void;
}

export type EditorSection = 'upload' | 'emoji' | 'badge';

export interface StatusMessage {
    // 'warning' is for a save that landed in storage without producing the
    // visible change the user was expecting. It is not an error, and calling it
    // one would be as wrong as the green tick this replaced.
    type: 'success' | 'warning' | 'error';
    text: string;
    /** Offered when the message names something the user can fix in one click. */
    action?: { label: string; run: () => void };
}

export interface PatternPreview {
    matched: OpenTab[];
    total: number;
    coversTarget: boolean;
}

export const useRuleEditor = ({ mode, context, initialRule, onRuleSaved }: UseRuleEditorArgs) => {
    const [currentTab, setCurrentTab] = useState<TabInfo>({ url: '', domain: '', favIconUrl: '' });
    const [rules, setRules] = useState<FaviconRule[]>([]);
    const [openSection, setOpenSection] = useState<EditorSection | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [manualUrl, setManualUrl] = useState('');
    const [scopeState, dispatchScope] = useReducer(scopeReducer, INITIAL_SCOPE_STATE);
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [fileAccess, setFileAccess] = useState(true);
    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
    // Whether this OS kills the action popup when a file dialog opens, so the
    // upload has to be handed to a standalone window (ADR-007). Resolved from
    // the same helper the service worker uses, so the button label cannot
    // describe behaviour the service worker did not configure.
    const [popupDropsFileDialog, setPopupDropsFileDialog] = useState(false);
    const [conflictRule, setConflictRule] = useState<FaviconRule | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const applyScope = scopeState.scope;

    const refreshData = async () => {
        try {
            // Action popup: re-query the active tab (idempotent). Expanded window:
            // the target is loaded once by the handoff effect and must not be
            // overwritten here, because getCurrentTabInfo() in a window returns
            // the window's own (empty) tab and would blank the target after a save.
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
                // A matcher in the handoff is the text the popup was showing, so
                // it carries over as the user's. Without one, the scope alone
                // carries over and the pattern is derived from the target below.
                if (target.matcher && isPatternScope(target.scope)) {
                    dispatchScope(loadRuleEvent({ matchType: target.scope, matcher: target.matcher }));
                } else {
                    dispatchScope({ type: 'selectScope', scope: target.scope });
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

    // Settings page: follow the rules list's selection, and reset when it is
    // cleared. A saved rule's matcher becomes the user's pattern text, so
    // nothing re-derives it (which used to turn "edit this rule" into "edit a
    // wider rule under a new id").
    useEffect(() => {
        if (mode !== 'options') return;

        if (initialRule) {
            logger.debug('Loading initial rule', initialRule);
            setManualUrl(initialRule.matcher);
            dispatchScope(loadRuleEvent(initialRule));

            // Auto-expand the section that produced this rule's icon.
            if (initialRule.sourceType === 'emoji') {
                setOpenSection('emoji');
            } else if (initialRule.sourceType === 'custom') {
                setOpenSection('badge');
            } else if (initialRule.sourceType === 'upload' || initialRule.sourceType === 'url') {
                setOpenSection('upload');
            }

            setCurrentTab({
                url: initialRule.matcher,
                domain: hostnameFromInput(initialRule.matcher) || initialRule.matcher,
                favIconUrl: initialRule.faviconUrl,
            });
        } else {
            logger.debug('Resetting editor for new rule');
            setManualUrl('');
            dispatchScope({ type: 'reset' });
            setOpenSection(null);
            setCurrentTab({ url: '', domain: '', favIconUrl: '' });
        }
    }, [initialRule, mode]);

    // Settings page, new rule: derive the previewed site from what is typed.
    // The icon preview comes from Google's public favicon endpoint, which is a
    // deliberate and disclosed exception to "no network requests"; see ADR-011
    // and the Network Requests section of PRIVACY_POLICY.md.
    useEffect(() => {
        if (mode !== 'options' || initialRule) return;

        const domain = hostnameFromInput(manualUrl);
        if (manualUrl && domain) {
            setCurrentTab({
                url: manualUrl,
                domain,
                favIconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
            });
        } else {
            setCurrentTab({ url: manualUrl, domain: '', favIconUrl: '' });
        }
    }, [manualUrl, mode, initialRule]);

    // --- Target and matcher derivation ---------------------------------------
    const targetUrl = mode === 'popup' ? currentTab.url : manualUrl;
    const targetDomain = mode === 'popup' ? currentTab.domain : hostnameFromInput(manualUrl);

    const pattern = patternValue(scopeState, targetUrl);
    const patternOverridden = isPatternOverridden(scopeState);
    const currentMatcher = matcherFor(scopeState, targetUrl, targetDomain);
    const patternError = patternErrorFor(scopeState, targetUrl);

    // Which of the user's open tabs this pattern would cover. Shown live, so a
    // pattern can be sanity-checked before it is saved rather than after.
    const patternPreview = useMemo<PatternPreview | null>(() => {
        if (!isPatternScope(applyScope) || !currentMatcher || patternError) return null;
        return {
            matched: openTabs.filter(tab => patternMatches(applyScope, currentMatcher, tab.url, tab.hostname)),
            total: openTabs.length,
            coversTarget: !!targetUrl && patternMatches(applyScope, currentMatcher, targetUrl, targetDomain),
        };
    }, [applyScope, currentMatcher, patternError, openTabs, targetUrl, targetDomain]);

    const activeRule = rules.find(r => r.matcher === currentMatcher && r.matchType === applyScope);
    const hasValidTarget = mode === 'popup' ? !!currentTab.url : !!manualUrl;

    // Any rule in a strictly higher precedence tier that also matches this page
    // will win, so the edit would have no visible effect and the user should be
    // told before they save.
    useEffect(() => {
        if (!targetUrl || !currentMatcher) {
            setConflictRule(null);
            return;
        }
        // A rule being edited cannot shadow itself. findConflictingRule also
        // skips any rule with the same type and matcher, which covers the case
        // where the save will overwrite it.
        const others = initialRule ? rules.filter(r => r.id !== initialRule.id) : rules;
        setConflictRule(findConflictingRule(
            { matchType: applyScope, matcher: currentMatcher },
            targetUrl,
            targetDomain,
            others,
        ));
    }, [applyScope, currentMatcher, targetUrl, targetDomain, rules, initialRule]);

    // --- Actions -------------------------------------------------------------

    const selectScope = (scope: MatchType) => dispatchScope({ type: 'selectScope', scope });
    const editPattern = (text: string) => dispatchScope({ type: 'editPattern', text });
    const useSuggestedPattern = () => dispatchScope({ type: 'useSuggestion' });

    // One timer, replaced rather than stacked: two saves in quick succession
    // used to leave the first timeout running, which cleared the second
    // message early. Also cleared on unmount, since the action popup is
    // destroyed the moment it loses focus.
    const statusTimer = useRef<number | null>(null);

    const flashStatus = (message: StatusMessage, ms: number) => {
        setStatusMessage(message);
        if (statusTimer.current !== null) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
        }
        // ms <= 0 means leave it up. Anything the user has to read and act on,
        // or a button they have to press, must not time out from under them.
        if (ms <= 0) return;
        statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatusMessage(null);
        }, ms);
    };

    useEffect(() => () => {
        if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    }, []);

    // --- Did the save actually change anything? ------------------------------
    //
    // "Favicon updated successfully!" used to be printed as soon as
    // chrome.storage.local.set resolved, which proved only that the rule was
    // stored. Four cases ended with a green tick and no visible change: an
    // excluded site, a tab with no live content script, an image address that
    // does not load, and a rule shadowed by a more specific one. The content
    // script already replied to RulesUpdated and the reply was discarded. Now
    // it carries what the page did, and this is where it is read.
    // See docs/DECISIONS.md ADR-019 and ROADMAP R-61.

    // The rule the last save wrote, so a fix offered in the status line can
    // re-check that same rule instead of guessing at one.
    const lastSave = useRef<FaviconRule | null>(null);

    const verifySave = async (rule: FaviconRule): Promise<SaveVerification> => {
        // Both are independent of each other, and the icon probe is a network
        // round trip, so they overlap rather than queue.
        const [iconLoaded, tab] = await Promise.all([
            probeIconUrl(rule.faviconUrl),
            findTabForRule(rule.matchType, rule.matcher),
        ]);

        if (!tab) {
            return {
                savedRuleId: rule.id,
                targetLabel: targetDomain || '',
                checkedTab: false,
                report: null,
                iconLoaded,
            };
        }

        return {
            savedRuleId: rule.id,
            targetLabel: tab.hostname,
            checkedTab: true,
            tabId: tab.id,
            report: await requestApplyReport(tab.id),
            iconLoaded,
        };
    };

    const showOutcome = (outcome: SaveOutcome) => {
        const message: StatusMessage = { type: outcome.tone, text: outcome.text };

        if (outcome.fix?.kind === 'unexclude') {
            const domain = outcome.fix.domain;
            message.action = { label: 'Remove from excluded', run: () => { void removeExclusion(domain); } };
        }

        // A confirmation can time out. A warning cannot: it is the only place
        // the user is told the thing they asked for has not happened yet, and
        // some of them carry a button.
        flashStatus(message, outcome.tone === 'success' ? 2000 : 0);
    };

    /** The one-click fix offered when a saved rule's site turns out to be excluded. */
    const removeExclusion = async (domain: string) => {
        try {
            const { settings } = await getStorageData();
            const remaining = (settings.excludedDomains || []).filter(d => d !== domain);
            await saveSettings({ ...settings, excludedDomains: remaining });
            logger.info('Removed exclusion offered by the save warning', { domain });

            // Check again rather than declaring victory. The rule may also be
            // shadowed, and one more surprise after a fix is worse than none.
            const rule = lastSave.current;
            if (rule) {
                showOutcome(describeSaveOutcome(await verifySave(rule)));
            } else {
                flashStatus({ type: 'success', text: `${domain} is no longer excluded.` }, 2000);
            }
        } catch (e) {
            logger.error('Failed to remove the exclusion', e);
            setStatusMessage({ type: 'error', text: 'Could not update the excluded list.' });
        }
    };

    // Only the newest verification may write to the status line. Without this,
    // the late follow-up below could overwrite the result of a save the user
    // made after it.
    const verifyRun = useRef(0);

    const verifyAndReport = async (rule: FaviconRule) => {
        const run = ++verifyRun.current;
        lastSave.current = rule;
        try {
            const verification = await verifySave(rule);
            if (verifyRun.current !== run) return;
            showOutcome(describeSaveOutcome(verification));

            // A page whose main thread is busy cannot run its message handler
            // inside the budget, so it reads as unconfirmed even though it will
            // apply the rule as soon as it is free. Measured: a page blocked for
            // 3s reports "did not confirm" and then updates anyway. So ask once
            // more with a longer budget, without making the user wait for it,
            // and replace the message if the answer arrives. ROADMAP R-66.
            if (verification.checkedTab && !verification.report && verification.tabId !== undefined) {
                const late = await requestApplyReport(verification.tabId, {
                    timeoutMs: LATE_APPLY_REPORT_TIMEOUT_MS,
                });
                if (late && verifyRun.current === run) {
                    showOutcome(describeSaveOutcome({ ...verification, report: late }));
                }
            }
        } catch (e) {
            // The rule is saved whatever happened here, so this must never be
            // reported as a failed save. Fall back to the honest answer.
            logger.error('Could not verify the save', e);
            if (verifyRun.current !== run) return;
            showOutcome(describeSaveOutcome({
                savedRuleId: rule.id,
                targetLabel: '',
                checkedTab: true,
                report: null,
            }));
        }
    };

    /**
     * Re-targets the editor at the rule that would win, so the user can edit
     * that one instead. Every match type is representable in the editor now
     * (R-02), so this can always act; it used to be a button that did nothing
     * in every case (L-08).
     */
    const switchToConflictRule = () => {
        if (!conflictRule) return;
        dispatchScope(loadRuleEvent(conflictRule));
        if (mode === 'options') setManualUrl(conflictRule.matcher);
        flashStatus({ type: 'success', text: `Now editing the ${scopeLabel(conflictRule.matchType)} rule for this page.` }, 2500);
    };

    // Action popup can't host a native file dialog without closing itself, so
    // the "Browse" action hands the current target off to a standalone window.
    const requestExpandedUpload = async () => {
        try {
            await openExpandedEditor({
                url: currentTab.url,
                domain: currentTab.domain,
                favIconUrl: currentTab.favIconUrl,
                scope: applyScope,
                matcher: pattern,
                section: 'upload',
            });
        } catch (e) {
            logger.error('Failed to open upload window', e);
            setStatusMessage({ type: 'error', text: 'Could not open the upload window.' });
        }
    };

    const handleSave = async (
        url: string,
        sourceType: FaviconRule['sourceType'],
        metadata?: FaviconRule['metadata'],
    ) => {
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
                // Each scope fails for its own reason, and a message naming the
                // wrong one is worse than none. R-64 added the exact_url case,
                // which used to save the raw text and match nothing.
                const message = matchType === 'domain'
                    ? 'Could not read a domain from that address.'
                    : matchType === 'exact_url'
                        ? 'Enter a full page address, for example https://example.com/page.'
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
                updatedAt: Date.now(),
            };

            logger.info('Saving rule', newRule);
            await saveRule(newRule);
            await refreshData();
            if (onRuleSaved) onRuleSaved();

            await verifyAndReport(newRule);
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
            // Derive the extension from the real content type. Many sites (e.g.
            // GitHub) serve an SVG favicon, and saving it as .png produced a
            // file whose bytes did not match its name, which then failed to
            // decode on re-upload.
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
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `favicon-${currentTab.domain}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            logger.error('Failed to download original favicon', e);
            window.open(currentTab.favIconUrl, '_blank');
        }
    };

    const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
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

    const toggleSection = (section: EditorSection) =>
        setOpenSection(prev => (prev === section ? null : section));

    return {
        // State the view draws
        currentTab,
        openSection,
        isSaving,
        manualUrl,
        fileAccess,
        statusMessage,
        popupDropsFileDialog,
        conflictRule,
        importInputRef,

        // Scope and pattern
        applyScope,
        scopeLabel: scopeLabel(applyScope),
        pattern,
        patternOverridden,
        patternError,
        patternPreview,

        // Derived target
        targetUrl,
        activeRule,
        hasValidTarget,

        // Actions
        setManualUrl,
        setStatusMessage,
        selectScope,
        editPattern,
        useSuggestedPattern,
        switchToConflictRule,
        requestExpandedUpload,
        handleSave,
        handleDelete,
        handleDownloadOriginal,
        handleImport,
        toggleSection,
    };
};
