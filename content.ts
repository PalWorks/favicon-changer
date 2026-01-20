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

// Function to find and replace/update the favicon
const updateFavicon = (url: string) => {
  // Find all existing favicon links
  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  
  // Remove existing ones to avoid conflicts
  existingLinks.forEach(link => link.parentNode?.removeChild(link));

  // Create new link
  const link = document.createElement('link');
  link.type = 'image/x-icon';
  link.rel = 'shortcut icon';
  link.href = url;
  document.getElementsByTagName('head')[0].appendChild(link);
};

// --- MATCHING ENGINE ---
const findBestRule = (currentUrl: string, currentDomain: string, rules: Record<string, FaviconRule>): FaviconRule | null => {
    const ruleList = Object.values(rules);
    
    // 1. Exact URL Match (Highest Priority)
    const exactMatch = ruleList.find(r => r.matchType === 'exact_url' && r.matcher === currentUrl);
    if (exactMatch) return exactMatch;

    // 2. Regex Match (Medium Priority)
    // We filter for regex types, then test them.
    // If multiple regex match, we pick the first one found (UI should ideally allow reordering, but simply finding one is usually enough)
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
    // We match if the hostname ends with the matcher (e.g. 'mail.google.com' matches 'google.com' rule)
    // OR strict equality.
    const domainMatch = ruleList.find(r => {
        if (r.matchType !== 'domain') return false;
        return currentDomain === r.matcher || currentDomain.endsWith('.' + r.matcher);
    });
    
    return domainMatch || null;
};

// Initial Load Logic
const applyRule = async () => {
  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;
  
  chrome.storage.local.get(['rules', 'settings'], (result: StorageData) => {
    const rules = result.rules || {};
    const settings = result.settings || {};
    
    const rule = findBestRule(currentUrl, currentDomain, rules);

    if (rule) {
      console.log(`[Favicon Flow] Applied rule: ${rule.matchType} match for ${rule.matcher}`);
      updateFavicon(rule.faviconUrl);
      setupObserver(rule.faviconUrl);
    } else if (settings.defaultFaviconUrl) {
       // Apply global fallback if no specific rule exists
       // But only if the site doesn't have one? Or always?
       // Requirement says: "Choose your own default favicon to use if none exists"
       // Checking if "none exists" is hard because browsers hide it. 
       // We will assume if this setting is ON, we want to enforce it for non-matched sites.
       console.log(`[Favicon Flow] Applied Global Default`);
       updateFavicon(settings.defaultFaviconUrl);
       setupObserver(settings.defaultFaviconUrl);
    }
  });
};

let observer: MutationObserver | null = null;

const setupObserver = (targetUrl: string) => {
  if (observer) observer.disconnect();

  const head = document.querySelector('head');
  if (!head) return;

  observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'LINK') {
            const link = node as HTMLLinkElement;
            if ((link.rel.includes('icon')) && link.href !== targetUrl) {
              shouldUpdate = true;
            }
          }
        });
      } else if (mutation.type === 'attributes') {
         const link = mutation.target as HTMLLinkElement;
         if (link.nodeName === 'LINK' && link.rel.includes('icon') && link.href !== targetUrl) {
           shouldUpdate = true;
         }
      }
    }

    if (shouldUpdate) {
       observer?.disconnect();
       updateFavicon(targetUrl);
       if(observer) observer.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    }
  });

  observer.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
};

// Listen for messages from Popup/Options
chrome.runtime.onMessage.addListener((message: any) => {
  if (message.type === 'RulesUpdated') {
      applyRule();
  } else if (message.type === 'RESET_ICON') {
      if(observer) observer.disconnect();
      window.location.reload(); 
  }
});

// Run on start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRule);
} else {
    applyRule();
}