import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import {
    RATING_KEY,
    REVIEW_URL,
    RatingState,
    RatingStatus,
    normalizeRatingState,
    shouldPromptForRating,
} from '../utils/rating';

/**
 * A one-time ask for a store review, shown only to users the extension has
 * actually been working for. The rules it follows, and why, are in
 * utils/rating.ts; the decision itself is tested there.
 *
 * An inline strip rather than a dialog on purpose. The popup is a 400px working
 * surface and putting a modal across it to ask the user for a favour is the
 * wrong trade, however small the favour.
 */
interface RatingPromptProps {
    /** Rules the user currently has. Nobody with none is asked. */
    ruleCount: number;
    /** The popup is tighter than the settings page and gets the compact copy. */
    surface: 'popup' | 'options';
}

export const RatingPrompt: React.FC<RatingPromptProps> = ({ ruleCount, surface }) => {
    const [state, setState] = useState<RatingState | null>(null);

    useEffect(() => {
        if (!globalThis.chrome?.storage?.local) return;
        chrome.storage.local.get([RATING_KEY], (result: any) => {
            if (chrome.runtime.lastError) {
                logger.debug('[Rating] could not read state:', chrome.runtime.lastError.message);
                return;
            }
            setState(normalizeRatingState(result?.[RATING_KEY]));
        });
    }, []);

    // Writes the answer and takes the strip away in the same step, so the ask
    // cannot reappear while the write is in flight.
    const answer = (status: RatingStatus) => {
        const next: RatingState = { ...(state as RatingState), status };
        setState(next);
        try {
            chrome.storage.local.set({ [RATING_KEY]: next }, () => {
                if (chrome.runtime.lastError) {
                    logger.warn('[Rating] could not save answer:', chrome.runtime.lastError.message);
                }
            });
        } catch (e) {
            logger.warn('[Rating] could not save answer', e);
        }
    };

    const rate = () => {
        answer('rated');
        try {
            // A plain new tab. The link goes to the published listing, so it is
            // the same navigation the user could make from the store page.
            chrome.tabs?.create
                ? chrome.tabs.create({ url: REVIEW_URL })
                : window.open(REVIEW_URL, '_blank', 'noopener');
        } catch (e) {
            logger.warn('[Rating] could not open the review page', e);
            window.open(REVIEW_URL, '_blank', 'noopener');
        }
    };

    if (!state || !shouldPromptForRating(state, ruleCount)) return null;

    const compact = surface === 'popup';

    return (
        <section
            aria-label="Rate this extension"
            className={`flex items-center gap-3 border-b border-amber-200 bg-amber-50 ${compact ? 'px-3 py-2' : 'rounded-xl border px-4 py-3 shadow-sm'}`}
        >
            <svg className={`shrink-0 text-amber-500 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            <p className={`flex-1 leading-snug text-amber-900 ${compact ? 'text-[11px]' : 'text-sm'}`}>
                {compact
                    ? 'Enjoying Favicon Changer? A rating helps other people find it.'
                    : 'Enjoying Favicon Changer Ultimate? A rating on the Chrome Web Store helps other people find it, and takes about a minute.'}
            </p>
            <button
                onClick={rate}
                className={`shrink-0 rounded-lg bg-amber-500 font-semibold text-white transition-colors hover:bg-amber-600 ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
            >
                Rate it
            </button>
            <button
                onClick={() => answer('dismissed')}
                aria-label="No thanks, do not ask again"
                className={`shrink-0 rounded-lg font-medium text-amber-700 transition-colors hover:bg-amber-100 ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
            >
                No thanks
            </button>
        </section>
    );
};
