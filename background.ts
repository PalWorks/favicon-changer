import { logger } from './utils/logger';
import { popupClosesOnFileDialog } from './utils/platform';
import { PENDING_TARGET_KEY, PendingEditorTarget } from './utils/handoff';

logger.info('Background Service Worker Loaded');

const EDITOR_BASE_URL = chrome.runtime.getURL('index.html');
const EDITOR_WINDOW_URL = chrome.runtime.getURL('index.html?expanded=1');

// Decide whether the icon opens the bubble (default_popup) or fires onClicked
// (which we use to open a window). Runs on SW wake, install, and browser start.
async function configureActionForOS() {
    try {
        if (await popupClosesOnFileDialog()) {
            // Empty popup disables the bubble so chrome.action.onClicked fires,
            // and we open a standalone window that survives a file dialog.
            await chrome.action.setPopup({ popup: '' });
            logger.info('[BG] bubble disabled for this OS, icon opens editor window');
        } else {
            await chrome.action.setPopup({ popup: 'index.html' });
            logger.info('[BG] using default popup bubble for this OS');
        }
    } catch (e) {
        logger.error('[BG] configureActionForOS failed', e);
    }
}

// Run on every service-worker activation (most robust for MV3) plus lifecycle events.
configureActionForOS();

chrome.runtime.onInstalled.addListener((details) => {
    logger.info('Extension installed/updated:', details);
    configureActionForOS();
    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    }
});

chrome.runtime.onStartup.addListener(() => {
    configureActionForOS();
});

// Only fires on OSes where we disabled the bubble. Open (or refocus) the editor
// window, pre-targeted to the tab the user clicked from.
chrome.action.onClicked.addListener(async (tab) => {
    try {
        if (tab?.url && /^https?:/i.test(tab.url)) {
            const target: PendingEditorTarget = {
                url: tab.url,
                domain: new URL(tab.url).hostname,
                favIconUrl: tab.favIconUrl || '',
                scope: 'exact_url',
                // no `section` -> the window opens with sections collapsed, like the bubble
            };
            await chrome.storage.local.set({ [PENDING_TARGET_KEY]: target });
        }

        // Refocus an already-open editor window instead of stacking new ones.
        const wins = await chrome.windows.getAll({ populate: true });
        const existing = wins.find(w => (w.tabs || []).some(t => (t.url || '').startsWith(EDITOR_BASE_URL)));
        if (existing) {
            const editorTab = existing.tabs!.find(t => (t.url || '').startsWith(EDITOR_BASE_URL));
            await chrome.windows.update(existing.id!, { focused: true });
            if (editorTab?.id) await chrome.tabs.reload(editorTab.id); // re-read the new target
            return;
        }

        await chrome.windows.create({ url: EDITOR_WINDOW_URL, type: 'popup', width: 460, height: 720, focused: true });
    } catch (e) {
        logger.error('[BG] Failed to open editor window', e);
    }
});
