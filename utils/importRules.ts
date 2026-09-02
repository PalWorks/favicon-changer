import { FaviconRule, MatchType, MATCH_TYPES } from '../types';
import {
    isValidRegex,
    isValidBadgeText,
    isAllowedFaviconUrl,
    approximateUrlBytes,
    MAX_IMPORT_RULES,
    MAX_ICON_BYTES,
} from './validation';

/**
 * Validation for rules arriving from a JSON file.
 *
 * Kept pure and free of chrome APIs so it can be unit tested, and so the whole
 * decision about what is allowed into storage lives in one readable place.
 *
 * The previous version checked only that `id`, `matcher` and `faviconUrl` were
 * present, then spread the object straight into storage. That accepted an
 * unknown `matchType` (a rule that can never match), an unvalidated regex (a
 * pattern evaluated against every URL on every page load), a `faviconUrl` with
 * any scheme at all, and any number of rules of any size. See
 * docs/SECURITY.md threats 1 to 3.
 */

export interface RejectedRule {
    matcher: string;
    reason: string;
}

export interface ImportOutcome {
    accepted: Record<string, FaviconRule>;
    rejected: RejectedRule[];
    /** Accepted rules whose icon is fetched from a remote address on every apply. */
    remoteCount: number;
    /** Set when the file itself is unusable, as opposed to individual rules failing. */
    fatal?: string;
}

const SOURCE_TYPES: FaviconRule['sourceType'][] = ['emoji', 'upload', 'url', 'custom'];
const BADGE_POSITIONS = ['top', 'bottom'];
const IMAGE_MODES = ['contain', 'cover', 'stretch'];
const BADGE_MODES = ['overlay', 'badge'];

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Rebuilds metadata from known keys only, so unknown fields never reach storage. */
const cleanMetadata = (raw: any): FaviconRule['metadata'] | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: FaviconRule['metadata'] = {};

    if (BADGE_MODES.includes(raw.mode)) out.mode = raw.mode;
    if (isNonEmptyString(raw.overlayColor)) out.overlayColor = raw.overlayColor;
    if (typeof raw.overlayOpacity === 'number' && raw.overlayOpacity >= 0 && raw.overlayOpacity <= 1) {
        out.overlayOpacity = raw.overlayOpacity;
    }
    if (typeof raw.badgeText === 'string' && isValidBadgeText(raw.badgeText)) out.badgeText = raw.badgeText;
    if (isNonEmptyString(raw.badgeBgColor)) out.badgeBgColor = raw.badgeBgColor;
    if (isNonEmptyString(raw.badgeTextColor)) out.badgeTextColor = raw.badgeTextColor;
    if (BADGE_POSITIONS.includes(raw.badgePosition)) out.badgePosition = raw.badgePosition;
    if (isNonEmptyString(raw.emojiChar)) out.emojiChar = raw.emojiChar;
    if (IMAGE_MODES.includes(raw.imageMode)) out.imageMode = raw.imageMode;

    return Object.keys(out).length ? out : undefined;
};

/** Validates one candidate, returning either a clean rule or the reason it failed. */
const validateRule = (raw: any): { rule: FaviconRule } | { reason: string } => {
    if (!raw || typeof raw !== 'object') return { reason: 'not an object' };
    if (!isNonEmptyString(raw.id)) return { reason: 'missing id' };
    if (!isNonEmptyString(raw.matcher)) return { reason: 'missing matcher' };
    if (!isNonEmptyString(raw.faviconUrl)) return { reason: 'missing faviconUrl' };

    if (!MATCH_TYPES.includes(raw.matchType as MatchType)) {
        return { reason: `unknown match type "${String(raw.matchType)}"` };
    }
    if (raw.matchType === 'regex' && !isValidRegex(raw.matcher)) {
        return { reason: 'invalid or over-long regex' };
    }
    if (!isAllowedFaviconUrl(raw.faviconUrl)) {
        return { reason: 'icon must be an inline image or an http(s) address' };
    }
    if (approximateUrlBytes(raw.faviconUrl) > MAX_ICON_BYTES) {
        return { reason: `icon larger than ${Math.round(MAX_ICON_BYTES / 1024)}KB` };
    }

    const sourceType: FaviconRule['sourceType'] = SOURCE_TYPES.includes(raw.sourceType)
        ? raw.sourceType
        : 'upload';

    const createdAt = typeof raw.createdAt === 'number' && raw.createdAt > 0 ? raw.createdAt : Date.now();

    // Rebuilt field by field rather than spread, so nothing unexpected is stored.
    const rule: FaviconRule = {
        id: raw.id,
        matcher: raw.matcher,
        matchType: raw.matchType,
        faviconUrl: raw.faviconUrl,
        sourceType,
        createdAt,
    };

    if (isNonEmptyString(raw.originalUrl) && isAllowedFaviconUrl(raw.originalUrl)) {
        rule.originalUrl = raw.originalUrl;
    }
    if (typeof raw.updatedAt === 'number' && raw.updatedAt > 0) rule.updatedAt = raw.updatedAt;

    const metadata = cleanMetadata(raw.metadata);
    if (metadata) rule.metadata = metadata;

    return { rule };
};

export const validateImportedRules = (parsed: unknown): ImportOutcome => {
    const empty: ImportOutcome = { accepted: {}, rejected: [], remoteCount: 0 };

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...empty, fatal: 'File must be a JSON object of rules.' };
    }

    const candidates = Object.values(parsed as Record<string, unknown>);
    if (candidates.length === 0) {
        return { ...empty, fatal: 'File contains no rules.' };
    }
    if (candidates.length > MAX_IMPORT_RULES) {
        return { ...empty, fatal: `File contains ${candidates.length} rules; the limit is ${MAX_IMPORT_RULES}.` };
    }

    const accepted: Record<string, FaviconRule> = {};
    const rejected: RejectedRule[] = [];
    let remoteCount = 0;

    candidates.forEach((candidate: any) => {
        const result = validateRule(candidate);
        if ('reason' in result) {
            const label = typeof candidate?.matcher === 'string' && candidate.matcher
                ? candidate.matcher
                : '(unnamed rule)';
            rejected.push({ matcher: label, reason: result.reason });
            return;
        }
        accepted[result.rule.id] = result.rule;
        if (!result.rule.faviconUrl.startsWith('data:')) remoteCount++;
    });

    return { accepted, rejected, remoteCount };
};

/**
 * Human-readable summary of an import, used by both entry points (the popup
 * header and the settings page) so they cannot drift apart.
 */
export const describeImport = (report: {
    success: boolean;
    count: number;
    remoteCount: number;
    rejected: RejectedRule[];
    fatal?: string;
}): string => {
    const lines: string[] = [];

    if (report.fatal) {
        lines.push(report.fatal);
    } else {
        lines.push(`Imported ${report.count} rule${report.count === 1 ? '' : 's'}.`);
    }

    if (report.remoteCount > 0) {
        lines.push('');
        lines.push(
            `${report.remoteCount} of them use a remote image URL, which is fetched from its own ` +
            'address every time the rule applies.'
        );
    }

    if (report.rejected.length > 0) {
        lines.push('');
        lines.push(`Skipped ${report.rejected.length}:`);
        report.rejected.slice(0, 8).forEach(r => lines.push(`  ${r.matcher}: ${r.reason}`));
        if (report.rejected.length > 8) {
            lines.push(`  and ${report.rejected.length - 8} more`);
        }
    }

    return lines.join('\n');
};
