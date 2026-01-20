export type MatchType = 'domain' | 'exact_url' | 'regex';

export interface FaviconRule {
  id: string;          // Unique ID (UUID)
  matcher: string;     // The domain, url, or regex string
  matchType: MatchType;
  faviconUrl: string;
  sourceType: 'emoji' | 'upload' | 'ai' | 'url';
  createdAt: number;
}

export interface GlobalSettings {
  defaultFaviconUrl?: string; // Fallback if no site favicon exists
  enableFileAccessWarning: boolean;
}

export interface StorageData {
  rules: Record<string, FaviconRule>; // Key is ID now, not domain
  settings: GlobalSettings;
}

export enum TabView {
  CURRENT = 'CURRENT',
  MANAGE = 'MANAGE',
  AI = 'AI'
}

export interface GeneratedIcon {
  data: string;
  mimeType: string;
}

export interface EmojiItem {
  char: string;
  keywords: string;
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}