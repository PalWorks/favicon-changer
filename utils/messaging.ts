import { logger } from './logger';

/**
 * Checks if a URL is restricted (chrome://, about:, edge://, view-source:, chrome web store).
 */
export const isRestrictedUrl = (url?: string): boolean => {
    if (!url) return true; // Treat missing URL as restricted for safety
    try {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol;
        const hostname = urlObj.hostname;

        return protocol === 'chrome:' ||
            protocol === 'chrome-extension:' ||
            protocol === 'edge:' ||
            protocol === 'about:' ||
            protocol === 'view-source:' ||
            (protocol === 'https:' && (hostname === 'chrome.google.com' || hostname === 'chromewebstore.google.com'));
    } catch (e) {
        return true; // Invalid URL is restricted
    }
};

/**
 * Ensures the content script is ready by pinging it.
 * If the ping fails, it injects the content script.
 */
export const ensureContentScriptReady = async (tabId: number, retries = 3): Promise<boolean> => {
    try {
        // Try to ping content script
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        return true;
    } catch (error) {
        if (retries <= 0) {
            logger.error('Content script not ready after retries:', error);
            return false;
        }

        logger.info(`Content script not ready, injecting... (Retries left: ${retries})`);

        // If ping fails, inject the content script
        try {
            // Double check we are not trying to inject into a restricted tab
            const tab = await chrome.tabs.get(tabId);
            
            // Check for restricted URLs
            if (isRestrictedUrl(tab.url)) {
                logger.warn(`Skipping injection for restricted URL: ${tab.url}`);
                return false;
            }

            // Check for file:// URLs without permission
            if (tab.url && tab.url.startsWith('file:')) {
                const isAllowed = await new Promise<boolean>(resolve => 
                    chrome.extension.isAllowedFileSchemeAccess(resolve)
                );
                if (!isAllowed) {
                    logger.warn(`Skipping injection for file URL (access denied): ${tab.url}`);
                    return false;
                }
            }

            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });

            // Give it a moment to initialize (increased to 200ms)
            await new Promise(resolve => setTimeout(resolve, 200));

            // Recursively check again with one less retry
            return ensureContentScriptReady(tabId, retries - 1);
        } catch (injectError: any) {
            // Reduce log level for expected permission errors
            if (injectError?.message?.includes('Cannot access contents of the page')) {
                logger.warn('Skipping injection (permission denied):', injectError.message);
            } else {
                logger.error('Failed to inject content script:', injectError);
            }
            return false;
        }
    }
};

/**
 * Sends a message to a tab.
 *
 * `inject` controls whether a missing content script is worth injecting. It is
 * right for the tab the user is looking at, where the change should be visible
 * immediately. It is wrong for a broadcast across every open tab: injection
 * costs a scripting call and up to three retries per tab, and a tab without a
 * live content script will read the new rules on its next load anyway.
 */
export const sendMessageToTab = async (tabId: number, message: any, options: { inject?: boolean } = {}): Promise<void> => {
    const { inject = true } = options;

    if (inject) {
        const isReady = await ensureContentScriptReady(tabId);
        if (!isReady) return;
    }

    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
        if (inject) {
            logger.error('Failed to send message even after injection:', e);
        } else {
            // Ordinary: no content script listening in that tab yet.
            logger.debug('No content script in tab, it will pick up rules on next load:', tabId);
        }
    }
};
