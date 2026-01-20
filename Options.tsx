import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { getStorageData, saveRule, deleteRule, saveSettings, generateId, exportRulesAsJson, importRulesFromJson } from './utils/storage';
import { FaviconRule, GlobalSettings } from './types';
import { FaviconPreview } from './components/FaviconPreview';
import { Button } from './components/Button';

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
  }, []);

  const handleDelete = async (id: string) => {
    if(confirm('Are you sure you want to delete this rule?')) {
        await deleteRule(id);
        refreshData();
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRule) return;
    // Validate
    if (!editingRule.matcher.trim() || !editingRule.faviconUrl.trim()) {
        alert("Please provide both a Matcher (URL/Domain/Regex) and an Icon URL.");
        return;
    }

    await saveRule(editingRule);
    setEditingRule(null);
    refreshData();
  };

  const handleCreateNew = () => {
      setEditingRule({
          id: generateId(),
          matcher: '',
          matchType: 'domain',
          faviconUrl: '',
          sourceType: 'url',
          createdAt: Date.now()
      });
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

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md">F</div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Favicon Changer Manager</h1>
                    <p className="text-slate-500">Advanced settings and rule management</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleCreateNew}>+ Create New Rule</Button>
            </div>
        </div>

        {/* Global Settings */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">⚙️</span> Global Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Default Fallback Favicon</label>
                     <p className="text-xs text-slate-500 mb-3">If a site has no favicon (and no specific rule matches), use this one.</p>
                     <div className="flex gap-2">
                         <input 
                            type="text" 
                            placeholder="Image URL..." 
                            value={settings.defaultFaviconUrl || ''}
                            onChange={(e) => setSettings({...settings, defaultFaviconUrl: e.target.value})}
                            onBlur={(e) => handleGlobalFallbackChange(e.target.value)}
                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                         />
                         <div className="w-10 h-10 shrink-0">
                             <FaviconPreview url={settings.defaultFaviconUrl || ''} />
                         </div>
                     </div>
                 </div>
                 
                 <div className="space-y-4">
                     <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                         <strong className="block mb-1">Local File Access</strong>
                         <p className="mb-2">To change favicons for local files (file://), you must enable permission in Chrome.</p>
                         <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id })}
                         >
                             Open Extension Settings
                         </Button>
                     </div>
                     
                     <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                         <strong className="block mb-2 text-slate-700">Data Management</strong>
                         <div className="flex gap-2">
                             <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
                             <Button size="sm" variant="secondary" onClick={() => importInputRef.current?.click()}>
                                 📥 Import JSON
                             </Button>
                             <Button size="sm" variant="secondary" onClick={exportRulesAsJson}>
                                 📤 Export JSON
                             </Button>
                         </div>
                     </div>
                 </div>
            </div>
        </section>

        {/* Rule Editor (Modal-ish) */}
        {editingRule && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px] max-w-full m-4 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-lg font-bold mb-4">{rules.find(r => r.id === editingRule.id) ? 'Edit Rule' : 'Create New Rule'}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Match Type</label>
                            <select 
                                value={editingRule.matchType}
                                onChange={(e) => setEditingRule({...editingRule, matchType: e.target.value as any})}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="domain">Domain (e.g., google.com)</option>
                                <option value="exact_url">Exact URL (e.g., https://site.com/page)</option>
                                <option value="regex">Regular Expression (Advanced)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {editingRule.matchType === 'regex' ? 'Regex Pattern' : editingRule.matchType === 'domain' ? 'Domain' : 'URL'}
                            </label>
                            <input 
                                type="text"
                                value={editingRule.matcher}
                                onChange={(e) => setEditingRule({...editingRule, matcher: e.target.value})}
                                placeholder={editingRule.matchType === 'regex' ? 'e.g. ^https://.*\\.dev' : editingRule.matchType === 'domain' ? 'example.com' : 'https://example.com/foo'}
                                className="w-full border border-slate-300 rounded-md p-2 font-mono text-sm"
                            />
                            {editingRule.matchType === 'regex' && (
                                <p className="text-xs text-slate-400 mt-1">JavaScript Regex syntax supported. Be careful!</p>
                            )}
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Icon URL</label>
                             <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={editingRule.faviconUrl}
                                    onChange={(e) => setEditingRule({...editingRule, faviconUrl: e.target.value})}
                                    placeholder="https://..."
                                    className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                                />
                                <div className="w-10 h-10">
                                    <FaviconPreview url={editingRule.faviconUrl} />
                                </div>
                             </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setEditingRule(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Rule</Button>
                    </div>
                </div>
            </div>
        )}

        {/* Rules List */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h2 className="font-semibold text-slate-800">Active Rules ({rules.length})</h2>
                 <span className="text-xs text-slate-500">Ordered by Priority: Exact {'>'} Regex {'>'} Domain</span>
             </div>
             
             {rules.length === 0 ? (
                 <div className="p-12 text-center text-slate-400">
                     No rules created yet.
                 </div>
             ) : (
                 <div className="divide-y divide-slate-100">
                     {rules.map(rule => (
                         <div key={rule.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group">
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
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setEditingRule(rule)}>Edit</Button>
                                 <button onClick={() => handleDelete(rule.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                 </button>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
        </section>

      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><OptionsApp /></React.StrictMode>);
}