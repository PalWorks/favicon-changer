import { FaviconRule, MatchType } from '../types';
import { isValidRegex } from './validation';
import { logger } from './logger';

// --- SCORING ---
//
// Every rule that matches the current page gets a score, and the highest score
// wins. Score has two components:
//
//   1. Tier rank, from the match type. A more specific kind of match always
//      beats a less specific one, whatever the matchers look like.
//   2. Matcher length, as a specificity tie-break inside a tier. This is what
//      makes a rule for 'docs.google.com' beat one for 'google.com' on a docs
//      URL. Before this existed, each tier was scanned with Array.find, so the
//      rule that happened to be created FIRST won and users read the result as
//      random (LIMITATIONS L-04).
//
// The tier rank is multiplied past any possible matcher length, so a long
// matcher can never promote a rule out of its tier: a 2000-character regex
// (the cap in validation.ts) must still lose to an exact URL match.
const SPECIFICITY_CAP = 9999;

const TIER_RANK: Record<MatchType, number> = {
    exact_url: 4,
    // Above regex deliberately: a rule scoped to one document must not lose to
    // a site-wide regex, and a user who wants their regex to win can always
    // make it more specific. See docs/DECISIONS.md ADR-013.
    prefix: 3,
    regex: 2,
    domain: 1,
};

const NO_MATCH = -1;

const scoreMatch = (matchType: MatchType, matcher: string, currentUrl: string, currentDomain: string): number => {
    const tier = TIER_RANK[matchType];
    // An unknown matchType (hand-edited or imported storage) never matches.
    if (tier === undefined) return NO_MATCH;
    // Nor does an empty matcher, which would otherwise make a prefix rule match
    // every URL on the web.
    if (!matcher) return NO_MATCH;

    const specificity = tier * (SPECIFICITY_CAP + 1) + Math.min(matcher.length, SPECIFICITY_CAP);

    switch (matchType) {
        case 'exact_url':
            return matcher === currentUrl ? specificity : NO_MATCH;

        case 'prefix':
            // Anchored by construction, and no escaping for the user to get
            // wrong. See docs/DECISIONS.md ADR-013 for why this exists
            // alongside regex rather than being left to regex.
            return currentUrl.startsWith(matcher) ? specificity : NO_MATCH;

        case 'regex': {
            if (!isValidRegex(matcher)) {
                logger.warn('[Favicon Matcher] Invalid Regex:', matcher);
                return NO_MATCH;
            }
            try {
                return new RegExp(matcher).test(currentUrl) ? specificity : NO_MATCH;
            } catch (e) {
                return NO_MATCH;
            }
        }

        case 'domain':
            return currentDomain === matcher || currentDomain.endsWith('.' + matcher)
                ? specificity
                : NO_MATCH;

        default:
            return NO_MATCH;
    }
};

const scoreRule = (rule: FaviconRule, currentUrl: string, currentDomain: string): number => {
    // A paused rule is invisible to matching, which also means it can never be
    // reported as a conflict.
    if (rule.enabled === false) return NO_MATCH;
    return scoreMatch(rule.matchType, rule.matcher, currentUrl, currentDomain);
};

/**
 * Whether one pattern would match a given URL. Used by the editor to show, live,
 * which of the user's open tabs a pattern covers before they save it.
 */
export const patternMatches = (matchType: MatchType, matcher: string, url: string, hostname: string): boolean =>
    scoreMatch(matchType, matcher, url, hostname) !== NO_MATCH;

/**
 * Picks the rule that should apply to the current page, or null if none do.
 * Precedence: exact_url > prefix > regex > domain, and within one type the
 * longer (more specific) matcher wins. On an exact tie the earlier rule wins,
 * which keeps the result stable and insertion-ordered.
 */
export const findBestRule = (currentUrl: string, currentDomain: string, rules: FaviconRule[]): FaviconRule | null => {
    let best: FaviconRule | null = null;
    let bestScore = NO_MATCH;

    for (const rule of rules) {
        const score = scoreRule(rule, currentUrl, currentDomain);
        if (score > bestScore) {
            best = rule;
            bestScore = score;
        }
    }

    return best;
};

/**
 * Finds the rule that would beat the one currently being edited on this page,
 * so the editor can warn instead of letting the user save a change with no
 * visible effect.
 *
 * Scores the candidate exactly as findBestRule would and looks for anything
 * that outscores it, which covers same-tier shadowing (a longer matcher of the
 * same type) as well as a higher tier. It used to compare only two hardcoded
 * types against a domain-scoped edit, which meant a domain rule for
 * `docs.google.com` could silently beat one for `google.com` with no warning.
 *
 * Returns null when the candidate does not match the page at all: there is
 * nothing to shadow, and the editor already says the pattern does not match.
 */
export const findConflictingRule = (
    candidate: { matchType: MatchType; matcher: string },
    targetUrl: string,
    targetHostname: string,
    rules: FaviconRule[]
): FaviconRule | null => {
    const candidateScore = scoreMatch(candidate.matchType, candidate.matcher, targetUrl, targetHostname);
    if (candidateScore === NO_MATCH) return null;

    let best: FaviconRule | null = null;
    let bestScore = candidateScore;

    for (const rule of rules) {
        // The rule this save will overwrite cannot conflict with itself.
        if (rule.matchType === candidate.matchType && rule.matcher === candidate.matcher) continue;
        const score = scoreRule(rule, targetUrl, targetHostname);
        if (score > bestScore) {
            best = rule;
            bestScore = score;
        }
    }

    return best;
};
