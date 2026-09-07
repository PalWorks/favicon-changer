import { FaviconRule, GlobalSettings, MatchType } from '../types';
import { findBestRule, patternMatches } from './matcher';

/**
 * What happened to a page's favicon, and how to say it.
 *
 * Everything here is pure and free of `chrome.*` and DOM, because two contexts
 * need it: the content script decides what to do and reports what it did, and
 * the editor turns that report into the line the user reads.
 *
 * The reason this module exists is that "Favicon updated successfully!" used to
 * be printed on the strength of `chrome.storage.local.set` resolving. The rule
 * was saved; whether any tab's icon changed was never checked and could not be,
 * because `notifyTabs()` is fire and forget and `sendMessageToTab` discarded
 * the content script's reply. Four cases ended with a green tick and no visible
 * change: an excluded domain (which no reload will ever fix), a tab with no
 * live content script, a pasted image address that does not load, and a rule
 * shadowed by a more specific one. See docs/DECISIONS.md ADR-019.
 *
 * `decideApply` lives here rather than inline in `content.ts` so that the
 * action taken and the status reported come from one decision. Two copies of
 * this branching, one to act and one to describe, is exactly the shape of bug
 * this change exists to remove.
 */

// --- What the page did ------------------------------------------------------

export type ApplyStatus =
    /** A rule matched and its icon was written. */
    | 'applied'
    /** No rule matched, so the global fallback icon was written. */
    | 'fallback'
    /** The domain is on the exclusion list, so the page was left alone. */
    | 'excluded'
    /** Nothing matched and there is no fallback, so nothing was written. */
    | 'none'
    /** `chrome.storage` was not reachable from the page. */
    | 'unavailable';

export interface ApplyReport {
    status: ApplyStatus;
    /** The rule that won, when one did. */
    ruleId?: string;
    /** Whether the DOM write actually happened. Absent when nothing was written. */
    painted?: boolean;
}

// A Record keyed by the union rather than a list of strings, so a new status
// cannot be added to ApplyStatus without the type check demanding it here too.
// A parallel array would have drifted silently, and the failure would have been
// a real report read as no answer.
const APPLY_STATUSES: Record<ApplyStatus, true> = {
    applied: true,
    fallback: true,
    excluded: true,
    none: true,
    unavailable: true,
};

/**
 * Whether a reply from a tab is a report at all.
 *
 * Load-bearing across an extension update. A tab that was open before the
 * update still runs the previous `content.js`, which answers `RulesUpdated`
 * with `{ok: true}`. That is not a report, and it cannot say whether the rule
 * was excluded or shadowed, so it is treated as no answer: the user is told to
 * reload rather than told something we did not verify. Documented as L-36.
 */
export const isApplyReport = (value: unknown): value is ApplyReport => {
    if (!value || typeof value !== 'object') return false;
    const status = (value as { status?: unknown }).status;
    if (typeof status !== 'string') return false;
    // `=== true`, not `in`: `in` would accept "toString" and every other
    // inherited name, and the reply is untrusted input from a page.
    return APPLY_STATUSES[status as ApplyStatus] === true;
};

// --- What the page should do ------------------------------------------------

export type ApplyDecision =
    | { kind: 'excluded' }
    | { kind: 'rule'; rule: FaviconRule }
    | { kind: 'fallback'; url: string }
    | { kind: 'none' };

/**
 * The one decision the content script acts on.
 *
 * Order matters and is an invariant, not a preference: the exclusion check runs
 * before anything else so an excluded domain is never read from or written to
 * (docs/DOMAIN.md invariant 1). The caller is responsible for the DOM work,
 * including capturing the page's own icon *after* this returns anything other
 * than `excluded`.
 */
export const decideApply = (
    currentUrl: string,
    currentDomain: string,
    rules: FaviconRule[],
    settings: GlobalSettings,
): ApplyDecision => {
    // Optional chaining because storage can hold a settings object written
    // before `excludedDomains` existed.
    if (settings.excludedDomains?.includes(currentDomain)) return { kind: 'excluded' };

    const rule = findBestRule(currentUrl, currentDomain, rules);
    if (rule) return { kind: 'rule', rule };

    if (settings.defaultFaviconUrl) return { kind: 'fallback', url: settings.defaultFaviconUrl };

    return { kind: 'none' };
};

// --- Which tab to ask -------------------------------------------------------

export interface TabCandidate {
    id: number;
    url: string;
    hostname: string;
    active: boolean;
    discarded: boolean;
}

/**
 * The open tab a just-saved rule should be checked against.
 *
 * Prefers an active tab, because that is the one the user is looking at and the
 * one `notifyTabs()` injects into. Discarded tabs are skipped: they hold no
 * content script, they cannot answer, and they re-run the whole apply path when
 * the user next activates them, so there is nothing to confirm and nothing to
 * warn about.
 *
 * Callers pass candidates that are already parseable and not restricted URLs;
 * this function is about matching, not about what a tab is.
 */
