import React from 'react';
import { FaviconRule } from '../../types';
import { FaviconPreview } from '../FaviconPreview';

interface RulesListProps {
    rules: FaviconRule[];
    editingRuleId?: string;
    onEdit: (rule: FaviconRule) => void;
    onDelete: (id: string) => void;
}

export const RulesList: React.FC<RulesListProps> = ({ rules, editingRuleId, onEdit, onDelete }) => {
    return (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="font-semibold text-slate-800">Active Rules ({rules.length})</h2>
                <span className="text-xs text-slate-500">Click to Edit</span>
            </div>

            {rules.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    No rules created yet. Use the editor on the left to add one.
                </div>
            ) : (
                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {rules.map(rule => (
                        <div
                            key={rule.id}
                            onClick={() => onEdit(rule)}
                            className={`p-4 flex items-center gap-4 hover:bg-indigo-50 transition-colors cursor-pointer group ${editingRuleId === rule.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''}`}
                        >
                            <div className="shrink-0">
                                <FaviconPreview url={rule.faviconUrl} size="md" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                                ${rule.matchType === 'domain' ? 'bg-blue-100 text-blue-700' :
                                            rule.matchType === 'exact_url' ? 'bg-green-100 text-green-700' :
                                                'bg-purple-100 text-purple-700'}`}>
                                        {rule.matchType === 'exact_url' ? 'Exact' : rule.matchType}
                                    </span>
                                    <p className="font-mono text-sm text-slate-700 truncate">{rule.matcher}</p>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Created {new Date(rule.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }}
                                    className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                                    title="Delete Rule"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};
