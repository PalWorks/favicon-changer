/**
 * Persistent logger that saves logs to chrome.storage.local
 * This helps debug issues where the popup closes/crashes before console logs can be read.
 */

const LOG_KEY = 'debug_logs';
const LOG_ENABLED_KEY = 'enable_debug_logging';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export const logger = {
    async isEnabled(): Promise<boolean> {
        const result = await chrome.storage.local.get(LOG_ENABLED_KEY);
        return !!result[LOG_ENABLED_KEY];
    },

    async setEnabled(enabled: boolean) {
        await chrome.storage.local.set({ [LOG_ENABLED_KEY]: enabled });
    },

    async log(message: string, data?: any, level: LogLevel = LogLevel.INFO) {
        const enabled = await this.isEnabled();

        // Always console log for immediate debugging
        const timestamp = new Date().toISOString();
        const logEntry = `[${level}] ${timestamp}: ${message} ${data ? JSON.stringify(data) : ''}`;

        if (level === LogLevel.ERROR) {
            console.error(logEntry);
        } else if (level === LogLevel.WARN) {
            console.warn(logEntry);
        } else {
            console.log(logEntry);
        }

        // Only save to storage if enabled
        if (!enabled && level !== LogLevel.ERROR) return; // Always log errors? Or strictly follow toggle? User said "enable logging... capture stuff". Let's strictly follow toggle to save space, but maybe errors are critical. Let's follow toggle for everything to be safe on storage, or maybe allow errors always. 
        // User said "clog up storage... thus we need enable/disable". So strictly follow toggle.
        if (!enabled) return;

        try {
            const result = await chrome.storage.local.get(LOG_KEY);
            const logs = (result[LOG_KEY] as string[]) || [];
            logs.push(logEntry);
            // Keep last 1000 logs if enabled (more verbose)
            if (logs.length > 1000) logs.shift();
            await chrome.storage.local.set({ [LOG_KEY]: logs });
        } catch (e) {
            console.error('Failed to save log:', e);
        }
    },

    async info(message: string, data?: any) {
        await this.log(message, data, LogLevel.INFO);
    },

    async debug(message: string, data?: any) {
        await this.log(message, data, LogLevel.DEBUG);
    },

    async warn(message: string, data?: any) {
        await this.log(message, data, LogLevel.WARN);
    },

    async error(message: string, error?: any) {
        await this.log(message, error, LogLevel.ERROR);
    },

    async clear() {
        await chrome.storage.local.remove(LOG_KEY);
        console.log('Logs cleared');
    },

    async getLogs(): Promise<string[]> {
        const result = await chrome.storage.local.get(LOG_KEY);
        return (result[LOG_KEY] as string[]) || [];
    },

    async downloadLogs() {
        const logs = await this.getLogs();
        const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favicon-changer-logs-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
