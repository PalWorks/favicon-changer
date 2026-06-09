import { logger } from './utils/logger';

logger.info('Background Service Worker Loaded');

// OSes where Chrome closes the toolbar action popup the moment a native
// file-picker dialog opens (which silently aborts uploads). On these we skip
// the bubble entirely and open the editor as a standalone window instead — the
// window is the same UI as the bubble but survives file dialogs. On Windows/
// macOS the bubble is kept (it stays open during the dialog).
const POPUP_CLOSES_ON_DIALOG = new Set(['linux', 'cros', 'openbsd']);

const EDITOR_BASE_URL = chrome.runtime.getURL('index.html');
const EDITOR_WINDOW_URL = chrome.runtime.getURL('index.html?expanded=1');
const PENDING_TARGET_KEY = 'pendingEditorTarget';

// Decide whether the icon opens the bubble (default_popup) or fires onClicked
// (which we use to open a window). Runs on SW wake, install, and browser start.
async function configureActionForOS() {
    try {
        const { os } = await chrome.runtime.getPlatformInfo();
        if (POPUP_CLOSES_ON_DIALOG.has(os)) {
            // Empty popup disables the bubble so chrome.action.onClicked fires.
            await chrome.action.setPopup({ popup: '' });
            logger.info(`[BG] ${os}: bubble disabled, icon opens editor window`);
        } else {
            await chrome.action.setPopup({ popup: 'index.html' });
            logger.info(`[BG] ${os}: using default popup bubble`);
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
            const target = {
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
