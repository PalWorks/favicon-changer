import { FaviconRule, MatchType } from '../types';
import { hasExplicitScheme, looksLikeHostname, suggestPrefix, suggestRegex } from './patterns';
import { isValidRegex } from './validation';

/**
 * The editor's scope state machine: which match type is selected, what pattern
 * it will save, and whether that pattern is valid.
 *
 * This is the third extraction out of the editor, and the one with the worst
 * track record. Every defect the editor has shipped has been here: a regex rule
 * downgraded into a duplicate on edit (R-03), the first-match-per-tier
 * precedence surprise (R-04), and a prefix suggestion that never followed the
 * address field so a rule could be saved against the wrong site (R-42). All
 * three shared a cause, which is that the rule about what the pattern *is* was
 * spread across a `selectScope` handler, an effect, two JSX callbacks and a
 * handoff branch, and stated in one place nowhere.
 *
 * So it is stated here, once, with no React and no chrome.* in sight.
 *
 * The load-bearing idea is that **an unedited pattern is derived, not stored.**
 * The old code stored the suggestion in state and then needed synchronising
 * every time the address changed, which is precisely the synchronisation that
 * kept going wrong. Here, state holds only what the user typed; anything they
 * have not typed is computed from the current target on demand. A suggestion
 * cannot go stale if it is never saved, and nothing can clobber an override
 * because nothing writes to that slot but the user.
 *
 * See ROADMAP R-15 and R-42, and docs/DECISIONS.md ADR-016.
 */

// The scope control's copy. Order is deliberate: the original two come first so
// existing users' muscle memory still works, with the two pattern types after.
// `short` goes on the buttons, which sit in one row of four and have to fit the
// 400px popup; `label` is the readable form used in prose and as the accessible
// name. The hint carries the explanation so the buttons do not have to.
//
// This is also the largest single block of user-facing copy outside the
// components, which makes it the natural first thing to move behind a message
// catalogue when R-22 happens.
export interface ScopeOption {
    type: MatchType;
    label: string;
    short: string;
    hint: string;
}

export const SCOPES: ScopeOption[] = [
    { type: 'domain', label: 'Entire Domain', short: 'Domain', hint: 'Every page on this site, subdomains included.' },
    { type: 'exact_url', label: 'This Page Only', short: 'This Page', hint: 'Only this exact address, query string and all.' },
    { type: 'prefix', label: 'URL Starts With', short: 'Starts With', hint: 'Every address beginning with this text. Good for one document across its views.' },
    { type: 'regex', label: 'Regex', short: 'Regex', hint: 'A regular expression tested against the whole URL. Unanchored unless you add ^.' },
];

/** Scopes whose matcher is a pattern the user edits rather than the target page. */
export type PatternScope = 'prefix' | 'regex';

export const PATTERN_SCOPES: PatternScope[] = ['prefix', 'regex'];

export const isPatternScope = (scope: MatchType): scope is PatternScope =>
    (PATTERN_SCOPES as MatchType[]).includes(scope);

export const scopeLabel = (scope: MatchType): string =>
    SCOPES.find(s => s.type === scope)?.label || scope;

export const scopeHint = (scope: MatchType): string =>
    SCOPES.find(s => s.type === scope)?.hint || '';

// --- State ------------------------------------------------------------------

export interface ScopeState {
    scope: MatchType;
    /**
     * Pattern text the user typed, or that came from a saved rule, keyed by the
     * scope it belongs to.
     *
     * An absent key means "no override", i.e. follow the suggestion for the
     * current target. Keeping one slot per pattern scope is what makes
     * switching prefix to regex and back preserve the user's work: the old
     * single-slot draft was regenerated on every switch, which threw the text
     * away despite a comment promising it did not.
     */
    overrides: Partial<Record<PatternScope, string>>;
}

export const INITIAL_SCOPE_STATE: ScopeState = { scope: 'exact_url', overrides: {} };

export type ScopeEvent =
    /** A scope button was pressed. Overrides are deliberately left alone. */
    | { type: 'selectScope'; scope: MatchType }
    /** The user typed in the pattern field. */
    | { type: 'editPattern'; text: string }
    /** "Suggest from this page": drop the override and follow the target again. */
    | { type: 'useSuggestion' }
    /**
     * Point the editor at an existing rule, either because the rules list
     * selected it or because the user chose to edit the rule that outranks
     * theirs. A saved matcher is always an override: it is the user's text,
     * and re-deriving it would silently edit a different pattern than the one
     * they asked for (which is what "Edit that rule instead" used to do).
     */
    | { type: 'loadRule'; matchType: MatchType; matcher: string }
    /** Back to a blank new rule. */
    | { type: 'reset' };

export const scopeReducer = (state: ScopeState, event: ScopeEvent): ScopeState => {
    switch (event.type) {
        case 'selectScope':
            if (event.scope === state.scope) return state;
            return { ...state, scope: event.scope };

        case 'editPattern': {
            // Defensive: there is no pattern field to type in for the other two
            // scopes, so an edit arriving for them is a bug elsewhere, not a
            // state change to honour.
            if (!isPatternScope(state.scope)) return state;
            return { ...state, overrides: { ...state.overrides, [state.scope]: event.text } };
        }

        case 'useSuggestion': {
            if (!isPatternScope(state.scope)) return state;
            const overrides = { ...state.overrides };
            delete overrides[state.scope];
            return { ...state, overrides };
        }

        case 'loadRule':
            return {
                scope: event.matchType,
                // Any override for the other pattern scope belongs to the rule
                // we were editing before, not this one.
                overrides: isPatternScope(event.matchType) ? { [event.matchType]: event.matcher } : {},
            };

        case 'reset':
            return INITIAL_SCOPE_STATE;

        default:
            return state;
    }
};

