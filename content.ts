// This file is the Content Script. 

declare const chrome: any;

import { FaviconRule, GlobalSettings, StorageData } from './types';
import { logger } from './utils/logger';
import { findBestRule } from './utils/matcher';
import { OBSERVER_DEBOUNCE_MS } from './constants';

// Change Mark Attribute to prevent observer loops
const CHANGE_MARK = 'data-fc-modified';

// Tracks whether WE have actually mutated this page's favicon. Used so we never
// touch the DOM on pages where no rule applies (which previously disrupted some
// SPAs, e.g. GA4's header component, by churning <head> needlessly).
let hasModified = false;

// Function to find and replace/update the favicon.
// We reuse an existing <link> node in place where possible instead of
// remove-then-recreate, to minimize <head> mutations that can disrupt
// frameworks that read or observe the favicon during boot.
function updateFavicon(url: string) {
  const head = document.getElementsByTagName('head')[0];
  if (!head) return;

  // Use Array.from to avoid selector injection with special characters in URL.
  const iconLinks = Array.from(document.querySelectorAll("link[rel*='icon']")) as HTMLLinkElement[];

  // 1. Is there already a link pointing at our target URL?
  let ourLink = iconLinks.find(link => link.getAttribute('href') === url);

  if (ourLink) {
    // Normalize + mark it as ours without recreating the node.
    if (ourLink.getAttribute('rel') !== 'icon') ourLink.setAttribute('rel', 'icon');
    if (!ourLink.hasAttribute(CHANGE_MARK)) ourLink.setAttribute(CHANGE_MARK, 'true');
  } else {
    // 2. Repurpose an existing icon link in place (prefer one we already own).
    const reusable = iconLinks.find(link => link.hasAttribute(CHANGE_MARK)) || iconLinks[0];
    if (reusable) {
      reusable.setAttribute('type', 'image/png');
      reusable.setAttribute('rel', 'icon');
      reusable.setAttribute('href', url);
      reusable.setAttribute(CHANGE_MARK, 'true');
      ourLink = reusable;
    } else {
      const link = document.createElement('link');
      link.type = 'image/png';
      link.rel = 'icon';
      link.href = url;
      link.setAttribute(CHANGE_MARK, 'true');
      head.appendChild(link);
      ourLink = link;
      logger.debug('[Content] Appended new favicon link');
    }
    hasModified = true;
  }

  // 3. Remove any remaining icon links so the browser can't pick a stale one.
  iconLinks.forEach(link => {
    if (link !== ourLink) {
      link.remove();
      hasModified = true;
    }
  });
}

// --- MATCHING ENGINE ---
// (Logic moved to utils/matcher.ts)

let observer: MutationObserver | null = null;
let intervalId: any = null;
let observerDebounceTimer: any = null;

function setupObserver(targetUrl: string) {
  if (observer) observer.disconnect();
  if (intervalId) clearInterval(intervalId);
  if (observerDebounceTimer) clearTimeout(observerDebounceTimer);

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
      // Debounce: coalesce rapid mutation bursts (e.g. SPA re-hydration) into
      // a single updateFavicon call to avoid thrashing the event loop.
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(() => {
        logger.debug('[Content] Detected external change, re-applying (debounced)...');
        updateFavicon(targetUrl);
      }, OBSERVER_DEBOUNCE_MS);
    }
  });

  observer.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });

  // B. Interval Check (Backup for SPAs/Hydration)
  intervalId = setInterval(() => {
    // Safer check avoiding selector injection
    const currentLink = Array.from(document.querySelectorAll("link[rel*='icon']"))
      .find(link => link.getAttribute('href') === targetUrl);

    if (!currentLink) {
      logger.debug('[Content] Interval check failed, re-applying...');
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
      logger.debug('[Content] Captured original favicon:', originalFaviconUrl);
      return;
    }
  }
}

function restoreOriginalFavicon() {
  if (originalFaviconUrl) {
    logger.info('[Content] Restoring original favicon:', originalFaviconUrl);
    updateFavicon(originalFaviconUrl);
  } else {
    // If no original was found, maybe just remove our custom ones?
    // For now, let's try to remove our marked links
    const markedLinks = document.querySelectorAll(`link[${CHANGE_MARK}='true']`);
    markedLinks.forEach(link => link.remove());
    logger.info('[Content] No original favicon to restore, removed custom links.');
  }
  // We are back to the original state; further no-rule re-applies are no-ops.
  hasModified = false;
}

// Initial Load Logic
function applyRule() {
  captureOriginalFavicon();

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;

  if (!chrome.storage || !chrome.storage.local) {
    logger.warn('[Content] chrome.storage.local is not available. Skipping rule application.');
    return;
  }

  chrome.storage.local.get(['rules', 'settings'], (result: StorageData) => {
    const rules = result.rules || {};
    const settings = (result.settings || {}) as GlobalSettings;

    const rule = findBestRule(currentUrl, currentDomain, Object.values(rules));
    logger.debug('[Content] Checking rules for:', { currentUrl, ruleFound: !!rule });

    if (rule) {
      logger.info(`[Content] Applied rule: ${rule.matchType} match for ${rule.matcher}`);
      updateFavicon(rule.faviconUrl);
      setupObserver(rule.faviconUrl);
    } else if (settings.defaultFaviconUrl) {
      logger.info(`[Content] Applied Global Default`);
      updateFavicon(settings.defaultFaviconUrl);
      setupObserver(settings.defaultFaviconUrl);
    } else {
      // No rule matches. Only restore if WE previously changed this page.
      // On a normal page where the extension was never active, do nothing at
      // all so we never disturb the host page's favicon or <head>.
      if (hasModified) {
        logger.debug('[Content] No rule matched. Restoring original.');
        restoreOriginalFavicon();
      } else {
        logger.debug('[Content] No rule matched and page untouched. Leaving favicon as-is.');
      }
      // Tear down all polling/observation now that the extension is inactive.
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (observerDebounceTimer) {
        clearTimeout(observerDebounceTimer);
        observerDebounceTimer = null;
      }
    }
  });
}

// Listen for messages from Popup/Options
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  logger.debug('[Content] Message received:', message);
  if (message.type === 'PING') {
    // Responds to ensureContentScriptReady() in messaging.ts so the caller
    // knows the content script is loaded without needing a script injection.
    sendResponse({ ok: true });
  } else if (message.type === 'RulesUpdated') {
    logger.info('[Content] RulesUpdated received, re-applying rules...');
    applyRule();
    sendResponse({ ok: true });
  } else if (message.type === 'RESET_ICON') {
    sendResponse({ ok: true });
    if (observer) observer.disconnect();
    window.location.reload();
  }
});

// Run on start
logger.info('[Content] Content Script Loaded');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyRule);
} else {
  applyRule();
}