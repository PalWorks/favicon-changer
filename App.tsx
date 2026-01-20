import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getCurrentTabInfo, getStorageData, saveRule, deleteRule, generateId, openOptionsPage, isAllowedFileSchemeAccess, exportRulesAsJson, importRulesFromJson } from './utils/storage';
import { FaviconRule, TabView, EmojiItem, MatchType } from './types';
import { EMOJI_LIBRARY } from './constants';
import { generateIcon } from './services/geminiService';
import { Button } from './components/Button';
import { FaviconPreview } from './components/FaviconPreview';
import { Accordion } from './components/Accordion';

type ImageMode = 'contain' | 'cover' | 'stretch';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState({ url: '', domain: '', favIconUrl: '' });
  const [rules, setRules] = useState<FaviconRule[]>([]);
  const [openSection, setOpenSection] = useState<'upload' | 'emoji' | 'ai' | null>('upload');
  
  // Inputs
  const [customUrl, setCustomUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  
  // Upload & Editing State
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<ImageMode>('contain');
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  
  // Matching Preference in Popup
  const [applyScope, setApplyScope] = useState<'domain' | 'exact_url'>('domain');
  
  // File Access Check
  const [fileAccess, setFileAccess] = useState(true);

  // Emoji System
  const [emojiSearch, setEmojiSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(EMOJI_LIBRARY[0].id);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
      const info = await getCurrentTabInfo();
      setCurrentTab(info);
      const data = await getStorageData();
      setRules(Object.values(data.rules));
      const allowed = await isAllowedFileSchemeAccess();
      setFileAccess(allowed);
  };

  // Process image whenever mode or source changes
  useEffect(() => {
    if (!pendingImage) {
        setProcessedPreview(null);
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 128; // Standardize
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw background white or transparent? Transparent is better for favicons.
        ctx.clearRect(0, 0, SIZE, SIZE);
        
        // Calculate dimensions
        const aspect = img.width / img.height;
        let dx=0, dy=0, dw=SIZE, dh=SIZE;

        if (imageMode === 'contain') {
             if (aspect > 1) { // Wider
                 dh = SIZE / aspect;
                 dy = (SIZE - dh) / 2;
             } else {
                 dw = SIZE * aspect;
                 dx = (SIZE - dw) / 2;
             }
        } else if (imageMode === 'cover') {
             if (aspect > 1) { // Wider - crop sides
                 dw = SIZE * aspect;
                 dx = (SIZE - dw) / 2;
             } else {
                 dh = SIZE / aspect;
                 dy = (SIZE - dh) / 2;
             }
        }
        // Stretch is default initialized (0,0,SIZE,SIZE)

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, dw, dh);
        setProcessedPreview(canvas.toDataURL('image/png'));
    };
    img.src = pendingImage;
  }, [pendingImage, imageMode]);

  const handleSave = async (url: string, sourceType: FaviconRule['sourceType']) => {
    if (!currentTab.url) return;

    const matcher = applyScope === 'domain' ? currentTab.domain : currentTab.url;

    const existingRule = rules.find(r => r.matcher === matcher && r.matchType === applyScope);
    
    const newRule: FaviconRule = {
      id: existingRule?.id || generateId(),
      matcher,
      matchType: applyScope,
      faviconUrl: url,
      sourceType,
      createdAt: Date.now()
    };

    await saveRule(newRule);
    refreshData();
    // Reset upload state
    setPendingImage(null);
    setCustomUrl('');
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
    refreshData();
  };

  const handleDownloadOriginal = async () => {
    if (!currentTab.favIconUrl) return;
    try {
        const response = await fetch(currentTab.favIconUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favicon-${currentTab.domain}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        window.open(currentTab.favIconUrl, '_blank');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingImage(reader.result as string);
      setImageMode('contain'); // Default
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
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
              alert('Failed to import rules. Invalid file format.');
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const icon = await generateIcon(aiPrompt);
      setGeneratedIcon(icon);
    } catch (error) {
      console.error(error);
      alert('Failed to generate icon. Check API Key or try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '54px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 32, 34); 
      const dataUrl = canvas.toDataURL('image/png');
      handleSave(dataUrl, 'emoji');
    }
  };

  const toggleSection = (section: 'upload' | 'emoji' | 'ai') => {
    setOpenSection(prev => prev === section ? null : section);
  };

  const scrollToCategory = (categoryId: string) => {
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleEmojiScroll = () => {
    if (!emojiContainerRef.current) return;
    let currentCat = activeCategory;
    const containerTop = emojiContainerRef.current.scrollTop;
    
    for (const cat of EMOJI_LIBRARY) {
        const el = document.getElementById(`category-${cat.id}`);
        if (el && el.offsetTop <= containerTop + 100) {
            currentCat = cat.id;
        }
    }
    if (currentCat !== activeCategory) {
        setActiveCategory(currentCat);
    }
  };

  const filteredEmojis = useMemo(() => {
    if (!emojiSearch.trim()) return null;
    const term = emojiSearch.toLowerCase();
    const allEmojis: EmojiItem[] = [];
    EMOJI_LIBRARY.forEach(cat => allEmojis.push(...cat.emojis));
    return allEmojis.filter(e => e.keywords.includes(term) || e.char.includes(term));
  }, [emojiSearch]);

  const activeRule = rules.find(r => {
      if (r.matchType === 'exact_url') return r.matcher === currentTab.url;
      if (r.matchType === 'domain') return r.matcher === currentTab.domain;
      return false;
  });

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">F</div>
          <h1 className="text-lg font-bold text-slate-800">Favicon Changer</h1>
        </div>
        
        <div className="flex gap-1">
            <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
            
            <button
                onClick={() => importInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Import Rules"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </button>
            <button
                onClick={exportRulesAsJson}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Export Rules"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1 self-center"></div>
            <button
                onClick={openOptionsPage}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Open Dashboard & Settings"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-5">
            {/* Target Status */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Page</h2>
                    {activeRule && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase tracking-wide">Active</span>
                    )}
                </div>
                
                <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <FaviconPreview url={activeRule?.faviconUrl || currentTab.favIconUrl} size="md" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]" title={currentTab.url}>{currentTab.domain}</p>
                            <p className="text-xs text-slate-500 truncate">{activeRule ? `Overridden by ${activeRule.matchType}` : 'Using original'}</p>
                        </div>
                     </div>
                     
                     <button 
                        onClick={handleDownloadOriginal}
                        disabled={!currentTab.favIconUrl}
                        title="Export Original Favicon"
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>

                {/* Scope Toggles */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setApplyScope('domain')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${applyScope === 'domain' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Entire Domain
                    </button>
                    <button
                        onClick={() => setApplyScope('exact_url')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${applyScope === 'exact_url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        This Page Only
                    </button>
                </div>
            </div>
            
            {!fileAccess && currentTab.url.startsWith('file:') && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex flex-col gap-2">
                    <p><strong>Permission Required:</strong> To change icons for local files, you need to enable "Allow access to file URLs" in settings.</p>
                    <Button size="sm" variant="secondary" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id })}>
                        Open Settings
                    </Button>
                </div>
            )}

            {activeRule && (
               <div className="bg-indigo-50/80 p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-indigo-900">Remove this rule?</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(activeRule.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-3">
                    Reset
                  </Button>
               </div>
            )}

            <div>
               <h3 className="text-sm font-semibold text-slate-700 mb-3 px-1">Customize</h3>
               
               {/* 1. Upload & Editor */}
               <Accordion title="Upload Image or URL" icon="📂" isOpen={openSection === 'upload'} onToggle={() => toggleSection('upload')}>
                   <div className="space-y-3">
                        {pendingImage ? (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">Adjust Image</div>
                                <div className="flex justify-center mb-3 bg-white p-2 rounded border border-slate-100">
                                    <img src={processedPreview || pendingImage} className="w-16 h-16 border border-slate-200 rounded object-contain bg-[url('https://www.transparenttextures.com/patterns/checkerboard-cross.png')]" />
                                </div>
                                <div className="flex gap-1 mb-3">
                                    <button onClick={() => setImageMode('contain')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'contain' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Fit (Pad)</button>
                                    <button onClick={() => setImageMode('cover')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'cover' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Fill (Crop)</button>
                                    <button onClick={() => setImageMode('stretch')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded border ${imageMode === 'stretch' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Stretch</button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setPendingImage(null)} className="flex-1">Cancel</Button>
                                    <Button size="sm" onClick={() => processedPreview && handleSave(processedPreview, 'upload')} className="flex-1">Apply Icon</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Compact File Upload Row */}
                                <div 
                                    className="relative h-10 w-full border border-slate-200 bg-slate-50 rounded-lg flex items-center pl-2 pr-1 cursor-pointer hover:bg-white hover:ring-2 hover:ring-indigo-500 transition-all group"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Click to choose a file"
                                >
                                    <div className="flex items-center gap-2 pl-1 flex-1 min-w-0">
                                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-slate-500 truncate group-hover:text-indigo-600 transition-colors">
                                            Upload icon (PNG/SVG, 48x48px+)
                                        </span>
                                    </div>
                                    <div className="w-16 justify-center bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded shadow-sm group-hover:border-indigo-200 h-7 flex items-center">
                                        Browse
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/svg+xml" onChange={handleFileSelect} />
                                </div>

                                {/* URL Row */}
                                <div className="relative h-10 w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400 text-xs">🔗</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Or paste image URL..." 
                                        value={customUrl} 
                                        onChange={(e) => setCustomUrl(e.target.value)} 
                                        className="w-full h-full border border-slate-200 bg-slate-50 rounded-lg pl-8 pr-20 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    />
                                    <button 
                                        disabled={!customUrl} 
                                        onClick={() => handleSave(customUrl, 'url')} 
                                        className="absolute right-1 top-1.5 bottom-1.5 w-16 justify-center bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded hover:bg-slate-50 disabled:opacity-50 h-7 flex items-center"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </>
                        )}
                   </div>
               </Accordion>

               {/* 2. Emojis */}
               <Accordion title="Select Emoji" icon="😀" isOpen={openSection === 'emoji'} onToggle={() => toggleSection('emoji')}>
                   <div className="flex flex-col h-[300px]">
                        <div className="mb-2 relative">
                            <input type="text" placeholder="Search emojis..." value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500" />
                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                        </div>
                        {!emojiSearch && (
                            <div className="flex items-center gap-1 mb-2 overflow-x-auto no-scrollbar border-b border-slate-100 pb-1">
                                {EMOJI_LIBRARY.map(cat => (
                                    <button key={cat.id} onClick={() => scrollToCategory(cat.id)} className={`flex-1 py-1.5 px-3 text-lg rounded-lg transition-all text-center flex items-center justify-center shrink-0 ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-md scale-105' : 'hover:bg-slate-100 text-slate-500 grayscale opacity-70 hover:grayscale-0 hover:opacity-100'}`} title={cat.name}>{cat.icon}</button>
                                ))}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto pr-1 relative" ref={emojiContainerRef} onScroll={handleEmojiScroll}>
                            {filteredEmojis ? (
                                <div className="grid grid-cols-6 gap-2">
                                    {filteredEmojis.map((emoji, idx) => (
                                        <button key={`${emoji.char}-${idx}`} onClick={() => saveEmoji(emoji.char)} className={`text-2xl h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors ${selectedEmoji === emoji.char ? 'bg-indigo-50 ring-2 ring-indigo-500' : ''}`} title={emoji.keywords}>{emoji.char}</button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4 pt-1">
                                    {EMOJI_LIBRARY.map(category => (
                                        <div key={category.id} id={`category-${category.id}`}>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">{category.name}</h4>
                                            <div className="grid grid-cols-6 gap-2">
                                                {category.emojis.map((emoji, idx) => (
                                                    <button key={`${category.id}-${emoji.char}-${idx}`} onClick={() => saveEmoji(emoji.char)} className={`text-2xl h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors ${selectedEmoji === emoji.char ? 'bg-indigo-50 ring-2 ring-indigo-500' : ''}`} title={emoji.keywords}>{emoji.char}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                   </div>
               </Accordion>

               {/* 3. AI Generator */}
               <Accordion title="Generate with AI" icon="✨" isOpen={openSection === 'ai'} onToggle={() => toggleSection('ai')}>
                   <div className="space-y-3">
                       <p className="text-xs text-slate-500">Describe the icon you want. Gemini will create a unique, minimalist favicon for you.</p>
                       <div className="flex gap-2">
                           <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Red minimalist fox head" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                           <Button onClick={handleAiGenerate} isLoading={isGenerating} className="shrink-0">Generate</Button>
                       </div>
                       {generatedIcon && (
                           <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden"><img src={generatedIcon} className="w-8 h-8 object-contain" /></div>
                                   <div><p className="text-xs font-bold text-slate-700">Icon Ready!</p></div>
                               </div>
                               <Button size="sm" onClick={() => handleSave(generatedIcon, 'ai')} className="text-xs h-8">Apply</Button>
                           </div>
                       )}
                   </div>
               </Accordion>
            </div>
        </div>
      </main>
      
      {/* Footer */}
      <div className="px-4 py-2 text-center text-[10px] text-slate-400 border-t border-slate-100 bg-white">Favicon Changer v1.1 • Powered by Google Gemini</div>
    </div>
  );
};

export default App;