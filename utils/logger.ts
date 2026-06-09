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

// Cache the "logging enabled" flag in memory so we don't hit chrome.storage on
// every single log call (the content script logs on hot paths on every page).
// The cache is initialized once per context and kept fresh via storage.onChanged.
let enabledCache: boolean | null = null;
let initPromise: Promise<void> | null = null;

const ensureInit = (): Promise<void> => {
    if (enabledCache !== null) return Promise.resolve();
    if (!initPromise) {
        initPromise = chrome.storage.local.get(LOG_ENABLED_KEY)
            .then((r: any) => { enabledCache = !!r[LOG_ENABLED_KEY]; })
            .catch(() => { enabledCache = false; });
        // Keep the cache in sync if the toggle changes in another context.
        try {
            chrome.storage.onChanged.addListener((changes: any, area: string) => {
                if (area === 'local' && changes[LOG_ENABLED_KEY]) {
                    enabledCache = !!changes[LOG_ENABLED_KEY].newValue;
                }
            });
        } catch { /* onChanged unavailable in this context — ignore */ }
    }
    return initPromise;
};

export const logger = {
    async isEnabled(): Promise<boolean> {
        await ensureInit();
        return !!enabledCache;
    },

    async setEnabled(enabled: boolean) {
        enabledCache = enabled; // update cache immediately
        await chrome.storage.local.set({ [LOG_ENABLED_KEY]: enabled });
    },

    async log(message: string, data?: any, level: LogLevel = LogLevel.INFO) {
        await ensureInit();
        const enabled = !!enabledCache;

        // Errors always go to the console; everything else only when the user
        // has opted into verbose logging (keeps page consoles quiet by default).
        if (!enabled && level !== LogLevel.ERROR) return;

        const timestamp = new Date().toISOString();

        let dataStr = '';
        if (data) {
            if (data instanceof Error) {
                dataStr = JSON.stringify({ message: data.message, stack: data.stack, name: data.name });
            } else {
                dataStr = JSON.stringify(data);
            }
        }

        const logEntry = `[${level}] ${timestamp}: ${message} ${dataStr}`;

        if (level === LogLevel.ERROR) {
            console.error(logEntry);
        } else if (level === LogLevel.WARN) {
            console.warn(logEntry);
        } else {
            console.log(logEntry);
        }

        // Persist to storage only while logging is enabled.
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
