import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Accordion } from '../Accordion';
import { EMOJI_LIBRARY } from '../../constants';
import { EmojiItem, FaviconRule } from '../../types';

interface EmojiSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    initialValues?: FaviconRule['metadata'];
    onSave: (url: string, type: 'emoji', metadata: FaviconRule['metadata']) => void;
}

export const EmojiSection: React.FC<EmojiSectionProps> = ({ isOpen, onToggle, initialValues, onSave }) => {
    const [emojiSearch, setEmojiSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(EMOJI_LIBRARY[0].id);
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
    const emojiContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialValues?.emojiChar) {
            setSelectedEmoji(initialValues.emojiChar);
        }
    }, [initialValues]);

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
            onSave(dataUrl, 'emoji', { emojiChar: emoji });
        }
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

    return (
        <Accordion title="Select Emoji" icon="😀" isOpen={isOpen} onToggle={onToggle}>
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
    );
};
