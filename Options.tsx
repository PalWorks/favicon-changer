import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { getStorageData, saveRule, deleteRule, saveSettings, generateId, exportRulesAsJson, importRulesFromJson } from './utils/storage';
import { FaviconRule, GlobalSettings } from './types';
import { logger } from './utils/logger';
import { FaviconPreview } from './components/FaviconPreview';
import { Button } from './components/Button';
import { FaviconEditor } from './components/FaviconEditor';
import './index.css';

const OptionsApp: React.FC = () => {
    const [rules, setRules] = useState<FaviconRule[]>([]);
    const [settings, setSettings] = useState<GlobalSettings>({ enableFileAccessWarning: true });
    const [editingRule, setEditingRule] = useState<FaviconRule | null>(null);

    const importInputRef = useRef<HTMLInputElement>(null);

    // Load data
    const refreshData = async () => {
        const data = await getStorageData();
        setRules(Object.values(data.rules));
        setSettings(data.settings);
    };

    useEffect(() => {
        refreshData();

        // Real-time sync with Popup
        const handleStorageChange = (changes: any, area: string) => {
            if (area === 'local') {
                if (changes.rules || changes.settings) {
                    refreshData();
                }
            }
        };

        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener(handleStorageChange);
        }

        return () => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.onChanged.removeListener(handleStorageChange);
            }
        };
    }, []);

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this rule?')) {
            await deleteRule(id);
            refreshData();
            if (editingRule?.id === id) {
                setEditingRule(null);
            }
        }
    };

    const handleGlobalFallbackChange = async (url: string) => {
        await saveSettings({ ...settings, defaultFaviconUrl: url || undefined });
        refreshData();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const result = await importRulesFromJson(content);
            if (result.success) {
                alert(`Successfully imported ${result.count} rules!`);
                refreshData();
            } else {
                alert('Failed to import rules. Please check the file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- LOGGING UI ---
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        if (showLogs) {
            logger.getLogs().then(setLogs);
            // Poll for logs every 2s if open
            const interval = setInterval(() => {
                logger.getLogs().then(setLogs);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [showLogs]);

    const handleCopyLogs = () => {
        navigator.clipboard.writeText(logs.join('\n'));
        alert('Logs copied to clipboard!');
    };

    const handleClearLogs = async () => {
        await logger.clear();
        setLogs([]);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="icons/FaviconChangerLogo.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-md object-contain" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Favicon Changer Manager</h1>
                            <p className="text-slate-500">Advanced settings and rule management</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Editor */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[800px] flex flex-col">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                    <span className="text-xl">✏️</span>
                                    {editingRule ? 'Edit Rule' : 'Create / Configure Rule'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {editingRule ? `Editing rule for ${editingRule.matcher}` : 'Enter a URL below to create a new rule.'}
                                </p>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                <FaviconEditor
                                    mode="options"
                                    initialRule={editingRule}
                                    onRuleSaved={() => {
                                        refreshData();
                                        setEditingRule(null);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Settings & List */}
                    <div className="space-y-8">

                        {/* Global Settings */}
                        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">⚙️</span> Global Settings
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Default Fallback Favicon</label>
                                    <p className="text-xs text-slate-500 mb-3">If a site has no favicon (and no specific rule matches), use this one.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Image URL..."
                                            value={settings.defaultFaviconUrl || ''}
                                            onChange={(e) => setSettings({ ...settings, defaultFaviconUrl: e.target.value })}
                                            onBlur={(e) => handleGlobalFallbackChange(e.target.value)}
                                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        />
                                        <div className="w-10 h-10 shrink-0">
                                            <FaviconPreview url={settings.defaultFaviconUrl || ''} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex gap-2">
                                    <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
                                    <Button size="sm" variant="secondary" onClick={() => importInputRef.current?.click()}>
                                        📥 Import JSON
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={exportRulesAsJson}>
                                        📤 Export JSON
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {/* Rules List */}
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
                                            onClick={() => setEditingRule(rule)}
                                            className={`p-4 flex items-center gap-4 hover:bg-indigo-50 transition-colors cursor-pointer group ${editingRule?.id === rule.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''}`}
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
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
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

                        {/* Debug Logs Section */}
                        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="text-xl">🐞</span> Debug Logs & Support
                                </h2>
                                <Button size="sm" variant="ghost" onClick={() => setShowLogs(!showLogs)}>
                                    {showLogs ? 'Hide Logs' : 'Show Logs'}
                                </Button>
                            </div>

                            {showLogs && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <p className="text-xs text-slate-500">
                                        If you encounter issues, please copy these logs and send them to support.
                                    </p>
                                    <div className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-green-400 leading-relaxed">
                                        {logs.length === 0 ? (
                                            <span className="text-slate-500 italic">No logs recorded yet.</span>
                                        ) : (
                                            logs.map((log, i) => (
                                                <div key={i} className="border-b border-slate-800/50 pb-1 mb-1 last:border-0">{log}</div>
                                            ))
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleCopyLogs} className="flex-1">
                                            📋 Copy to Clipboard
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={handleClearLogs} className="flex-1 text-red-600 hover:bg-red-50">
                                            🗑️ Clear Logs
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<React.StrictMode><OptionsApp /></React.StrictMode>);
}