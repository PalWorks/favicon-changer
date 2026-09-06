// This file is the Content Script. 

import { FaviconRule, GlobalSettings, StorageData } from './types';
import { logger } from './utils/logger';
import { findBestRule } from './utils/matcher';
import { MAX_STABLE_CHECKS } from './constants';
import { RATING_KEY, dayKey, normalizeRatingState, withActiveDay } from './utils/rating';
import { FaviconObserver, observeFaviconChanges } from './utils/faviconObserver';
import {
  updateFavicon,
  readOriginalFaviconHref,
  removeMarkedFaviconLinks,
  hasFaviconHref,
} from './utils/faviconDom';

// Tracks whether WE have actually mutated this page's favicon. Used so we never
// touch the DOM on pages where no rule applies (which previously disrupted some
// SPAs, e.g. GA4's header component, by churning <head> needlessly).
let hasModified = false;

// Applies our icon and records that we have now touched this page. The DOM work
// itself lives in utils/faviconDom.ts, where it is unit tested; read the note on
// updateFavicon() there before changing how it writes, because mutating the
// tracked link in place is the only thing that repaints a background tab.
function applyFavicon(url: string) {
  if (updateFavicon(url)) hasModified = true;
}

// --- MATCHING ENGINE ---
// (Logic moved to utils/matcher.ts)

let observer: FaviconObserver | null = null;
let intervalId: any = null;

function setupObserver(targetUrl: string) {
  if (observer) observer.disconnect();
  if (intervalId) clearInterval(intervalId);

  const head = document.querySelector('head');
  if (!head) return;

  // A. Mutation observer, for the page taking its icon back. The predicate and
  // the debounce live in utils/faviconObserver.ts so they can be tested; read
  // the note on displacesFavicon() there before changing how ownership of a
  // write is decided. ADR-014.
  observer = observeFaviconChanges(head, targetUrl, () => {
    logger.debug('[Content] Detected external change, re-applying (debounced)...');
    applyFavicon(targetUrl);
    // Re-arm the backup poller in case it had stopped after being stable.
    if (!intervalId) startVerificationInterval(targetUrl);
  });

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
    if (!hasFaviconHref(targetUrl)) {
      logger.debug('[Content] Interval check failed, re-applying...');
      applyFavicon(targetUrl);
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

  originalFaviconUrl = readOriginalFaviconHref();
  if (originalFaviconUrl) {
    logger.debug('[Content] Captured original favicon:', originalFaviconUrl);
  }
}

function restoreOriginalFavicon() {
  if (originalFaviconUrl) {
    logger.info('[Content] Restoring original favicon:', originalFaviconUrl);
    applyFavicon(originalFaviconUrl);
  } else {
    // If no original was found, maybe just remove our custom ones?
    // For now, let's try to remove our marked links
    removeMarkedFaviconLinks();
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

  chrome.storage.local.get(['rules', 'settings', RATING_KEY], (result: StorageData & Record<string, unknown>) => {
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
      applyFavicon(rule.faviconUrl);
      setupObserver(rule.faviconUrl);
      noteActiveDay(result[RATING_KEY]);
    } else if (settings.defaultFaviconUrl) {
      // Deliberately applies to EVERY page with no matching rule, whether or
      // not it has an icon of its own. Telling those two cases apart would need
      // a network request per page (a site can serve /favicon.ico with no
      // <link> tag at all), which the privacy position rules out. The settings
      // copy says so plainly rather than promising otherwise. ROADMAP R-25.
      logger.info(`[Content] Applied Global Default`);
      applyFavicon(settings.defaultFaviconUrl);
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
    }
  });
}

// Records that the extension did something for the user today, which is what
// the review ask is gated on (ROADMAP R-47). Piggybacks on the storage read
// applyRule already makes, and writes at most once a day, so a page load costs
// nothing extra on the 364 other occasions. Never runs once the user has
// answered. Deliberately not called for the global fallback favicon, which
// applies to every unmatched page and would count days the user did nothing.
function noteActiveDay(raw: unknown) {
  try {
    const next = withActiveDay(normalizeRatingState(raw), dayKey());
    if (next) chrome.storage.local.set({ [RATING_KEY]: next });
  } catch (e) {
    logger.debug('[Content] Could not record an active day', e);
  }
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