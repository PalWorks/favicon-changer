/**
 * The contract for handing an edit target from one extension context to another.
 *
 * Deliberately its own module, and a tiny one. Two contexts write this key and
 * one reads it: the service worker writes it when the toolbar icon is clicked on
 * an OS where the bubble is disabled (ADR-007), the popup writes it when it
 * hands off to the standalone window, and the editor consumes it on load. The
 * key used to be declared separately in background.ts and utils/storage.ts, so
 * renaming one would have broken the Linux upload path silently and only on
 * Linux.
 *
 * It lives here rather than in constants.ts because background.js is its own
 * bundle and constants.ts carries the emoji catalogue with it.
 */
import { MatchType } from '../types';

/** Storage key. Written by one context, consumed and removed by another. */
export const PENDING_TARGET_KEY = 'pendingEditorTarget';

export interface PendingEditorTarget {
    url: string;
    domain: string;
    favIconUrl: string;
    scope: MatchType;
    /**
     * The pattern, for the prefix and regex scopes whose matcher is not derived
     * from the target page. Without this, handing off mid-edit would lose it.
     */
    matcher?: string;
    /**
     * When the window is opened from the toolbar icon rather than a handoff, no
     * section is pre-opened, mirroring the collapsed bubble.
     */
    section?: 'upload' | 'emoji' | 'badge';
}
