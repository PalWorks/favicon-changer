/**
 * Validation utilities for user input
 */

export const isValidRegex = (pattern: string): boolean => {
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
    // Limit badge text to 4 characters (standard for favicons)
    return text.length <= 4;
};

export const isValidFileType = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    return validTypes.includes(file.type);
};

export const isValidFileSize = (file: File, maxBytes = 5 * 1024 * 1024): boolean => {
    // Default max size 5MB (before compression)
    return file.size <= maxBytes;
};
