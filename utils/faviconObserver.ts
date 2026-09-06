import { OBSERVER_DEBOUNCE_MS } from '../constants';

/**
 * Watches <head> for the page taking its favicon back.
 *
 * Extracted from content.ts for the same reason utils/faviconDom.ts was: this
 * is the second load-bearing decision in the content script (ADR-014) and it
 * was wrong for months without a single test going red. See ROADMAP R-43 and
 * R-48. content.ts keeps the orchestration; this file owns the predicate and
 * the debounce, and nothing here touches chrome.* so it runs under jsdom.
 *
 * Imported only by the content script.
 */

/**
 * Whether a batch of head mutations means the PAGE displaced our icon.
 *
 * The ownership mark cannot answer this. updateFavicon() repurposes the link
 * Chrome already tracks (ADR-001) and marks that element, so on a page that
 * reasserts its own icon the page is rewriting the very element carrying our
 * mark. Testing the mark therefore discarded every page write as though it were
 * ours, and only the 2s backup poller ever noticed: measured against a page
 * rewriting every 300ms, the user's icon was on screen about 7% of the time.
 *
 * The href is the honest test. If an icon link already points at our URL the
 * write was ours; anything else displaced us. That also makes a feedback loop
 * impossible, because our own re-apply produces a mutation whose href matches
 * and is ignored.
 */
export const displacesFavicon = (mutations: MutationRecord[], targetUrl: string): boolean => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const node of Array.from(mutation.addedNodes)) {
                if (node.nodeName !== 'LINK') continue;
                const link = node as HTMLLinkElement;
                // A new icon link pointing anywhere but at our icon displaces us.
                if (isIconLink(link) && link.getAttribute('href') !== targetUrl) return true;
            }
        } else if (mutation.type === 'attributes') {
            const link = mutation.target as HTMLLinkElement;
            if (link.nodeName !== 'LINK') continue;
            if (isIconLink(link) && link.getAttribute('href') !== targetUrl) return true;
        }
    }
    return false;
};

const isIconLink = (link: HTMLLinkElement): boolean =>
    (link.getAttribute('rel') || '').toLowerCase().includes('icon');

export interface FaviconObserver {
    /** Stops observing and cancels any re-apply still waiting on the debounce. */
    disconnect(): void;
}

/**
 * Calls `onDisplaced` when the page changes the favicon out from under us.
 *
 * Bursts are coalesced: a page re-hydrating its <head> can produce dozens of
 * records in a frame, and re-applying once per record would thrash the event
 * loop for no visible gain. The debounce is also what bounds the cost of a page
 * that reasserts its icon on a short timer for ever (LIMITATIONS L-33).
 */
export const observeFaviconChanges = (
    head: Node,
    targetUrl: string,
    onDisplaced: () => void,
    debounceMs: number = OBSERVER_DEBOUNCE_MS,
): FaviconObserver => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver((mutations) => {
        if (!displacesFavicon(mutations, targetUrl)) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            onDisplaced();
        }, debounceMs);
    });

    observer.observe(head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'rel'],
    });

    return {
        disconnect() {
            observer.disconnect();
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
        },
    };
};
