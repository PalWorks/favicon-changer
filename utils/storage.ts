import { FaviconRule, GlobalSettings, StorageData } from '../types';
import { IS_DEV } from '../constants';

declare const chrome: any;

const MOCK_STORAGE_KEY = 'favicon_flow_mock_storage';

// Generate a simple unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const DEFAULT_SETTINGS: GlobalSettings = {
  enableFileAccessWarning: true
};

export const getStorageData = async (): Promise<StorageData> => {
  if (IS_DEV) {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    return data ? JSON.parse(data) : { rules: {}, settings: DEFAULT_SETTINGS };
  }

  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.local) {
      console.warn('chrome.storage.local is not available. Using default settings.');
      resolve({ rules: {}, settings: DEFAULT_SETTINGS });
      return;
    }
    chrome.storage.local.get(['rules', 'settings'], (result: any) => {
      let rules = result.rules || {};
      const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

      // --- MIGRATION LOGIC (Old Domain-Key format to New ID-Key format) ---
      let hasMigrated = false;
      const migratedRules: Record<string, FaviconRule> = {};

      // Check if rules look like the old format (where key == domain in the object)
      // Old: { "google.com": { domain: "google.com", ... } }
      // New: { "uuid-123": { id: "uuid-123", matcher: "google.com", matchType: "domain", ... } }

      Object.entries(rules).forEach(([key, val]: [string, any]) => {
        if (!val.id || !val.matcher) {
          // This is an old rule
          hasMigrated = true;
          const newId = generateId();
          migratedRules[newId] = {
            id: newId,
            matcher: val.domain || key,
            matchType: 'domain', // Default old rules to domain match
            faviconUrl: val.faviconUrl,
            sourceType: val.type || 'upload',
            createdAt: val.createdAt || Date.now()
          };
        } else {
          migratedRules[key] = val;
        }
      });

      if (hasMigrated) {
        chrome.storage.local.set({ rules: migratedRules });
        rules = migratedRules;
      }
      // -------------------------------------------------------------------

      resolve({ rules, settings });
    });
  });
};

export const saveRule = async (rule: FaviconRule): Promise<void> => {
  const { rules, settings } = await getStorageData();

  // If editing, overwrite. If new, add.
  const updatedRules = { ...rules, [rule.id]: rule };

  await persistData({ rules: updatedRules, settings });

  // Notify content script
  notifyTabs();
};

export const deleteRule = async (id: string): Promise<void> => {
  const { rules, settings } = await getStorageData();
  const { [id]: _, ...remainingRules } = rules;

  await persistData({ rules: remainingRules, settings });
  notifyTabs();
};

export const saveSettings = async (settings: GlobalSettings): Promise<void> => {
  const data = await getStorageData();
  await persistData({ ...data, settings });
};

const persistData = async (data: StorageData): Promise<void> => {
  if (IS_DEV) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
    return;
  }
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
};

// --- Import / Export Utilities ---

export const exportRulesAsJson = async () => {
  const { rules } = await getStorageData();
  // Export just the rules map
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rules, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `favicon-flow-rules-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

export const importRulesFromJson = async (jsonString: string): Promise<{ success: boolean; count: number }> => {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) return { success: false, count: 0 };

    // Validate items
    let validCount = 0;
    const validatedRules: Record<string, FaviconRule> = {};

    Object.values(parsed).forEach((item: any) => {
      if (item.id && item.matcher && item.faviconUrl) {
        validatedRules[item.id] = item;
        validCount++;
      }
    });

    if (validCount === 0) return { success: false, count: 0 };

    const { rules: currentRules, settings } = await getStorageData();
    const mergedRules = { ...currentRules, ...validatedRules };

    await persistData({ rules: mergedRules, settings });
    notifyTabs();

    return { success: true, count: validCount };
  } catch (e) {
    console.error("Import failed", e);
    return { success: false, count: 0 };
  }
};

import { sendMessageToTab, isRestrictedUrl } from './messaging';

export const notifyTabs = () => {
  if (!IS_DEV) {
    chrome.tabs.query({}, (tabs: any[]) => {
      tabs.forEach(tab => {
        if (tab.id) {
          if (!isRestrictedUrl(tab.url)) {
            // console.log(`Notifying tab ${tab.id} (${tab.url})`);
            sendMessageToTab(tab.id, { type: 'RulesUpdated' });
          } else {
             // console.log(`Skipping restricted tab ${tab.id} (${tab.url})`);
          }
        }
      });
    });
  }
};

// --- Tab Info ---

export interface TabInfo {
  url: string;
  domain: string;
  favIconUrl: string;
}

export const getCurrentTabInfo = async (): Promise<TabInfo> => {
  if (IS_DEV) {
    return { url: 'https://example.com/page', domain: 'example.com', favIconUrl: '' };
  }

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs: any[]) => {
      if (tabs[0]?.url) {
        try {
          const urlObj = new URL(tabs[0].url);
          let favIconUrl = tabs[0].favIconUrl || '';

          // Fallback: If no favicon in metadata, try to scrape it
          // But skip restricted URLs to avoid errors
          const isRestricted = isRestrictedUrl(tabs[0].url);

          if (!favIconUrl && tabs[0].id && !isRestricted) {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                  const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
                  return link ? link.href : '';
                }
              });
              if (results && results[0] && results[0].result) {
                favIconUrl = results[0].result;
              }
            } catch (err) {
              console.warn('Failed to scrape favicon:', err);
            }
          }

          resolve({
            url: tabs[0].url,
            domain: urlObj.hostname,
            favIconUrl: favIconUrl
          });
        } catch (e) {
          resolve({ url: '', domain: '', favIconUrl: '' });
        }
      } else {
        resolve({ url: '', domain: '', favIconUrl: '' });
      }
    });
  });
};

export const openOptionsPage = () => {
  // Check if running in extension context
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    window.open(chrome.runtime.getURL('options.html'));
  } else {
    // Fallback for dev environment or if APIs are missing
    console.log("Opening Options Page (Simulated)");
    window.open('/options.html', '_blank');
  }
};

export const isAllowedFileSchemeAccess = async (): Promise<boolean> => {
  if (IS_DEV) return true;
  return new Promise((resolve) => {
    // chrome.extension.isAllowedFileSchemeAccess is the correct API, 
    // but we should guard against it being undefined in some contexts.
    if (typeof chrome !== 'undefined' && chrome.extension && chrome.extension.isAllowedFileSchemeAccess) {
      chrome.extension.isAllowedFileSchemeAccess((isAllowed: boolean) => {
        resolve(isAllowed);
      });
    } else {
      // Default to true or false depending on desired behavior if API is missing
      resolve(false);
    }
  });
};