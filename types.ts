export type MatchType = 'domain' | 'exact_url' | 'regex';
export type Shape = 'circle' | 'square' | 'banner' | 'border';

export interface FaviconRule {
  id: string;          // Unique ID (UUID)
  matcher: string;     // The domain, url, or regex string
  matchType: MatchType;
  faviconUrl: string;
  originalUrl?: string; // The source image URL before any edits (for smart layering)
  sourceType: 'emoji' | 'upload' | 'ai' | 'url' | 'custom';
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

export interface TabInfo {
  id?: number;
  url: string;
  domain: string;
  favIconUrl: string;
}