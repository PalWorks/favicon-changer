import React, { useState } from 'react';
import { FaviconRule } from '../../types';
import { Button } from '../Button';
import { scopeLabel } from '../../utils/ruleScope';
import { shortenPattern } from '../../utils/patterns';

/**
 * Warns that a higher-precedence rule already matches this page, so the edit
 * about to be saved will have no visible effect.
 *
 * The action re-targets the editor at the winning rule. That button did nothing
 * at all for years, in every case (L-08), and became possible only once every
 * match type was representable in the editor (R-02).
 *
 * The winning rule's matcher is quoted on its own line, shortened, rather than
 * inline in the sentence with `break-all`. A rule made for an OAuth or login
 * page carries hundreds of characters of query string, and one of those wrapped
 * to some forty lines: the banner filled the entire popup and pushed "Edit that
 * rule instead" a full screen below the fold, so the warning stated the problem
 * and hid the fix. Reported from a real Facebook auth page. ROADMAP R-62.
 */
interface ConflictBannerProps {
    conflictRule: FaviconRule;
    /** The scope the user is currently editing, named in the explanation. */
    editingScopeLabel: string;
    onSwitch: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
    conflictRule, editingScopeLabel, onSwitch,
}) => {
    const [showFull, setShowFull] = useState(false);
    const short = shortenPattern(conflictRule.matcher);
    const isShortened = short !== conflictRule.matcher;

    return (
        <div role="status" aria-live="polite" className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2 flex flex-col gap-2">
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.072 19h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-orange-800">Another rule wins here</p>
                    {/* Worded to avoid an article in front of a scope name:
                        the labels are things like "Entire Domain", and "a
                        Entire Domain rule" is what the previous phrasing
                        produced on screen. */}
                    <p className="text-[10px] text-orange-700 leading-tight mt-1">
                        A more specific <strong>{scopeLabel(conflictRule.matchType)}</strong> rule already
                        matches this page, so it wins over the <strong>{editingScopeLabel}</strong> rule you
                        are editing. Your change will still be saved.
                    </p>

                    {/* Title as well as the toggle: hovering is the fastest way to
                        read the whole thing, and the toggle is there for anyone
                        who cannot hover. */}
                    <p
                        className={`font-mono text-[10px] text-orange-800 mt-1.5 ${showFull ? 'break-all' : 'truncate'}`}
                        title={conflictRule.matcher}
                    >
                        {showFull ? conflictRule.matcher : short}
                    </p>

                    {isShortened && (
                        <button
                            onClick={() => setShowFull(v => !v)}
                            aria-expanded={showFull}
                            className="mt-1 text-[10px] font-bold text-orange-700 underline hover:text-orange-900"
                        >
                            {showFull ? 'Show less' : 'Show the full pattern'}
                        </button>
                    )}
                </div>
            </div>
            <Button
                size="sm"
                variant="secondary"
                onClick={onSwitch}
                className="w-full text-[10px] h-7 bg-white border-orange-200 text-orange-700 hover:bg-orange-100"
            >
                Edit that rule instead
            </Button>
        </div>
    );
};