export const pickTargetTab = (
    candidates: TabCandidate[],
    matchType: MatchType,
    matcher: string,
): TabCandidate | null => {
    const matching = candidates.filter(tab =>
        !tab.discarded && patternMatches(matchType, matcher, tab.url, tab.hostname));

    return matching.find(tab => tab.active) || matching[0] || null;
};

// --- What to tell the user --------------------------------------------------

export type SaveOutcomeKind =
    /** The page confirmed it applied this rule. */
    | 'confirmed'
    /** No open tab matches the rule, so there was nothing to check. */
    | 'not-open'
    /** A tab was asked and did not answer with a report. */
    | 'unconfirmed'
    /** The rule is saved and the page will never apply it: the site is excluded. */
    | 'excluded'
    /** Another rule wins on that page. */
    | 'shadowed'
    /** The page says nothing matches it, though we expected this rule to. */
    | 'unmatched'
    /** The page is showing the global fallback rather than this rule. */
    | 'fallback'
    /** The rule applied but the page could not be written to. */
    | 'not-painted'
    /** The icon address itself does not load. */
    | 'icon-failed';

export interface SaveOutcome {
    kind: SaveOutcomeKind;
    /** `success` only when the page confirmed it. Everything else is amber. */
    tone: 'success' | 'warning';
    text: string;
    /** Present when the message can be acted on in one click. */
    fix?: { kind: 'unexclude'; domain: string };
}

export interface SaveVerification {
    savedRuleId: string;
    /** Hostname of the page that was checked, for the message. May be empty. */
    targetLabel: string;
    /** False when no open tab matched, so no report was possible. */
    checkedTab: boolean;
    /** The page's own account of what it did. Null when it did not answer. */
    report: ApplyReport | null;
    /** Whether a remote icon address resolved. Undefined when not checked. */
    iconLoaded?: boolean;
}

/**
 * Turns a verification into the one line the user reads.
 *
 * Checked in priority order, most actionable first. A broken icon address comes
 * before everything else because no reload fixes it, and an excluded domain
 * comes before the reload advice for the same reason: telling someone to reload
 * a page that will never change is worse than saying nothing.
 *
 * `tone` is `success` only for a page that confirmed it applied this exact
 * rule. Everything else is a warning, including the ordinary and blameless
 * "you have no matching tab open" case, because the user pressed a button that
 * used to promise a visible change and they should be told they will not see
 * one yet.
 */
export const describeSaveOutcome = (v: SaveVerification): SaveOutcome => {
    const where = v.targetLabel || 'that page';

    if (v.iconLoaded === false) {
        return {
            kind: 'icon-failed',
            tone: 'warning',
            text: 'Rule saved, but that image address did not load. Pages will show the browser\'s '
                + 'default icon until the address works.',
        };
    }

    if (!v.checkedTab) {
        return {
            kind: 'not-open',
            tone: 'warning',
            text: 'Rule saved. It will apply the next time you open a matching page.',
        };
    }

    // Named once and used twice: no answer at all, and an answer that says the
    // page could not read storage, leave the user in exactly the same position.
    const unconfirmed: SaveOutcome = {
        kind: 'unconfirmed',
        tone: 'warning',
        text: `Rule saved, but ${where} did not confirm the change. Reload it to see the new icon.`,
    };

    if (!v.report) return unconfirmed;

    // No `default`, deliberately. Every ApplyStatus is listed, so adding one
    // fails the type check here instead of quietly falling through to a message
    // that says nothing.
    switch (v.report.status) {
        case 'unavailable':
            return unconfirmed;

        case 'excluded':
            return {
                kind: 'excluded',
                tone: 'warning',
                text: `Rule saved, but ${where} is on your excluded list, so its icon will not change.`,
                ...(v.targetLabel ? { fix: { kind: 'unexclude' as const, domain: v.targetLabel } } : {}),
            };

        case 'none':
            return {
                kind: 'unmatched',
                tone: 'warning',
                text: `Rule saved, but ${where} reports that no rule matches it. Check the pattern.`,
            };

        case 'fallback':
            return {
                kind: 'fallback',
                tone: 'warning',
                text: `Rule saved, but ${where} is showing your fallback icon instead. Check the pattern.`,
            };

        case 'applied':
            if (v.report.ruleId !== v.savedRuleId) {
                return {
                    kind: 'shadowed',
                    tone: 'warning',
                    text: `Rule saved, but a more specific rule wins on ${where}, so the icon there did not change.`,
                };
            }
            if (v.report.painted === false) {
                return {
                    kind: 'not-painted',
                    tone: 'warning',
                    text: `Rule saved, but ${where} could not be written to. Reload it to see the new icon.`,
                };
            }
            return { kind: 'confirmed', tone: 'success', text: 'Favicon updated successfully!' };
    }
};
