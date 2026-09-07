import { ICON_PROBE_TIMEOUT_MS } from '../constants';

/**
 * Does a pasted icon address actually load?
 *
 * Only relevant for the "paste image URL" source and the global fallback
 * setting, where the rule stores a remote address rather than the inline
 * `data:` URL every other source produces (ADR-004). Those addresses were
 * checked for shape and never for existence, so a typo or a dead link saved
 * cleanly, reported success, and left the browser drawing its default icon on
 * every matching page with nothing to explain why.
 *
 * Runs in the editor page, not in the site: the page's own Content Security
 * Policy would decide the result there, and a CSP that blocks our probe is not
 * evidence that the address is broken.
 *
 * That choice is also why only `https:` addresses are probed. An extension page
 * cannot load an insecure subresource at all under Manifest V3, so an `http:`
 * address fires `onerror` here whatever is at the other end. Measured: from the
 * options page, `http://127.0.0.1:8899/blue.png` and `http://localhost:8899/
 * blue.png` both error while an `https:` image of the same size loads, and a
 * genuine `https:` 404 errors as it should. Probing http would therefore
 * produce a confident warning about a working address, which is the exact
 * failure this whole change exists to remove, so http gets no claim either way.
 * See docs/LIMITATIONS.md L-37 for what is still not said about an http icon.
 *
 * The request goes only to the address the user typed, once per save. That is
 * the same fetch the rule itself performs on every apply, so it exposes nothing
 * new; it is disclosed as case 1 of PRIVACY_POLICY.md's Network Requests.
 */

/** The slice of HTMLImageElement this needs, so a test can stand in for it. */
export interface ProbeImage {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    src: string;
}

export interface ProbeOptions {
    timeoutMs?: number;
    makeImage?: () => ProbeImage;
    /** Overridable so the offline branch can be tested without a network. */
    online?: boolean;
}

/**
 * `true` loaded, `false` failed, `undefined` not applicable or not known.
 *
 * A timeout deliberately yields `undefined` rather than `false`. A slow host is
 * not a broken address, and warning about one would be the same overclaiming in
 * the other direction: only an actual error event is evidence of failure.
 */
export const probeIconUrl = async (url: string, options: ProbeOptions = {}): Promise<boolean | undefined> => {
    const {
        timeoutMs = ICON_PROBE_TIMEOUT_MS,
        makeImage,
        // `!== false` rather than a truthiness test: an environment with no
        // navigator, or one that does not implement onLine, must not be read as
        // being offline.
        online = typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    } = options;

    // With no network at all, an error event says nothing about the address.
    // Reporting "that image address did not load" to someone on a plane would
    // be the same confident wrong answer this whole mechanism replaced: the
    // icon really will not appear, but the address is not why.
    if (!online) return undefined;

    // One guard, deliberately, because it is one fact: https is the only scheme
    // this can learn anything from. It also covers the two cases there is no
    // point probing anyway. An empty address has nothing to fetch, and a
    // `data:` icon (which is what every source other than a pasted URL
    // produces, ADR-004) was already drawn to a canvas in this same page before
    // it was saved, so it is known to decode. A separate check for either would
    // be a branch no test could tell apart from this one.
    if (!/^https:\/\//i.test(url)) return undefined;

    const create = makeImage
        || (typeof Image === 'undefined' ? null : () => new Image() as unknown as ProbeImage);
    if (!create) return undefined;

    const image = create();

    return new Promise<boolean | undefined>(resolve => {
        // Detaching both handlers and clearing the timer is what makes the
        // first answer the only answer: after it, neither the image nor the
        // timer has any way back in. No separate "settled" flag, because it
        // would guard nothing that these two lines do not already.
        const finish = (result: boolean | undefined) => {
            image.onload = null;
            image.onerror = null;
            clearTimeout(timer);
            resolve(result);
        };

        const timer: ReturnType<typeof setTimeout> = setTimeout(() => finish(undefined), timeoutMs);

        image.onload = () => finish(true);
        image.onerror = () => finish(false);

        // Deliberately no crossOrigin. UploadSection sets it because it draws
        // the image to a canvas and needs an untainted one; here we only need
        // the load or error event, and asking for CORS would make a perfectly
        // good icon on a host without CORS headers report as broken.
        image.src = url;
    });
};
