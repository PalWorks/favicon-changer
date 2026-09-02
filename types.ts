export type MatchType = 'domain' | 'exact_url' | 'regex';

export interface FaviconRule {
  id: string;          // Unique ID (UUID)
  matcher: string;     // The domain, url, or regex string
  matchType: MatchType;
  faviconUrl: string;
  originalUrl?: string; // The source image URL before any edits (for smart layering)
  sourceType: 'emoji' | 'upload' | 'url' | 'custom';
  metadata?: {
    // Badge/Overlay
    mode?: 'overlay' | 'badge';
    overlayColor?: string;
    overlayOpacity?: number;
    badgeText?: string;
    badgeBgColor?: string;
    badgeTextColor?: string;
    badgePosition?: 'top' | 'bottom';

    // Emoji
    emojiChar?: string;

    // Upload
    imageMode?: 'contain' | 'cover' | 'stretch';
  };
  createdAt: number;   // first save; preserved across later edits
  updatedAt?: number;  // last save. Absent on rules written before this existed
}

export interface GlobalSettings {
  defaultFaviconUrl?: string; // Fallback if no site favicon exists
  excludedDomains: string[];  // Hostnames where the extension does nothing
}

export interface StorageData {
  rules: Record<string, FaviconRule>; // Key is ID now, not domain
  settings: GlobalSettings;
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