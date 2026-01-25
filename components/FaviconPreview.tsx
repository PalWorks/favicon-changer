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

  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [url]);

  return (
    <div className={`relative overflow-hidden rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center p-1 ${sizes[size]}`}>
      {url && !hasError ? (
        <img
          src={url}
          alt={alt}
          className="max-w-full max-h-full object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="text-slate-300 bg-slate-50 w-full h-full flex items-center justify-center">
          {/* Generic Globe Icon */}
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
      )}
    </div>
  );
};