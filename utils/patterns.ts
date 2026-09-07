/**
 * Helpers for turning a URL into a matcher pattern the user can accept as-is.
 *
 * The point of these is that a good default makes prefix and regex rules a
 * one-click affair instead of a text-editing exercise. The Chrome Web Store
 * review that prompted the prefix match type described exactly this: one
 * favicon that stays applied to one Google Sheets document while the tail of
 * the URL changes between sheets.
 */

/**
 * Whether the user typed a real scheme, rather than something that merely looks
 * like one before the first colon.
 *
 * The `//` is load-bearing. Testing for `scheme:` alone treats `localhost:3000`
 * as a URL in the `localhost:` scheme, which parses to an empty host and a path
 * of `3000`, and the prefix suggestion built from that was `localhost:///3000`:
 * nonsense that then passed prefix validation, because it does contain
 * `scheme://`. A developer tool whose audience types port numbers cannot get
 * that wrong. Every scheme this extension deals with (http, https, file, ftp,
 * chrome-extension) carries the `//`.
 */
export const hasExplicitScheme = (value: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim());

/** Escapes a string so a RegExp matches it literally. */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Suggests a prefix that covers "this document" rather than "this exact page".
 *
 * Drops the query string and fragment (which is where per-view state usually
 * lives), then drops the last path segment when there are at least two, since
 * that segment is typically the action or view rather than the identity of the
 * thing: `/spreadsheets/d/ABC123/edit` becomes `/spreadsheets/d/ABC123`.
 *
 * A single-segment path is kept whole, because dropping it would widen the rule
 * to the entire site, which is what the `domain` match type is already for.
 */
export const suggestPrefix = (rawUrl: string): string => {
    try {
        const url = new URL(rawUrl);
        // Built from protocol + host rather than url.origin: origin is the
        // string "null" for file: URLs, which would produce a nonsense prefix.
        const base = url.host ? `${url.protocol}//${url.host}` : `${url.protocol}//`;
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) segments.pop();
        const path = segments.length ? `/${segments.join('/')}` : '/';
        return base + path;
    } catch (e) {
        // Not parseable as a URL. Trim the query and fragment textually so the
        // suggestion is still an improvement on the raw string.
        return rawUrl.split('#')[0].split('?')[0];
    }
};

/**
 * Suggests a regex for the same "this document" idea: the prefix, escaped so
 * every character matches literally, and anchored at the start.
 *
 * Anchoring and escaping are the whole reason this helper exists. A URL pasted
 * raw into a regex field is a broken pattern that silently over-matches: the
 * dots match any character, and a `?` makes the preceding character optional.
 */
export const suggestRegex = (rawUrl: string): string => `^${escapeRegex(suggestPrefix(rawUrl))}`;

/**
 * Whether a hostname the URL parser produced is one a page could actually have.
 *
 * The parser is not a validator, and the two disagree across engines. Chrome
 * silently percent-encodes characters that are illegal in a host, so
 * `new URL('https://not a url at all').hostname` is
 * `'not%20a%20url%20at%20all'` there, while Node throws on the same input. That
 * divergence let the settings page save a "domain" rule whose matcher could
 * never equal any real `location.hostname`: junk in the rules list, and
 * invisible to the test suite because the tests run in Node, where the input
 * never got that far. Found by driving the real browser (ROADMAP R-49).
 *
 * So the shape is checked here rather than inferred from the parser not
 * throwing. Internationalised domains are safe: the parser returns punycode
 * (`xn--`), so the value being checked is always ASCII by this point.
 */
export const looksLikeHostname = (host: string): boolean => {
    if (!host) return false;
    // A percent sign means the parser had to escape something that is not
    // allowed in a host, which means it was not a host.
    if (host.includes('%')) return false;
    // An IPv6 literal arrives bracketed and already validated by the parser.
    if (host.startsWith('[')) return true;
    // Every dot-separated label has to exist: '...', 'a..b' and '.com' are not
    // addresses, and a rule carrying one can never match anything.
    return host.split('.').every(label => label.length > 0);
};

/**
 * Best-effort hostname for something a user typed, which may be a bare domain
 * ("example.com") rather than a full URL. Returns '' when nothing usable can be
 * read, so callers can treat it as "no target yet" instead of catching.
 */
export const hostnameFromInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
        const host = new URL(hasExplicitScheme(trimmed) ? trimmed : `https://${trimmed}`).hostname;
        return looksLikeHostname(host) ? host : '';
    } catch (e) {
        return '';
    }
};
