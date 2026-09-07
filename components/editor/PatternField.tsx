import React from 'react';
import { PatternPreview } from './useRuleEditor';
import { PatternScope } from '../../utils/ruleScope';

/**
 * The pattern editor, shown only for the scopes whose matcher is text the user
 * owns rather than something read off the target page.
 *
 * The live open-tab match count under the field is the point of this control:
 * a pattern can be checked against real tabs before it is saved, instead of
 * after, which is what made regex usable enough to expose at all (R-02).
 */
interface PatternFieldProps {
    scope: PatternScope;
    value: string;
    onChange: (text: string) => void;
    /** "Suggest from this page", hidden when there is no page to suggest from. */
    onSuggest?: () => void;
    error: string | null;
    preview: PatternPreview | null;
    /** The popup knows which page you are on, so it can say whether this covers it. */
    mode: 'popup' | 'options';
}

export const PatternField: React.FC<PatternFieldProps> = ({
    scope, value, onChange, onSuggest, error, preview, mode,
}) => (
    <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
            <label htmlFor="fc-pattern" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                {scope === 'prefix' ? 'URL starts with' : 'Regular expression'}
            </label>
            {onSuggest && (
                <button
                    onClick={onSuggest}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                    Suggest from this page
                </button>
            )}
        </div>
        <input
            id="fc-pattern"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder={scope === 'prefix' ? 'https://example.com/docs' : '^https://example\\.com/docs'}
            className={`w-full border rounded-md px-3 py-2 text-xs font-mono outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-400' : 'border-slate-300 focus:ring-indigo-500'}`}
        />

        {error ? (
            <p className="text-[10px] text-red-600 leading-snug">{error}</p>
        ) : preview ? (
            <div className="text-[10px] leading-snug">
                <p className={preview.coversTarget || mode === 'options' ? 'text-slate-500' : 'text-amber-700'}>
                    {mode === 'popup' && (preview.coversTarget
                        ? 'Matches this page. '
                        : 'Does not match this page. ')}
                    {preview.total > 0
                        ? `Matches ${preview.matched.length} of your ${preview.total} open tab${preview.total === 1 ? '' : 's'}.`
                        : 'No open tabs to check against.'}
                </p>
                {preview.matched.length > 0 && (
                    <ul className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                        {preview.matched.slice(0, 4).map((tab, i) => (
                            <li key={`${tab.url}-${i}`} className="text-slate-400 truncate" title={tab.url}>
                                {tab.title || tab.hostname}
                            </li>
                        ))}
                        {preview.matched.length > 4 && (
                            <li className="text-slate-400">and {preview.matched.length - 4} more</li>
                        )}
                    </ul>
                )}
            </div>
        ) : (
            <p className="text-[10px] text-slate-400">
                Matching open tabs are listed here as you type.
            </p>
        )}
    </div>
);
