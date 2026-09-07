import React from 'react';

/**
 * The popup's title bar: import, export and a way into the settings page.
 * Drawn only in the toolbar bubble and the expanded window; the settings page
 * has its own header.
 */
interface EditorHeaderProps {
    importInputRef: React.RefObject<HTMLInputElement | null>;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    onOpenSettings: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    importInputRef, onImportFile, onExport, onOpenSettings,
}) => (
    <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <img src="icons/logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-contain" />
            <h1 className="text-lg font-bold text-slate-800">Favicon Changer Ultimate</h1>
        </div>

        <div className="flex gap-1">
            <input
                type="file"
                ref={importInputRef}
                className="hidden"
                accept=".json"
                aria-label="Choose a rules JSON file to import"
                onChange={onImportFile}
            />

            <button
                onClick={() => importInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Import Rules" aria-label="Import rules from a JSON file"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </button>
            <button
                onClick={onExport}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Export Rules" aria-label="Export rules to a JSON file"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1 self-center"></div>
            <button
                onClick={onOpenSettings}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                title="Open Dashboard & Settings" aria-label="Open settings"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
    </header>
);
