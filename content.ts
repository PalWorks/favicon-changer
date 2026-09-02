// This file is the Content Script. 

import { FaviconRule, GlobalSettings, StorageData } from './types';
import { logger } from './utils/logger';
import { findBestRule } from './utils/matcher';
import { OBSERVER_DEBOUNCE_MS, MAX_STABLE_CHECKS } from './constants';

// Change Mark Attribute to prevent observer loops
const CHANGE_MARK = 'data-fc-modified';

// Tracks whether WE have actually mutated this page's favicon. Used so we never
// touch the DOM on pages where no rule applies (which previously disrupted some
// SPAs, e.g. GA4's header component, by churning <head> needlessly).
let hasModified = false;

// Function to find and replace/update the favicon.
//
// IMPORTANT — why we mutate an EXISTING link's href instead of recreating nodes:
// Chrome only re-paints a tab-strip favicon from a DOM change in two situations:
//   (a) the tab is the active/foreground tab, OR
//   (b) the `href` of a <link> element Chrome is ALREADY TRACKING is mutated.
// Adding a brand-new <link> (or remove-then-append) is NOT picked up for
// background/inactive tabs — Chrome keeps showing the load-time favicon until
// the tab is reloaded. This was verified empirically: an href mutation repaints
// a background tab, a fresh-node insert does not. (It's also how sites like
// Gmail update their unread-count favicon while in the background.)
// So we always repurpose the existing tracked icon link in place; only when a
// page has no icon link at all do we create one.
function updateFavicon(url: string) {
  const head = document.getElementsByTagName('head')[0];
  if (!head) return;

  // Use Array.from to avoid selector injection with special characters in URL.
  const iconLinks = Array.from(document.querySelectorAll("link[rel*='icon']")) as HTMLLinkElement[];

  // Reuse the element Chrome is already tracking — prefer one we own, else the
  // page's own first icon link (the one Chrome started tracking at load).
  let ourLink = iconLinks.find(link => link.hasAttribute(CHANGE_MARK)) || iconLinks[0];

  if (ourLink) {
    // Mutating href on the tracked element is what triggers the repaint
    // (including on background tabs). Skip the write if it's already correct so
    // re-applies of an unchanged icon don't cause a needless tab-icon flash.
    if (ourLink.getAttribute('href') !== url) ourLink.setAttribute('href', url);
    if (ourLink.getAttribute('rel') !== 'icon') ourLink.setAttribute('rel', 'icon');
    if (!ourLink.hasAttribute(CHANGE_MARK)) ourLink.setAttribute(CHANGE_MARK, 'true');
  } else {
    // No icon link exists on the page — create one. (Active tabs repaint
    // immediately; a background tab with no prior favicon may not repaint until
    // it is next activated, which is an acceptable edge case.)
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    link.setAttribute(CHANGE_MARK, 'true');
    head.appendChild(link);
    ourLink = link;
    logger.debug('[Content] Appended new favicon link');
  }
  hasModified = true;

  // Remove any remaining icon links so the browser can't pick a stale one.
  iconLinks.forEach(link => {
    if (link !== ourLink) link.remove();
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
        // Re-arm the backup poller in case it had stopped after being stable.
        if (!intervalId) startVerificationInterval(targetUrl);
      }, OBSERVER_DEBOUNCE_MS);
    }
  });

  observer.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });

  // B. Interval Check (Backup for SPAs/Hydration). Self-stops once stable.
  startVerificationInterval(targetUrl);
}

// Backup poller: re-applies our favicon if the page swaps it out. Once it has
// been stable for MAX_STABLE_CHECKS consecutive ticks it stops itself, so we
// don't keep waking up the event loop forever on quiet pages. The
// MutationObserver re-arms it (above) if the favicon is later changed.
function startVerificationInterval(targetUrl: string) {
  if (intervalId) clearInterval(intervalId);
  let stableChecks = 0;
  intervalId = setInterval(() => {
    // Safer check avoiding selector injection
    const currentLink = Array.from(document.querySelectorAll("link[rel*='icon']"))
      .find(link => link.getAttribute('href') === targetUrl);

    if (!currentLink) {
      logger.debug('[Content] Interval check failed, re-applying...');
      updateFavicon(targetUrl);
      stableChecks = 0;
    } else if (++stableChecks >= MAX_STABLE_CHECKS) {
      clearInterval(intervalId);
      intervalId = null;
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

// Initial Load Logic. Also re-run on RulesUpdated; updateFavicon() mutates the
// tracked icon link's href in place, which repaints the tab (active OR
// background) without a page reload — see the note on updateFavicon().
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

    // Per-site exclusion list: leave the page completely untouched.
    if (settings.excludedDomains?.includes(currentDomain)) {
      logger.debug('[Content] Domain is excluded. Leaving favicon as-is.');
      return;
    }

    const rule = findBestRule(currentUrl, currentDomain, Object.values(rules));
    logger.debug('[Content] Checking rules for:', { currentUrl, ruleFound: !!rule });

    if (rule) {
      logger.info(`[Content] Applied rule: ${rule.matchType} match for ${rule.matcher}`);
      updateFavicon(rule.faviconUrl);
      setupObserver(rule.faviconUrl);
    } else if (settings.defaultFaviconUrl) {
      // Deliberately applies to EVERY page with no matching rule, whether or
      // not it has an icon of its own. Telling those two cases apart would need
      // a network request per page (a site can serve /favicon.ico with no
      // <link> tag at all), which the privacy position rules out. The settings
      // copy says so plainly rather than promising otherwise. ROADMAP R-25.
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

// --- INITIALISATION ---
//
// Latch against a second copy of this script initialising in the same page
// context. This script is declared in the manifest for <all_urls>, AND
// ensureContentScriptReady() injects it on demand for tabs the declaration
// never reached (see DECISIONS ADR-008). A PING that races a still-loading tab
// fails, so the caller injects, and the page can end up running two copies.
// Without this latch that leaves two MutationObservers, two backup intervals
// and two onMessage listeners live in one page (LIMITATIONS L-13); the extra
// listener also breaks the sendResponse contract, since both would reply.
const fcuWindow = window as unknown as { __fcuContentLoaded?: boolean };

if (fcuWindow.__fcuContentLoaded) {
  logger.debug('[Content] Already initialised in this context, skipping duplicate injection');
} else {
  fcuWindow.__fcuContentLoaded = true;

  // Listen for messages from Popup/Options
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    logger.debug('[Content] Message received:', message);
    if (message.type === 'PING') {
      // Responds to ensureContentScriptReady() in messaging.ts so the caller
      // knows the content script is loaded without needing a script injection.
      sendResponse({ ok: true });
    } else if (message.type === 'RulesUpdated') {
      logger.info('[Content] RulesUpdated received, re-applying rules...');
      applyRule(); // href mutation repaints the tab (active or background) without reload
      sendResponse({ ok: true });
    }
  });

  // Run on start
  logger.info('[Content] Content Script Loaded');
  if (document.readyState === 'loading') {
    // Wrap so the DOMContentLoaded Event object isn't passed to applyRule().
    document.addEventListener('DOMContentLoaded', () => applyRule());
  } else {
    applyRule();
  }
}