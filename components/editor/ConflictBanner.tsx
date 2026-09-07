import React from 'react';
import { FaviconRule } from '../../types';
import { Button } from '../Button';
import { scopeLabel } from '../../utils/ruleScope';

/**
 * Warns that a higher-precedence rule already matches this page, so the edit
 * about to be saved will have no visible effect.
 *
 * The action re-targets the editor at the winning rule. That button did nothing
 * at all for years, in every case (L-08), and became possible only once every
 * match type was representable in the editor (R-02).
 */
interface ConflictBannerProps {
    conflictRule: FaviconRule;
    /** The scope the user is currently editing, named in the explanation. */
    editingScopeLabel: string;
    onSwitch: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
    conflictRule, editingScopeLabel, onSwitch,
}) => (
    <div role="status" aria-live="polite" className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2 flex flex-col gap-2">
        <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
                <p className="text-xs font-bold text-orange-800">Another rule wins here</p>
                <p className="text-[10px] text-orange-700 leading-tight mt-1">
                    You are editing a <strong>{editingScopeLabel}</strong> rule, but a more specific{' '}
                    <strong>{scopeLabel(conflictRule.matchType)}</strong> rule already matches this page
                    (<span className="font-mono break-all">{conflictRule.matcher}</span>). Your change will be
                    saved, but that rule takes precedence.
                </p>
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
