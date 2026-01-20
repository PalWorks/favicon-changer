import React from 'react';

interface FaviconPreviewProps {
  url: string;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

export const FaviconPreview: React.FC<FaviconPreviewProps> = ({ url, size = 'md', alt = "Favicon" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-16 h-16"
  };

  return (
    <div className={`relative overflow-hidden rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center p-1 ${sizes[size]}`}>
       {url ? (
         <img src={url} alt={alt} className="max-w-full max-h-full object-contain" />
       ) : (
         <div className="text-slate-200 bg-slate-50 w-full h-full flex items-center justify-center">
            <span className="text-xs">?</span>
         </div>
       )}
    </div>
  );
};