/** The event that points the editor at a rule, so callers cannot get it wrong. */
export const loadRuleEvent = (rule: Pick<FaviconRule, 'matchType' | 'matcher'>): ScopeEvent =>
    ({ type: 'loadRule', matchType: rule.matchType, matcher: rule.matcher });

// --- Derivation -------------------------------------------------------------

/**
 * Adds a scheme to something the user typed without one.
 *
 * The settings page invites a bare domain ("google.com"), and both suggestion
 * helpers need a parseable URL. Without this, choosing "URL Starts With" after
 * typing a bare domain produced the domain back as the suggestion, which then
 * failed validation with a message about prefixes needing to start at the
 * beginning of the address: technically correct and useless. `https:` is the
 * same assumption hostnameFromInput() already makes for the domain scope.
 *
 * "Has a scheme" means `scheme://`, not `scheme:`. See hasExplicitScheme().
 */
const withScheme = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return hasExplicitScheme(trimmed) ? trimmed : `https://${trimmed}`;
};

/**
 * The exact address an `exact_url` rule should be saved with, or '' when the
 * text cannot be one.
 *
 * `exact_url` compares its matcher against `location.href` with `===`, so the
 * matcher has to be a real, canonical URL. On the settings page the target is
 * free text, and it was stored verbatim: typing "example.com" with This Page
 * Only saved the matcher `example.com`, which no `location.href` can ever
 * equal. The rule sat in the list matching nothing, and the save reported
 * success. Same story for "HTTPS://Example.com/Page", which no visit produces
 * either, since the browser lowercases the scheme and host. ROADMAP R-64.
 *
 * The hostname shape is checked for the same reason `hostnameFromInput` checks
 * it: Chrome percent-encodes illegal host characters instead of throwing, so
 * "not a url at all" would otherwise canonicalise into a tidy-looking matcher
 * that still matches nothing (R-49). `file:` is exempt because a file URL
 * legitimately has no host, and the extension supports file pages.
 *
 * In the popup this is a no-op: the target there is `tab.url`, already
 * canonical, so `new URL(x).href === x`.
 */
export const canonicalUrl = (value: string): string => {
    const withProtocol = withScheme(value);
    if (!withProtocol) return '';
    try {
        const url = new URL(withProtocol);
        if (url.protocol !== 'file:' && !looksLikeHostname(url.hostname)) return '';
        return url.href;
    } catch (e) {
        return '';
    }
};

/**
 * The pattern we would suggest for this scope and target, ignoring any
 * override. Empty for the scopes that have no pattern field.
 */
export const suggestionFor = (scope: MatchType, targetUrl: string): string => {
    const url = withScheme(targetUrl);
    if (!url) return '';
    if (scope === 'prefix') return suggestPrefix(url);
    if (scope === 'regex') return suggestRegex(url);
    return '';
};

/** Whether the pattern field currently holds the user's text rather than ours. */
export const isPatternOverridden = (state: ScopeState): boolean =>
    isPatternScope(state.scope) && state.overrides[state.scope] !== undefined;

/**
 * What belongs in the pattern field right now: the user's text if they have
 * any, otherwise the live suggestion for the current target.
 */
export const patternValue = (state: ScopeState, targetUrl: string): string => {
    if (!isPatternScope(state.scope)) return '';
    const override = state.overrides[state.scope];
    return override !== undefined ? override : suggestionFor(state.scope, targetUrl);
};

/**
 * The matcher this rule will be saved with.
 *
 * One place, shared by the save path, the Active/Inactive pill, the conflict
 * check and the live tab preview, so the five can never disagree about which
 * rule is being edited.
 */
export const matcherFor = (state: ScopeState, targetUrl: string, targetDomain: string): string => {
    if (state.scope === 'domain') return targetDomain;
    if (state.scope === 'exact_url') return canonicalUrl(targetUrl);
    return patternValue(state, targetUrl).trim();
};

/**
 * Why the current pattern cannot be saved, or null when it can.
 *
 * An empty pattern is incomplete rather than wrong, so it is not an error here;
 * the save path reports it when the user actually tries to save, which keeps
 * the field from turning red before it has been filled in.
 */
export const patternErrorFor = (state: ScopeState, targetUrl: string): string | null => {
    if (!isPatternScope(state.scope)) return null;
    const value = patternValue(state, targetUrl).trim();
    if (!value) return null;
    if (state.scope === 'regex' && !isValidRegex(value)) {
        return 'That is not a valid regular expression.';
    }
    if (state.scope === 'prefix' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
        // A prefix is compared against the whole URL, so it has to start where
        // the URL starts.
        return 'A prefix has to start from the beginning of the address, e.g. https://example.com/docs';
    }
    return null;
};
