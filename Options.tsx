import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { getStorageData, deleteRule, saveSettings } from './utils/storage';
import { FaviconRule, GlobalSettings as GlobalSettingsType } from './types';
import { FaviconEditor } from './components/FaviconEditor';
import { GlobalSettings } from './components/options/GlobalSettings';
import { RulesList } from './components/options/RulesList';
import { DebugLogs } from './components/options/DebugLogs';
import './index.css';

const OptionsApp: React.FC = () => {
    const [rules, setRules] = useState<FaviconRule[]>([]);
    const [settings, setSettings] = useState<GlobalSettingsType>({ enableFileAccessWarning: true });
    const [editingRule, setEditingRule] = useState<FaviconRule | null>(null);

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
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                                <div>
                                    <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                        <span className="text-xl">✏️</span>
                                        {editingRule ? 'Edit Rule' : 'Create / Configure Rule'}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1 break-all">
                                        {editingRule ? `Editing rule for ${editingRule.matcher}` : 'Enter a URL below to create a new rule.'}
                                    </p>
                                </div>
                                {editingRule && (
                                    <button
                                        onClick={() => setEditingRule(null)}
                                        className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        New Rule
                                    </button>
                                )}
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
                        <GlobalSettings
                            settings={settings}
                            onSettingsChange={async (newSettings) => {
                                await saveSettings(newSettings);
                                refreshData();
                            }}
                            onRefresh={refreshData}
                        />

                        <RulesList
                            rules={rules}
                            editingRuleId={editingRule?.id}
                            onEdit={setEditingRule}
                            onDelete={handleDelete}
                        />

                        <DebugLogs />
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