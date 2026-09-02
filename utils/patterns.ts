/**
 * Helpers for turning a URL into a matcher pattern the user can accept as-is.
 *
 * The point of these is that a good default makes prefix and regex rules a
 * one-click affair instead of a text-editing exercise. The Chrome Web Store
 * review that prompted the prefix match type described exactly this: one
 * favicon that stays applied to one Google Sheets document while the tail of
 * the URL changes between sheets.
 */

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
 * Best-effort hostname for something a user typed, which may be a bare domain
 * ("example.com") rather than a full URL. Returns '' when nothing usable can be
 * read, so callers can treat it as "no target yet" instead of catching.
 */
export const hostnameFromInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
    } catch (e) {
        return '';
    }
};
