import React from 'react';

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({ 
  title, 
  isOpen, 
  onToggle, 
  children,
  icon
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-3 transition-all duration-200">
      <button 
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isOpen ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
            {icon && <span className="text-xl">{icon}</span>}
            <span className={`font-medium ${isOpen ? 'text-indigo-700' : 'text-slate-700'}`}>{title}</span>
        </div>
        <svg 
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-white animate-in slide-in-from-top-2 duration-200">
            {children}
        </div>
      )}
    </div>
  );
};
