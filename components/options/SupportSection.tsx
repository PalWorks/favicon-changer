import React, { useEffect, useState } from 'react';
import { LOG_ENABLED_KEY, logger } from '../../utils/logger';
import {
    SUPPORT_EMAIL,
    SupportContext,
    buildDiagnosticsBlock,
    buildSupportMailto,
} from '../../utils/support';

/**
 * The support entry point: one link that opens the user's mail client with the
 * report already half written.
 *
 * What it is worth is not the link, which anyone could have typed. It is that
 * the mail arrives carrying the extension version, the browser, the platform
 * and the rule count, none of which a user can be expected to know, and all of
 * which decide whether a report is actionable or a round trip.
 *
 * The diagnostics are shown as well as sent, and the copy button hands back the
 * same block, so nobody has to trust a description of what is being included
 * and nobody without a configured mail client is stuck. What the mail says is
 * decided in utils/support.ts, where it is tested. See ROADMAP R-46.
 */
interface SupportSectionProps {
    /** Rules the user has, from the page that already loaded them. */
    ruleCount: number;
}

/** The running build, not package.json: the user may be on an older copy. */
const extensionVersion = (): string => {
    try {
        return chrome.runtime.getManifest().version || 'unknown';
    } catch (e) {
        // No chrome.* under `npm run dev`.
        return 'dev';
    }
};

/**
 * A short OS string. `navigator.platform` is deprecated but still populated and
 * more specific than the User Agent Client Hints replacement ("Linux x86_64"
 * against "Linux"), so it is preferred and the newer one is the fallback.
 */
const platformLabel = (): string => {
    const hinted = (navigator as any).userAgentData?.platform;
    return navigator.platform || hinted || '';
};

export const SupportSection: React.FC<SupportSectionProps> = ({ ruleCount }) => {
    const [loggingEnabled, setLoggingEnabled] = useState(false);
    const [status, setStatus] = useState('');

    // Watched rather than read once. The toggle lives in the section directly
    // below this one, so a user turning it on and then clicking Contact support
    // would otherwise be sent instructions for turning on something that is
    // already on.
    useEffect(() => {
        if (!globalThis.chrome?.storage?.local) return;

        logger.isEnabled()
            .then(setLoggingEnabled)
            .catch(() => setLoggingEnabled(false));

        const onChanged = (changes: any, area: string) => {
            if (area === 'local' && changes[LOG_ENABLED_KEY]) {
                setLoggingEnabled(!!changes[LOG_ENABLED_KEY].newValue);
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, []);

    const context: SupportContext = {
        version: extensionVersion(),
        userAgent: navigator.userAgent,
        platform: platformLabel(),
        ruleCount,
        loggingEnabled,
    };

    const diagnostics = buildDiagnosticsBlock(context);

    const copyDiagnostics = async () => {
        try {
            await navigator.clipboard.writeText(diagnostics);
            setStatus('Diagnostics copied. Paste them into your mail.');
        } catch (e) {
            logger.warn('[Support] could not copy diagnostics', e);
            setStatus('Could not copy. Select the text below and copy it instead.');
        }
    };

    return (
        <section aria-labelledby="support-heading" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 id="support-heading" className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <svg aria-hidden="true" className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Get help
            </h2>
            <p className="text-sm text-slate-500 mb-4">
                Something not working? Write to us and we will read it. The mail opens in your own
                mail app with the version and browser details already filled in.
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <a
                    href={buildSupportMailto(context)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
                >
                    Contact support
                </a>
                <button
                    onClick={copyDiagnostics}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                    Copy diagnostics
                </button>
                <span className="text-xs text-slate-400">{SUPPORT_EMAIL}</span>
            </div>

            <p role="status" aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-slate-500">
                {status}
            </p>

            <details className="mt-1">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-indigo-600">
                    See exactly what is included
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-600">
                    {diagnostics}
                </pre>
                <p className="mt-2 text-xs text-slate-500">
                    Nothing is sent anywhere until you press send in your own mail app. Logs are
                    never attached automatically: if you want to include one, use Debug Logs below.
                </p>
            </details>
        </section>
    );
};
