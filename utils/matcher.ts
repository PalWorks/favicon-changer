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
    // 3 is reserved for the 'prefix' match type (ROADMAP R-01). It belongs
    // above regex: a rule scoped to one document must not lose to a site-wide
    // regex, and a user who wants the regex to win can make it more specific.
    regex: 2,
    domain: 1,
};

const NO_MATCH = -1;

const scoreRule = (rule: FaviconRule, currentUrl: string, currentDomain: string): number => {
    const tier = TIER_RANK[rule.matchType];
    // An unknown matchType (hand-edited or imported storage) never matches.
    if (tier === undefined) return NO_MATCH;

    const specificity = tier * (SPECIFICITY_CAP + 1) + Math.min(rule.matcher.length, SPECIFICITY_CAP);

    switch (rule.matchType) {
        case 'exact_url':
            return rule.matcher === currentUrl ? specificity : NO_MATCH;

        case 'regex': {
            if (!isValidRegex(rule.matcher)) {
                logger.warn('[Favicon Matcher] Invalid Regex:', rule.matcher);
                return NO_MATCH;
            }
            try {
                return new RegExp(rule.matcher).test(currentUrl) ? specificity : NO_MATCH;
            } catch (e) {
                return NO_MATCH;
            }
        }

        case 'domain':
            return currentDomain === rule.matcher || currentDomain.endsWith('.' + rule.matcher)
                ? specificity
                : NO_MATCH;

        default:
            return NO_MATCH;
    }
};

/**
 * Picks the rule that should apply to the current page, or null if none do.
 * Precedence: exact_url > regex > domain, and within one type the longer
 * (more specific) matcher wins. On an exact tie the earlier rule wins, which
 * keeps the result stable and insertion-ordered.
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
 * Finds a rule that will shadow the one currently being edited, so the editor
 * can warn instead of letting the user save a change with no visible effect.
 * Only checks the domain scope: nothing outranks an exact_url rule, so editing
 * one needs no warning.
 */
export const findConflictingRule = (targetUrl: string, currentScope: 'domain' | 'exact_url', rules: FaviconRule[]): FaviconRule | null => {
    if (currentScope !== 'domain') return null;

    const exactMatch = rules.find(r => r.matchType === 'exact_url' && r.matcher === targetUrl);
    if (exactMatch) return exactMatch;

    const regexMatch = rules.find(r => {
        if (r.matchType !== 'regex') return false;
        if (!isValidRegex(r.matcher)) return false;
        try {
            return new RegExp(r.matcher).test(targetUrl);
        } catch (e) {
            return false;
        }
    });

    return regexMatch || null;
};
