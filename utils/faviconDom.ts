import { logger } from './logger';

/**
 * The DOM half of the content script: everything that reads or writes favicon
 * link elements on the page.
 *
 * Extracted from content.ts so the load-bearing behaviour in `updateFavicon`
 * can be unit tested. It is the one piece of this codebase that breaks
 * silently, only on background tabs, and only in a real browser, so a test is
 * worth more here than anywhere else. content.ts keeps the orchestration (rule
 * lookup, observer, polling, and the flags tracking what we have touched).
 *
 * Imported only by the content script. No other execution context may use it.
 */

// Marks the link element we own, so the MutationObserver in content.ts can
// ignore our own writes instead of reacting to them.
export const CHANGE_MARK = 'data-fc-modified';

/**
 * Points the page's favicon at `url`, and returns whether a link now carries it.
 *
 * IMPORTANT, why this mutates an EXISTING link's href instead of recreating
 * nodes: Chrome only re-paints a tab-strip favicon from a DOM change in two
 * situations:
 *   (a) the tab is the active/foreground tab, OR
 *   (b) the `href` of a <link> element Chrome is ALREADY TRACKING is mutated.
 * Adding a brand-new <link> (or remove-then-append) is NOT picked up for
 * background/inactive tabs: Chrome keeps showing the load-time favicon until
 * the tab is reloaded. This was verified empirically, an href mutation repaints
 * a background tab and a fresh-node insert does not. (It is also how sites like
 * Gmail update their unread-count favicon while in the background.)
 * So we always repurpose the existing tracked icon link in place; only when a
 * page has no icon link at all do we create one.
 *
 * See docs/DECISIONS.md ADR-001. utils/faviconDom.test.ts locks this in.
 */
export const updateFavicon = (url: string): boolean => {
    const head = document.getElementsByTagName('head')[0];
    if (!head) return false;

    // Array.from rather than a selector with the URL in it, to avoid selector
    // injection from special characters.
    const iconLinks = Array.from(document.querySelectorAll("link[rel*='icon']")) as HTMLLinkElement[];

    // Reuse the element Chrome is already tracking: prefer one we own, else the
    // page's own first icon link (the one Chrome started tracking at load).
    let ourLink = iconLinks.find(link => link.hasAttribute(CHANGE_MARK)) || iconLinks[0];

    if (ourLink) {
        // Mutating href on the tracked element is what triggers the repaint,
        // including on background tabs. Skip the write when it is already
        // correct, so re-applying an unchanged icon does not flash the tab icon.
        if (ourLink.getAttribute('href') !== url) ourLink.setAttribute('href', url);
        if (ourLink.getAttribute('rel') !== 'icon') ourLink.setAttribute('rel', 'icon');
        if (!ourLink.hasAttribute(CHANGE_MARK)) ourLink.setAttribute(CHANGE_MARK, 'true');
    } else {
        // No icon link exists on the page, so create one. Active tabs repaint
        // immediately; a background tab with no prior favicon may not repaint
        // until it is next activated, which is an acceptable edge case.
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = url;
        link.setAttribute(CHANGE_MARK, 'true');
        head.appendChild(link);
        ourLink = link;
        logger.debug('[Content] Appended new favicon link');
    }

    // Remove any remaining icon links so the browser cannot pick a stale one.
    iconLinks.forEach(link => {
        if (link !== ourLink) link.remove();
    });

    return true;
};

/**
 * The href of the page's own icon link, i.e. the first one we have not marked.
 * Used to remember what to restore when a rule is deleted.
 */
export const readOriginalFaviconHref = (): string | null => {
    const links = document.querySelectorAll("link[rel*='icon']");
    for (let i = 0; i < links.length; i++) {
        if (!links[i].hasAttribute(CHANGE_MARK)) {
            return links[i].getAttribute('href');
        }
    }
    return null;
};

/** Removes the link elements we own. Used when there is no original to restore. */
export const removeMarkedFaviconLinks = (): void => {
    document.querySelectorAll(`link[${CHANGE_MARK}='true']`).forEach(link => link.remove());
};

/** Whether a link carrying exactly this href is currently in the document. */
export const hasFaviconHref = (url: string): boolean =>
    Array.from(document.querySelectorAll("link[rel*='icon']"))
        .some(link => link.getAttribute('href') === url);
