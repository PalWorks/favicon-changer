/**
 * Validation utilities for user input
 */

// Cap pattern length as a cheap, partial guard against catastrophic-backtracking
// (ReDoS) regexes. JavaScript has no regex execution timeout, so we can't fully
// prevent it. Patterns here are user-created or self-imported, so the residual
// risk is low; this just rejects absurdly long patterns outright.
const MAX_REGEX_LENGTH = 2000;

export const isValidRegex = (pattern: string): boolean => {
    if (pattern.length > MAX_REGEX_LENGTH) return false;
    try {
        new RegExp(pattern);
        return true;
    } catch (e) {
        return false;
    }
};

// There is deliberately no general isValidUrl() here any more. It answered
// "does new URL() parse this", which is true of javascript: and data:text/html
// as well, and it was being used to guard the icon-URL field while imported
// rules were held to the stricter isAllowedFaviconUrl() below. One of them had
// to go, and it was the weaker one. Removed 2026-09-07.
export const isValidBadgeText = (text: string): boolean => {
    // Limit badge text to 3 characters. That matches the editor input
    // (maxLength=3) and is about all that stays legible on a 16px favicon badge.
    return text.length <= 3;
};

export const isValidFileType = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    return validTypes.includes(file.type);
};

export const isValidFileSize = (file: File, maxBytes = 5 * 1024 * 1024): boolean => {
    // Default max size 5MB (before compression)
    return file.size <= maxBytes;
};

// --- Limits for data arriving from outside the UI (a rules JSON import) ---

// A generous ceiling that still stops a single file from filling
// chrome.storage.local, which has a fixed quota shared with the user's icons.
export const MAX_IMPORT_RULES = 500;

// Icons the editor produces are a 128px PNG, tens of KB at most. This leaves
// plenty of headroom while rejecting a file that would blow the quota.
export const MAX_ICON_BYTES = 256 * 1024;

/**
 * Whether a favicon URL is one we are willing to store and later hand to a
 * <link href>. Imported files can come from anywhere, so the scheme is
 * allow-listed rather than checked for known-bad values: inline images, or a
 * plain http(s) address the user can see in the rules list.
 */
export const isAllowedFaviconUrl = (url: string): boolean => {
    if (typeof url !== 'string' || !url) return false;

    if (url.startsWith('data:')) {
        // Only actual images. Notably excludes data:text/html and data:image/svg+xml
        // is allowed because the editor itself produces SVG data URLs on repair.
        return /^data:image\/[a-z0-9.+-]+[;,]/i.test(url);
    }

    try {
        const protocol = new URL(url).protocol;
        return protocol === 'https:' || protocol === 'http:';
    } catch (e) {
        return false;
    }
};

/** Approximate decoded size of a data URL, or the string length otherwise. */
export const approximateUrlBytes = (url: string): number => {
    const base64 = url.indexOf(';base64,');
    if (url.startsWith('data:') && base64 !== -1) {
        return Math.floor((url.length - base64 - 8) * 0.75);
    }
    return url.length;
};
