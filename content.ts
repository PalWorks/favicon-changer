// This file is the Content Script. 

declare const chrome: any;

interface FaviconRule {
  id: string;
  matcher: string;
  matchType: 'domain' | 'exact_url' | 'regex';
  faviconUrl: string;
  sourceType: string;
}

interface GlobalSettings {
  defaultFaviconUrl?: string;
}

interface StorageData {
  rules: Record<string, FaviconRule>;
  settings: GlobalSettings;
}

// Change Mark Attribute to prevent observer loops
const CHANGE_MARK = 'data-fc-modified';

// Function to find and replace/update the favicon
function updateFavicon(url: string) {
  const head = document.getElementsByTagName('head')[0];
  if (!head) return;

  // 1. Find all existing favicon links
  const existingLinks = document.querySelectorAll("link[rel*='icon']");

  // 2. Remove them all to avoid conflicts
  existingLinks.forEach(link => {
    // Check if it's already our correct link
    if (link.getAttribute('href') === url && link.getAttribute('rel') === 'icon') {
      // Ensure it's marked as ours
      if (!link.hasAttribute(CHANGE_MARK)) {
        link.setAttribute(CHANGE_MARK, 'true');
      }
    } else {
      link.remove();
    }
  });

  // 3. Ensure our link exists
  // Use Array.from to avoid selector injection attacks with special characters in URL
  const currentLink = Array.from(document.querySelectorAll("link[rel*='icon']"))
    .find(link => link.getAttribute('href') === url);

  if (!currentLink) {
    const link = document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = url;
    link.setAttribute(CHANGE_MARK, 'true');
    head.appendChild(link);
  }
}

// --- MATCHING ENGINE ---
function findBestRule(currentUrl: string, currentDomain: string, rules: Record<string, FaviconRule>): FaviconRule | null {
  const ruleList = Object.values(rules);

  // 1. Exact URL Match (Highest Priority)
  const exactMatch = ruleList.find(r => r.matchType === 'exact_url' && r.matcher === currentUrl);
  if (exactMatch) return exactMatch;

  // 2. Regex Match (Medium Priority)
  const regexMatch = ruleList.find(r => {
    if (r.matchType !== 'regex') return false;
    try {
      const regex = new RegExp(r.matcher);
      return regex.test(currentUrl);
    } catch (e) {
      console.warn('[Favicon Flow] Invalid Regex:', r.matcher);
      return false;
    }
  });
  if (regexMatch) return regexMatch;

  // 3. Domain Match (Lowest Priority)
  const domainMatch = ruleList.find(r => {
    if (r.matchType !== 'domain') return false;
    return currentDomain === r.matcher || currentDomain.endsWith('.' + r.matcher);
  });

  return domainMatch || null;
}

let observer: MutationObserver | null = null;
let intervalId: any = null;

function setupObserver(targetUrl: string) {
  if (observer) observer.disconnect();
  if (intervalId) clearInterval(intervalId);

  const head = document.querySelector('head');
  if (!head) return;

  // A. Mutation Observer for long-term changes
  observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
      // Ignore changes to elements we marked
      if (mutation.target instanceof Element && mutation.target.hasAttribute(CHANGE_MARK)) {
        continue;
      }

      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'LINK') {
            const link = node as HTMLLinkElement;
            // If a new icon is added and it's NOT ours, we need to update
            if (link.rel.includes('icon') && !link.hasAttribute(CHANGE_MARK)) {
              shouldUpdate = true;
            }
          }
        });
      } else if (mutation.type === 'attributes') {
        const link = mutation.target as HTMLLinkElement;
        // If an icon attribute changed and it's NOT ours, update
        if (link.nodeName === 'LINK' && link.rel.includes('icon') && !link.hasAttribute(CHANGE_MARK)) {
          shouldUpdate = true;
        }
      }
    }

    if (shouldUpdate) {
      console.log('[Favicon Flow] Detected external change, re-applying...');
      updateFavicon(targetUrl);
    }
  });

  observer.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });

  // B. Interval Check (Backup for SPAs/Hydration)
  intervalId = setInterval(() => {
    // Safer check avoiding selector injection
    const currentLink = Array.from(document.querySelectorAll("link[rel*='icon']"))
      .find(link => link.getAttribute('href') === targetUrl);

    if (!currentLink) {
      console.log('[Favicon Flow] Interval check failed, re-applying...');
      updateFavicon(targetUrl);
    }
  }, 2000); // Check every 2 seconds
}

let originalFaviconUrl: string | null = null;

function captureOriginalFavicon() {
  if (originalFaviconUrl) return; // Already captured

  const links = document.querySelectorAll("link[rel*='icon']");
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (!link.hasAttribute(CHANGE_MARK)) {
      originalFaviconUrl = link.getAttribute('href');
      console.log('[Favicon Flow] Captured original favicon:', originalFaviconUrl);
      return;
    }
  }
}

function restoreOriginalFavicon() {
  if (originalFaviconUrl) {
    console.log('[Favicon Flow] Restoring original favicon:', originalFaviconUrl);
    updateFavicon(originalFaviconUrl);
  } else {
    // If no original was found, maybe just remove our custom ones?
    // For now, let's try to remove our marked links
    const markedLinks = document.querySelectorAll(`link[${CHANGE_MARK}='true']`);
    markedLinks.forEach(link => link.remove());
    console.log('[Favicon Flow] No original favicon to restore, removed custom links.');
  }
}

// Initial Load Logic
function applyRule() {
  captureOriginalFavicon();

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;

  chrome.storage.local.get(['rules', 'settings'], (result: StorageData) => {
    const rules = result.rules || {};
    const settings = result.settings || {};

    const rule = findBestRule(currentUrl, currentDomain, rules);
    console.log('[Favicon Flow] Checking rules for:', currentUrl, 'Found:', rule);

    if (rule) {
      console.log(`[Favicon Flow] Applied rule: ${rule.matchType} match for ${rule.matcher}`);
      updateFavicon(rule.faviconUrl);
      setupObserver(rule.faviconUrl);
    } else if (settings.defaultFaviconUrl) {
      console.log(`[Favicon Flow] Applied Global Default`);
      updateFavicon(settings.defaultFaviconUrl);
      setupObserver(settings.defaultFaviconUrl);
    } else {
      // No rule matches -> Restore original
      console.log('[Favicon Flow] No rule matched. Restoring original.');
      restoreOriginalFavicon();
      // We might want to disconnect the observer if we are back to normal
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  });
}

// Listen for messages from Popup/Options
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  console.log('[Favicon Flow] Message received:', message);
  if (message.type === 'RulesUpdated') {
    console.log('[Favicon Flow] RulesUpdated received, re-applying rules...');
    applyRule();
  } else if (message.type === 'RESET_ICON') {
    if (observer) observer.disconnect();
    window.location.reload();
  }
});

// Run on start
console.log('[Favicon Changer] Content Script Loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyRule);
} else {
  applyRule();
}