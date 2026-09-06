/**
 * When to ask the user for a store review, and the rules about how.
 *
 * Pure and free of chrome.* on purpose: the content script writes the counter
 * and the two React surfaces read it, so the decision itself must be testable
 * without any of them. See ROADMAP R-47.
 *
 * Three rules this file exists to enforce:
 *
 *   1. Ask on evidence of use, not on opens. The counter advances only on days
 *      when a rule was actually applied to a page, so it measures the extension
 *      doing its job rather than someone still deciding whether to keep it.
 *   2. Ask once. A dismissal is permanent. Nothing about a favicon extension
 *      justifies asking a second time.
 *   3. Never gate on sentiment. There is deliberately no "are you enjoying
 *      this?" fork sending happy users to the store and unhappy ones to a form.
 *      That is review gating, it is against Chrome Web Store policy, and it is
 *      why store ratings are widely distrusted. One ask, one link, one refusal
 *      that sticks.
 */

export type RatingStatus = 'idle' | 'dismissed' | 'rated';

export interface RatingState {
    /** Distinct local days on which a rule was applied to a page. */
    activeDays: number;
    /** The last such day, as YYYY-MM-DD, so a day is only ever counted once. */
    lastActiveDay: string;
    status: RatingStatus;
}

/** Storage key. Read alongside `rules` and `settings`, never on its own. */
export const RATING_KEY = 'rating';

/**
 * Days of real use before the ask. Four means the user has kept the extension
 * through at least four separate sessions spread over at least four days, which
 * is a far better signal than a raw count of popup opens on the day they
 * installed it.
 */
export const RATING_MIN_ACTIVE_DAYS = 4;

/**
 * The published listing, not the loaded build: an unpacked copy has a different
 * id and there is nothing to review at it.
 */
export const REVIEW_URL =
    'https://chromewebstore.google.com/detail/egedbdckafdbomehjaihjhbcgmngmlah/reviews';

const EMPTY: RatingState = { activeDays: 0, lastActiveDay: '', status: 'idle' };

const STATUSES: RatingStatus[] = ['idle', 'dismissed', 'rated'];

/** Local calendar day. Local rather than UTC, since "today" means the user's. */
export const dayKey = (date: Date = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Reads whatever is in storage into a state we can reason about. Storage is
 * hand-editable and survives downgrades, so every field is checked rather than
 * trusted, exactly as importRules.ts does for rules.
 */
export const normalizeRatingState = (raw: unknown): RatingState => {
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    const r = raw as Record<string, unknown>;
    const activeDays = typeof r.activeDays === 'number' && Number.isFinite(r.activeDays)
        ? Math.max(0, Math.floor(r.activeDays))
        : 0;
    const lastActiveDay = typeof r.lastActiveDay === 'string' ? r.lastActiveDay : '';
    const status = STATUSES.includes(r.status as RatingStatus) ? r.status as RatingStatus : 'idle';
    return { activeDays, lastActiveDay, status };
};

/**
 * The state after a rule was applied today, or null when today is already
 * counted.
 *
 * Returning null is the point: the caller is the content script, running on
 * every page load of every tab, and it must not write to storage more than once
 * a day. Two tabs opening together on a new day can both see the old day and
 * both increment, which counts one extra. That is deliberate: the value is only
 * ever compared against a threshold, so the cost of the race is that the ask
 * arrives slightly sooner, and removing it would mean routing every page load
 * through the service worker to serialise a counter.
 */
export const withActiveDay = (state: RatingState, today: string): RatingState | null => {
    // Nothing further to count once the user has answered.
    if (state.status !== 'idle') return null;
    if (!today || state.lastActiveDay === today) return null;
    return { ...state, activeDays: state.activeDays + 1, lastActiveDay: today };
};

/** Whether to show the ask right now. */
export const shouldPromptForRating = (state: RatingState, ruleCount: number): boolean =>
    state.status === 'idle'
    && state.activeDays >= RATING_MIN_ACTIVE_DAYS
    // A user who has deleted every rule is not the user to ask.
    && ruleCount > 0;
