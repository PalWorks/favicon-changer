import { FaviconRule, GlobalSettings, StorageData } from '../types';
import { IS_DEV } from '../constants';
import { logger } from './logger';

declare const chrome: any;

const MOCK_STORAGE_KEY = 'favicon_flow_mock_storage';

// Generate a simple unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const DEFAULT_SETTINGS: GlobalSettings = {
  excludedDomains: [],
};

export const getStorageData = async (): Promise<StorageData> => {
  if (IS_DEV) {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    return data ? JSON.parse(data) : { rules: {}, settings: DEFAULT_SETTINGS };
  }

  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.local) {
      logger.warn('chrome.storage.local is not available. Using default settings.');
      resolve({ rules: {}, settings: DEFAULT_SETTINGS });
      return;
    }
    chrome.storage.local.get(['rules', 'settings', 'migrated'], (result: any) => {
      let rules = result.rules || {};
      const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
      const alreadyMigrated = result.migrated === true;

      // --- MIGRATION LOGIC (Old Domain-Key format to New ID-Key format) ---
      if (!alreadyMigrated) {
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
            chrome.storage.local.set({ rules: migratedRules, migrated: true }, () => {
              if (chrome.runtime.lastError) {
                logger.error('[Storage] Migration persist failed:', chrome.runtime.lastError.message);
              } else {
                logger.info('Migration completed successfully.');
              }
            });
            rules = migratedRules;
          } else {
            // Mark as migrated so we never re-run this scan.
            chrome.storage.local.set({ migrated: true }, () => {
              if (chrome.runtime.lastError) {
                logger.error('[Storage] Migration flag failed:', chrome.runtime.lastError.message);
              }
            });
          }
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
  notifyTabs();
};

const persistData = async (data: StorageData): Promise<void> => {
  if (IS_DEV) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
    return;
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
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

export const importRulesFromJson = async (jsonString: string): Promise<{ success: boolean; count: number; remoteCount: number }> => {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) return { success: false, count: 0, remoteCount: 0 };

    // Validate items
    let validCount = 0;
    let remoteCount = 0; // rules whose favicon is a remote URL (fetched on apply)
    const validatedRules: Record<string, FaviconRule> = {};

    Object.values(parsed).forEach((item: any) => {
      if (item.id && item.matcher && item.faviconUrl) {
        validatedRules[item.id] = item;
        validCount++;
        // A non-data: favicon is fetched from its origin every time the rule
        // applies — worth flagging since an imported file could point anywhere.
        if (!String(item.faviconUrl).startsWith('data:')) remoteCount++;
      }
    });

    if (validCount === 0) return { success: false, count: 0, remoteCount: 0 };

    const { rules: currentRules, settings } = await getStorageData();
    const mergedRules = { ...currentRules, ...validatedRules };

    await persistData({ rules: mergedRules, settings });
    notifyTabs();

    return { success: true, count: validCount, remoteCount };
  } catch (e) {
    logger.error("Import failed", e);
    return { success: false, count: 0, remoteCount: 0 };
  }
};

import { sendMessageToTab, isRestrictedUrl } from './messaging';

export const notifyTabs = () => {
  if (!IS_DEV) {
    chrome.tabs.query({}, (tabs: any[]) => {
      if (chrome.runtime.lastError) {
        logger.warn('[Storage] tabs.query failed:', chrome.runtime.lastError.message);
        return;
      }
      tabs.forEach(tab => {
        if (tab.id && !isRestrictedUrl(tab.url)) {
          sendMessageToTab(tab.id, { type: 'RulesUpdated' });
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
              logger.warn('Failed to scrape favicon:', err);
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

// --- Editor handoff (popup -> standalone window) ---
//
// The toolbar action popup auto-closes the instant it loses focus. On Linux
// (and intermittently on Windows/macOS) opening a native file-picker dialog
// blurs the popup, so the popup is destroyed before the user can pick a file
// -> the upload silently aborts with no feedback. To make uploads reliable on
// every OS we hand the current target off to a real extension window, which
// does NOT close on blur, and run the file picker there.

const PENDING_TARGET_KEY = 'pendingEditorTarget';

export interface PendingEditorTarget {
  url: string;
  domain: string;
  favIconUrl: string;
  scope: 'domain' | 'exact_url';
  // Optional: when the window is opened from the toolbar icon (not a Browse
  // handoff) no section is pre-opened, mirroring the collapsed bubble.
  section?: 'upload' | 'emoji' | 'badge';
}

export const setPendingEditorTarget = async (target: PendingEditorTarget): Promise<void> => {
  if (IS_DEV) {
    localStorage.setItem(PENDING_TARGET_KEY, JSON.stringify(target));
    return;
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [PENDING_TARGET_KEY]: target }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
};

export const consumePendingEditorTarget = async (): Promise<PendingEditorTarget | null> => {
  if (IS_DEV) {
    const raw = localStorage.getItem(PENDING_TARGET_KEY);
    if (raw) localStorage.removeItem(PENDING_TARGET_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get(PENDING_TARGET_KEY, (result: any) => {
      const target = (result && result[PENDING_TARGET_KEY]) || null;
      if (target) chrome.storage.local.remove(PENDING_TARGET_KEY);
      resolve(target);
    });
  });
};

/**
 * Opens the editor in a standalone popup window pre-targeted to `target`.
 * Used by the action popup to escape the popup-closes-on-file-dialog trap so
 * that file uploads work reliably across Windows, macOS and Linux.
 */
export const openExpandedEditor = async (target: PendingEditorTarget): Promise<void> => {
  await setPendingEditorTarget(target);
  const url = chrome.runtime.getURL('index.html?expanded=1');
  try {
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
      chrome.windows.create({ url, type: 'popup', width: 460, height: 720, focused: true });
      return;
    }
  } catch (e) {
    logger.warn('windows.create failed, falling back to tab:', e);
  }
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
};

export const openOptionsPage = () => {
  // Check if running in extension context
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    window.open(chrome.runtime.getURL('options.html'));
  } else {
    // Fallback for dev environment or if APIs are missing
    logger.info("Opening Options Page (Simulated)");
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