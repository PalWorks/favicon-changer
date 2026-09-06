import React, { useMemo, useState } from 'react';
import { FaviconRule, MatchType } from '../../types';
import { FaviconPreview } from '../FaviconPreview';

// One colour and label per match type. Anything unrecognised falls back to a
// neutral chip rather than being mislabelled, since storage can be hand-edited.
const BADGE_STYLES: Record<string, string> = {
    domain: 'bg-blue-100 text-blue-700',
    prefix: 'bg-amber-100 text-amber-700',
    exact_url: 'bg-green-100 text-green-700',
    regex: 'bg-purple-100 text-purple-700',
};

const BADGE_LABELS: Record<string, string> = {
    domain: 'Domain',
    prefix: 'Starts with',
    exact_url: 'Exact',
    regex: 'Regex',
};

type SortKey = 'newest' | 'oldest' | 'matcher';
type TypeFilter = 'all' | MatchType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'domain', label: 'Domain' },
    { value: 'prefix', label: 'Starts with' },
    { value: 'exact_url', label: 'Exact' },
    { value: 'regex', label: 'Regex' },
];

interface RulesListProps {
    rules: FaviconRule[];
    editingRuleId?: string;
    onEdit: (rule: FaviconRule) => void;
    onDelete: (id: string) => void;
    onDeleteMany: (ids: string[]) => void;
    onToggleEnabled: (rule: FaviconRule) => void;
}

export const RulesList: React.FC<RulesListProps> = ({ rules, editingRuleId, onEdit, onDelete, onDeleteMany, onToggleEnabled }) => {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('newest');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = rules.filter(rule => {
            if (typeFilter !== 'all' && rule.matchType !== typeFilter) return false;
            if (!term) return true;
            return rule.matcher.toLowerCase().includes(term);
        });

        const sorted = [...filtered];
        if (sortKey === 'matcher') {
            sorted.sort((a, b) => a.matcher.localeCompare(b.matcher));
        } else {
            // Newest and oldest use createdAt, which is preserved across edits
            // (R-26), so this is genuinely creation order.
            sorted.sort((a, b) => sortKey === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
        }
        return sorted;
    }, [rules, search, typeFilter, sortKey]);

    // A selection can outlive what is on screen (filter changed, rule deleted),
    // so anything acted on is always intersected with what is actually visible.
    const visibleSelected = visible.filter(r => selected.has(r.id));
    const allVisibleSelected = visible.length > 0 && visibleSelected.length === visible.length;

    const toggleSelected = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAllVisible = () => {
        setSelected(prev => {
            const next = new Set(prev);
            if (allVisibleSelected) visible.forEach(r => next.delete(r.id));
            else visible.forEach(r => next.add(r.id));
            return next;
        });
    };

    const handleDeleteSelected = () => {
        const ids = visibleSelected.map(r => r.id);
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} rule${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
        onDeleteMany(ids);
        setSelected(new Set());
    };

    const isFiltered = search.trim() !== '' || typeFilter !== 'all';

    return (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-slate-800">
                        Active Rules ({isFiltered ? `${visible.length} of ${rules.length}` : rules.length})
                    </h2>
                    <span className="text-xs text-slate-500">Click to Edit</span>
                </div>

                {rules.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by URL or pattern..."
                                aria-label="Search rules"
                                className="flex-1 min-w-0 border border-slate-300 rounded-md px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <select
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value as SortKey)}
                                aria-label="Sort rules"
                                className="border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="matcher">A to Z</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {TYPE_FILTERS.map(filter => {
                                const count = filter.value === 'all'
                                    ? rules.length
                                    : rules.filter(r => r.matchType === filter.value).length;
                                if (count === 0 && filter.value !== 'all') return null;
                                return (
                                    <button
                                        key={filter.value}
                                        onClick={() => setTypeFilter(filter.value)}
                                        aria-pressed={typeFilter === filter.value}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border transition-colors ${typeFilter === filter.value
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        {filter.label} {count}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {visibleSelected.length > 0 && (
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-indigo-800">
                        {visibleSelected.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs font-medium text-slate-500 hover:text-slate-700"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50"
                        >
                            Delete selected
                        </button>
                    </div>
                </div>
            )}

            {rules.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    No rules created yet. Use the editor on the left to add one.
                </div>
            ) : visible.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                    No rules match this search.
                </div>
            ) : (
                <>
                    <div className="px-4 py-1.5 border-b border-slate-100 flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all shown rules"
                            className="accent-indigo-600"
                        />
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                            Select all shown
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {visible.map(rule => (
                            <div
                                key={rule.id}
                                onClick={() => onEdit(rule)}
                                className={`p-4 flex items-center gap-3 hover:bg-indigo-50 transition-colors cursor-pointer group ${editingRuleId === rule.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''} ${rule.enabled === false ? 'opacity-55' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(rule.id)}
                                    onClick={e => e.stopPropagation()}
                                    onChange={() => toggleSelected(rule.id)}
                                    aria-label={`Select rule for ${rule.matcher}`}
                                    className="accent-indigo-600 shrink-0"
                                />
                                <div className="shrink-0">
                                    <FaviconPreview url={rule.faviconUrl} size="md" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${BADGE_STYLES[rule.matchType] || 'bg-slate-100 text-slate-600'}`}>
                                            {BADGE_LABELS[rule.matchType] || rule.matchType}
                                        </span>
                                        <p className="font-mono text-sm text-slate-700 truncate" title={rule.matcher}>{rule.matcher}</p>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {rule.enabled === false && <span className="text-amber-600 font-semibold">Paused · </span>}
                                        Created {new Date(rule.createdAt).toLocaleDateString()}
                                        {rule.updatedAt && new Date(rule.updatedAt).toLocaleDateString() !== new Date(rule.createdAt).toLocaleDateString()
                                            ? ` · edited ${new Date(rule.updatedAt).toLocaleDateString()}`
                                            : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Pause rather than delete, so a rule can be ruled out as
                                        the cause of something without losing its icon. */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleEnabled(rule); }}
                                        role="switch"
                                        aria-checked={rule.enabled !== false}
                                        aria-label={`${rule.enabled === false ? 'Resume' : 'Pause'} rule for ${rule.matcher}`}
                                        title={rule.enabled === false ? 'Resume this rule' : 'Pause this rule without deleting it'}
                                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${rule.enabled === false ? 'bg-slate-300' : 'bg-indigo-600'}`}
                                    >
                                        <span className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-all ${rule.enabled === false ? 'left-0.5' : 'left-4'}`} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }}
                                        className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                                        title="Delete Rule"
                                        aria-label={`Delete rule for ${rule.matcher}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
};
