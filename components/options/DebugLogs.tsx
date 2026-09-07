import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { logger } from '../../utils/logger';

export const DebugLogs: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loggingEnabled, setLoggingEnabled] = useState(false);

    useEffect(() => {
        if (!showLogs) return undefined;

        const refresh = () => {
            logger.getLogs().then(setLogs);
            logger.isEnabled().then(setLoggingEnabled);
        };
        refresh();
        // Polled rather than watched: entries arrive from the content script and
        // the service worker as well as this page, and the log is a debugging
        // surface the user has deliberately opened, so 2s is cheap and correct.
        const interval = setInterval(refresh, 2000);
        return () => clearInterval(interval);
    }, [showLogs]);

    const handleToggleLogging = async (enabled: boolean) => {
        await logger.setEnabled(enabled);
        setLoggingEnabled(enabled);
        if (enabled) {
            logger.info('Verbose logging enabled by user');
        }
    };

    const handleCopyLogs = async () => {
        // Awaited: this used to claim success before the write had resolved, so
        // a refused clipboard (no permission, no focus) still said "copied".
        try {
            await navigator.clipboard.writeText(logs.join('\n'));
            alert('Logs copied to clipboard.');
        } catch (e) {
            logger.warn('[Logs] clipboard write refused', e);
            alert('Could not copy. Use Download instead, or select the log text above.');
        }
    };

    const handleClearLogs = async () => {
        await logger.clear();
        setLogs([]);
    };

    return (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a7 7 0 1114 0v3a5 5 0 01-5 5h-4a5 5 0 01-5-5v-3z" /></svg> Debug Logs
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setShowLogs(!showLogs)}>
                    {showLogs ? 'Hide Logs' : 'Show Logs'}
                </Button>
            </div>

            {showLogs && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                            <p className="text-sm font-medium text-slate-700">Enable Verbose Logging</p>
                            <p className="text-xs text-slate-500">Capture detailed logs for troubleshooting. Disable when not in use to save memory.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                aria-label="Enable verbose logging"
                                className="sr-only peer"
                                checked={loggingEnabled}
                                onChange={(e) => handleToggleLogging(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <p className="text-xs text-slate-500">
                        Download the log and attach it to a support mail. Use Get help above to compose one with the version details already filled in.
                    </p>

                    <div role="log" aria-label="Debug log output" className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-green-400 leading-relaxed relative">
                        {!loggingEnabled && logs.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900/50 backdrop-blur-sm">
                                <p>Logging is disabled.</p>
                            </div>
                        )}
                        {logs.length === 0 ? (
                            <span className="text-slate-500 italic">No logs recorded yet.</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="border-b border-slate-800/50 pb-1 mb-1 last:border-0 break-all whitespace-pre-wrap">{log}</div>
                            ))
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleCopyLogs} className="flex-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> Copy
                        </Button>
                        <Button size="sm" onClick={() => logger.downloadLogs()} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> Download
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleClearLogs} className="flex-1 text-red-600 hover:bg-red-50">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Clear
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
};
