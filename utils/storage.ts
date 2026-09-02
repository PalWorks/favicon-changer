import { FaviconRule, GlobalSettings, MatchType, StorageData, TabInfo } from '../types';
import { validateImportedRules, RejectedRule } from './importRules';
import { IS_DEV } from '../constants';
import { logger } from './logger';

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

export interface ImportReport {
  success: boolean;
  /** Rules written to storage. */
  count: number;
  /** Of those, how many fetch their icon from a remote address on every apply. */
  remoteCount: number;
  /** Individual rules that failed validation, with the reason for each. */
  rejected: RejectedRule[];
  /** Set when the file as a whole was unusable. */
  fatal?: string;
}

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

export const importRulesFromJson = async (jsonString: string): Promise<ImportReport> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    logger.error('Import failed: not valid JSON', e);
    return { success: false, count: 0, remoteCount: 0, rejected: [], fatal: 'That file is not valid JSON.' };
  }

  // All the "is this allowed" logic lives in utils/importRules.ts, pure and
  // unit tested. This function only persists what came back.
  const outcome = validateImportedRules(parsed);

  if (outcome.fatal) {
    logger.warn('Import rejected', { fatal: outcome.fatal });
    return { success: false, count: 0, remoteCount: 0, rejected: outcome.rejected, fatal: outcome.fatal };
  }

  const count = Object.keys(outcome.accepted).length;
  if (count === 0) {
    logger.warn('Import rejected: no valid rules', { rejected: outcome.rejected.length });
    return {
      success: false,
      count: 0,
      remoteCount: 0,
      rejected: outcome.rejected,
      fatal: 'No rules in that file could be read.',
    };
  }

  try {
    const { rules: currentRules, settings } = await getStorageData();
    await persistData({ rules: { ...currentRules, ...outcome.accepted }, settings });
  } catch (e: any) {
    logger.error('Import failed to persist', e);
    const isQuota = e?.message?.toLowerCase().includes('quota');
    return {
      success: false,
      count: 0,
      remoteCount: 0,
      rejected: outcome.rejected,
      fatal: isQuota ? 'Not enough storage space. Delete some rules and try again.' : 'Could not save the imported rules.',
    };
  }

  notifyTabs();
  logger.info('Rules imported', { count, rejected: outcome.rejected.length, remoteCount: outcome.remoteCount });

  return { success: true, count, remoteCount: outcome.remoteCount, rejected: outcome.rejected };
};

import { sendMessageToTab, isRestrictedUrl } from './messaging';

/**
 * Tells open tabs that the rules changed.
 *
 * Deliberately cheap about it. This used to ping every tab and inject a content
 * script into any that did not answer, so one rule save touched every open tab,
 * discarded ones included, and could wake them (LIMITATIONS L-14). Now:
 *
 *   - restricted URLs are skipped, as they always were
 *   - discarded tabs are skipped: they have no live content script and re-run it
 *     when the user next activates them, so there is nothing to update
 *   - only the active tab of each window is worth an injection if its content
 *     script is missing, because that is the one the user is looking at. The
 *     rest are pinged without injection and will read the new rules on their
 *     next load.
 */
export const notifyTabs = () => {
  if (IS_DEV) return;

  chrome.tabs.query({}, (tabs: any[]) => {
    if (chrome.runtime.lastError) {
      logger.warn('[Storage] tabs.query failed:', chrome.runtime.lastError.message);
      return;
    }

    let notified = 0;
    let skipped = 0;

    (tabs || []).forEach(tab => {
      if (!tab.id || isRestrictedUrl(tab.url) || tab.discarded) {
        skipped++;
        return;
      }
      notified++;
      sendMessageToTab(tab.id, { type: 'RulesUpdated' }, { inject: !!tab.active });
    });

    logger.debug('[Storage] Notified tabs of rule change', { notified, skipped });
  });
};

// --- Tab Info ---
// TabInfo lives in types.ts; this file used to declare a second, divergent copy.

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

// --- Storage usage ---

export interface StorageUsage {
  bytes: number;
  quota: number;
  percent: number;
}

// chrome.storage.local's documented default, used when the runtime does not
// expose QUOTA_BYTES. No unlimitedStorage permission is requested, on purpose.
const DEFAULT_LOCAL_QUOTA = 10 * 1024 * 1024;

/**
 * How much of the storage quota the user's rules occupy. Every icon is stored
 * inline as a data URL (ADR-004), so this fills up with use, and until now the
 * only signal was a save failing.
 */
export const getStorageUsage = async (): Promise<StorageUsage> => {
  const quota = DEFAULT_LOCAL_QUOTA;

  if (IS_DEV) {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY) || '';
    return { bytes: raw.length, quota, percent: (raw.length / quota) * 100 };
  }

  return new Promise((resolve) => {
    if (!chrome.storage?.local?.getBytesInUse) {
      resolve({ bytes: 0, quota, percent: 0 });
      return;
    }
    chrome.storage.local.getBytesInUse(null, (bytes: number) => {
      if (chrome.runtime.lastError) {
        logger.warn('[Storage] getBytesInUse failed:', chrome.runtime.lastError.message);
        resolve({ bytes: 0, quota, percent: 0 });
        return;
      }
      const limit = (chrome.storage.local as any).QUOTA_BYTES || quota;
      resolve({ bytes, quota: limit, percent: (bytes / limit) * 100 });
    });
  });
};

// --- Open tabs, for the editor's live pattern preview ---

export interface OpenTab {
  title: string;
  url: string;
  hostname: string;
}

/**
 * The user's open tabs, for showing which ones a prefix or regex pattern would
 * cover before the rule is saved. Restricted URLs are dropped since a rule
 * could never apply there anyway.
 */
export const getOpenTabs = async (): Promise<OpenTab[]> => {
  if (IS_DEV) {
    // Dev mode has no chrome.tabs. These stand in so the pattern preview can be
    // exercised against `npm run dev`.
    return [
      { title: 'Q3 Budget - Google Sheets', url: 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0', hostname: 'docs.google.com' },
      { title: 'Q3 Budget - Google Sheets', url: 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=41', hostname: 'docs.google.com' },
      { title: 'Roadmap - Google Sheets', url: 'https://docs.google.com/spreadsheets/d/ZZZ999/edit', hostname: 'docs.google.com' },
      { title: 'Example', url: 'https://example.com/page', hostname: 'example.com' },
    ];
  }

  return new Promise((resolve) => {
    if (!chrome.tabs || !chrome.tabs.query) {
      resolve([]);
      return;
    }
    chrome.tabs.query({}, (tabs: any[]) => {
      if (chrome.runtime.lastError) {
        logger.warn('[Storage] tabs.query failed:', chrome.runtime.lastError.message);
        resolve([]);
        return;
      }
      const out: OpenTab[] = [];
      (tabs || []).forEach(tab => {
        if (!tab.url || isRestrictedUrl(tab.url)) return;
        let hostname = '';
        try {
          hostname = new URL(tab.url).hostname;
        } catch (e) {
          return;
        }
        out.push({ title: tab.title || hostname, url: tab.url, hostname });
      });
      resolve(out);
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
  scope: MatchType;
  // The pattern, for the prefix and regex scopes whose matcher is not derived
  // from the target page. Without this, handing off mid-edit would lose it.
  matcher?: string;
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