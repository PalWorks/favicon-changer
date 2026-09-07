import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Accordion } from '../Accordion';
import { EMOJI_LIBRARY } from '../../constants';
import { EmojiItem, FaviconRule } from '../../types';
import { logger } from '../../utils/logger';

interface EmojiSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    initialValues?: FaviconRule['metadata'];
    onSave: (url: string, type: 'emoji', metadata: FaviconRule['metadata']) => Promise<void>;
    /**
     * Locks the grid while a save is in flight. Picking an emoji IS the save
     * here, with no Apply button to disable, so two quick clicks used to start
     * two saves at once; one of them was then lost to the read-modify-write
     * race in storage (ROADMAP R-65).
     */
    isSaving?: boolean;
}

/**
 * One emoji in the grid. Extracted because the grid is rendered twice, once
 * filtered and once by category, and the two copies of this markup had to be
 * kept identical by hand.
 */
const EmojiButton: React.FC<{
    emoji: EmojiItem;
    selected: boolean;
    disabled?: boolean;
    onPick: (char: string) => void;
}> = ({ emoji, selected, disabled, onPick }) => (
    <button
        onClick={() => onPick(emoji.char)}
        disabled={disabled}
        aria-label={`Use ${emoji.keywords.split(' ')[0]} emoji`}
        title={emoji.keywords}
        className={`text-2xl h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-wait ${selected ? 'bg-indigo-50 ring-2 ring-indigo-500' : ''}`}
    >
        {emoji.char}
    </button>
);

export const EmojiSection: React.FC<EmojiSectionProps> = ({ isOpen, onToggle, initialValues, onSave, isSaving }) => {
    const [emojiSearch, setEmojiSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(EMOJI_LIBRARY[0].id);
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
    const emojiContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialValues?.emojiChar) {
            setSelectedEmoji(initialValues.emojiChar);
        }
    }, [initialValues]);

    const saveEmoji = async (emoji: string) => {
        setSelectedEmoji(emoji);
        const canvas = document.createElement('canvas');
        // 128px to match every other icon source. This was 64px, which was
        // visibly softer than an uploaded icon on a high-DPI display, and left
        // no headroom for tall glyphs.
        const SIZE = 128;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // 84% of the canvas, leaving room for glyphs that overshoot their
            // em box (hearts and flags are the usual offenders).
            ctx.font = `${Math.round(SIZE * 0.84)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Nudged down slightly: 'middle' sits emoji a touch high in practice.
            ctx.fillText(emoji, SIZE / 2, SIZE / 2 + SIZE * 0.03);
            const dataUrl = canvas.toDataURL('image/png');
            try {
                await onSave(dataUrl, 'emoji', { emojiChar: emoji });
            } catch (e) {
                logger.error('Emoji save failed:', e);
            }
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
        <Accordion title="Select Emoji" icon={<svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} isOpen={isOpen} onToggle={onToggle}>
            <div className="flex flex-col h-[300px]">
                <div className="mb-2 relative">
                    <input type="text" aria-label="Search emojis" placeholder="Search emojis..." value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500" />
                    <span className="absolute left-3 top-2.5 text-slate-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
                </div>
                {!emojiSearch && (
                    <div className="flex items-center gap-1 mb-2 overflow-x-auto no-scrollbar border-b border-slate-100 pb-1">
                        {EMOJI_LIBRARY.map(cat => (
                            <button key={cat.id} onClick={() => scrollToCategory(cat.id)} aria-label={`Jump to ${cat.name}`} className={`flex-1 py-1.5 px-3 text-lg rounded-lg transition-all text-center flex items-center justify-center shrink-0 ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-md scale-105' : 'hover:bg-slate-100 text-slate-500 grayscale opacity-70 hover:grayscale-0 hover:opacity-100'}`} title={cat.name}>{cat.icon}</button>
                        ))}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto pr-1 relative" ref={emojiContainerRef} onScroll={handleEmojiScroll}>
                    {filteredEmojis ? (
                        <div className="grid grid-cols-6 gap-2">
                            {filteredEmojis.map((emoji, idx) => (
                                <EmojiButton
                                    key={`${emoji.char}-${idx}`}
                                    emoji={emoji}
                                    selected={selectedEmoji === emoji.char}
                                    disabled={isSaving}
                                    onPick={saveEmoji}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 pt-1">
                            {EMOJI_LIBRARY.map(category => (
                                <div key={category.id} id={`category-${category.id}`}>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">{category.name}</h4>
                                    <div className="grid grid-cols-6 gap-2">
                                        {category.emojis.map((emoji, idx) => (
                                            <EmojiButton
                                                key={`${category.id}-${emoji.char}-${idx}`}
                                                emoji={emoji}
                                                selected={selectedEmoji === emoji.char}
                                                disabled={isSaving}
                                                onPick={saveEmoji}
                                            />
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
