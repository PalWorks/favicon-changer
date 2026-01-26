import { logger } from './utils/logger';

// Initialize logger
logger.info('Background Service Worker Loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    logger.info('Extension installed/updated:', details);
    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    }
});

// Keep the service worker alive for a bit if needed (though usually event-driven is best)
// For now, we just log to confirm it's running.
