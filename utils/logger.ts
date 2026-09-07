/**
 * Persistent logger that saves logs to chrome.storage.local
 * This helps debug issues where the popup closes/crashes before console logs can be read.
 */

const LOG_KEY = 'debug_logs';
// Exported so a reader can watch it on storage.onChanged rather than polling
// (the support mail states whether logging is on, and a stale answer there
// sends the user the wrong instructions).
export const LOG_ENABLED_KEY = 'enable_debug_logging';

// Ring buffer size for the persisted log.
const MAX_LOG_LINES = 1000;

// How long entries are held in memory before being written as one batch. Every
// line used to be its own read-modify-write of the whole array, so concurrent
// writers (the content script and the popup) overwrote each other and lost
// entries, exactly when the log was being relied on (LIMITATIONS L-16). Kept
// short because the popup dies on blur and would take a pending batch with it.
const FLUSH_DELAY_MS = 250;

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
        } catch { /* onChanged unavailable in this context, ignore */ }
    }
    return initPromise;
};

// --- Batched persistence ---

let pending: string[] = [];
let flushTimer: any = null;
// Flushes are chained rather than run concurrently, so two of them can never
// interleave their read-modify-write of the log array.
let flushChain: Promise<void> = Promise.resolve();

const flushNow = (): Promise<void> => {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (!pending.length) return flushChain;

    const batch = pending;
    pending = [];

    flushChain = flushChain.then(async () => {
        try {
            const result = await chrome.storage.local.get(LOG_KEY);
            const logs = (result[LOG_KEY] as string[]) || [];
            logs.push(...batch);
            // splice, not shift: a batch can push the array several entries past
            // the cap, and shift would only drop one of them.
            if (logs.length > MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES);
            await chrome.storage.local.set({ [LOG_KEY]: logs });
        } catch (e) {
            console.error('Failed to save logs:', e);
        }
    });

    return flushChain;
};

const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushNow();
    }, FLUSH_DELAY_MS);
};

// The popup is destroyed the moment it loses focus, so anything still pending
// would be lost with it. Not available in the service worker, hence the guard.
try {
    if (typeof addEventListener === 'function') {
        addEventListener('pagehide', () => { flushNow(); });
    }
} catch { /* no window in this context */ }

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

        pending.push(logEntry);
        // Guard against unbounded growth if a flush keeps failing.
        if (pending.length > MAX_LOG_LINES) pending.splice(0, pending.length - MAX_LOG_LINES);
        scheduleFlush();
    },

    /** Writes any buffered entries immediately. */
    async flush() {
        await flushNow();
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
        pending = [];
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        await chrome.storage.local.remove(LOG_KEY);
        console.log('Logs cleared');
    },

    async getLogs(): Promise<string[]> {
        // Include anything still buffered, so the viewer never looks stale.
        const result = await chrome.storage.local.get(LOG_KEY);
        const stored = (result[LOG_KEY] as string[]) || [];
        return pending.length ? [...stored, ...pending] : stored;
    },

    async downloadLogs() {
        await flushNow();
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
