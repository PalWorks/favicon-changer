import React from 'react';
import { MatchType } from '../../types';
import { SCOPES, scopeHint } from '../../utils/ruleScope';

/**
 * The four-way match-type control: one row of four, with the explanation for
 * the selected one beneath.
 *
 * The buttons carry short labels so four fit the 400px popup without wrapping
 * (79px each there, 118px on the settings page). The full names stay as the
 * tooltip and the accessible name, so nothing is lost to a screen reader.
 * Copy and ordering live in utils/ruleScope.ts.
 */
interface ScopeSelectorProps {
    value: MatchType;
    onSelect: (scope: MatchType) => void;
}

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({ value, onSelect }) => (
    <div className="mb-3">
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
            {SCOPES.map(scope => (
                <button
                    key={scope.type}
                    onClick={() => onSelect(scope.type)}
                    title={`${scope.label}: ${scope.hint}`}
                    aria-label={scope.label}
                    aria-pressed={value === scope.type}
                    className={`py-1.5 px-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${value === scope.type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {scope.short}
                </button>
            ))}
        </div>
        {!!scopeHint(value) && (
            <p className="text-[10px] text-slate-400 leading-snug mt-1.5 px-1">{scopeHint(value)}</p>
        )}
    </div>
);
