/**
 * Persistent logger that saves logs to chrome.storage.local
 * This helps debug issues where the popup closes/crashes before console logs can be read.
 */

const LOG_KEY = 'debug_logs';

export const logger = {
    async log(message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[INFO] ${timestamp}: ${message} ${data ? JSON.stringify(data) : ''}`;
        console.log(logEntry); // Keep console log for real-time debugging

        try {
            const result = await chrome.storage.local.get(LOG_KEY);
            const logs = (result[LOG_KEY] as string[]) || [];
            logs.push(logEntry);
            // Keep last 50 logs
            if (logs.length > 50) logs.shift();
            await chrome.storage.local.set({ [LOG_KEY]: logs });
        } catch (e) {
            console.error('Failed to save log:', e);
        }
    },

    async error(message: string, error?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[ERROR] ${timestamp}: ${message} ${error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : ''}`;
        console.error(logEntry);

        try {
            const result = await chrome.storage.local.get(LOG_KEY);
            const logs = (result[LOG_KEY] as string[]) || [];
            logs.push(logEntry);
            if (logs.length > 50) logs.shift();
            await chrome.storage.local.set({ [LOG_KEY]: logs });
        } catch (e) {
            console.error('Failed to save error log:', e);
        }
    },

    async clear() {
        await chrome.storage.local.remove(LOG_KEY);
        console.log('Logs cleared');
    },

    async getLogs(): Promise<string[]> {
        const result = await chrome.storage.local.get(LOG_KEY);
        return (result[LOG_KEY] as string[]) || [];
    }
};
