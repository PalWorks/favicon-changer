/**
 * Validation utilities for user input
 */

// Cap pattern length as a cheap, partial guard against catastrophic-backtracking
// (ReDoS) regexes — JavaScript has no regex execution timeout, so we can't fully
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

export const isValidUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
};

export const isValidBadgeText = (text: string): boolean => {
    // Limit badge text to 3 characters — matches the editor input (maxLength=3)
    // and is about all that stays legible on a 16px favicon badge.
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
