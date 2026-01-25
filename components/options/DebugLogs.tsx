import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { logger } from '../../utils/logger';

export const DebugLogs: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loggingEnabled, setLoggingEnabled] = useState(false);

    useEffect(() => {
        if (showLogs) {
            logger.getLogs().then(setLogs);
            logger.isEnabled().then(setLoggingEnabled);

            // Poll for logs every 2s if open
            const interval = setInterval(() => {
                logger.getLogs().then(setLogs);
                logger.isEnabled().then(setLoggingEnabled);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [showLogs]);

    const handleToggleLogging = async (enabled: boolean) => {
        await logger.setEnabled(enabled);
        setLoggingEnabled(enabled);
        if (enabled) {
            logger.info('Verbose logging enabled by user');
        }
    };

    const handleCopyLogs = () => {
        navigator.clipboard.writeText(logs.join('\n'));
        alert('Logs copied to clipboard!');
    };

    const handleClearLogs = async () => {
        await logger.clear();
        setLogs([]);
    };

    return (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="text-xl">🐞</span> Debug Logs & Support
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
                                className="sr-only peer"
                                checked={loggingEnabled}
                                onChange={(e) => handleToggleLogging(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <p className="text-xs text-slate-500">
                        If you encounter issues, please download these logs and send them to support.
                    </p>

                    <div className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-green-400 leading-relaxed relative">
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
                            📋 Copy
                        </Button>
                        <Button size="sm" onClick={() => logger.downloadLogs()} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white">
                            💾 Download
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleClearLogs} className="flex-1 text-red-600 hover:bg-red-50">
                            🗑️ Clear
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
};
