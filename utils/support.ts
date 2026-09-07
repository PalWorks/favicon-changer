/**
 * The support mail the settings page composes.
 *
 * Pure and free of chrome.* and of the DOM, so the composed subject and body
 * are testable without a browser. The caller collects the facts; this file
 * decides what the mail says. See ROADMAP R-46 and docs/DECISIONS.md ADR-017.
 *
 * Why a mailto: and not a form. A form that posts a name, an address and an
 * attachment to infrastructure we run would make the listing's central claim
 * untrue, and it would need a key the extension cannot keep (see
 * docs/SECURITY.md). A mailto: sends from the user's own mail client: no
 * server, no key, no new network request, and nothing to disclose in the store
 * listing. What it buys us is the half that was missing, which is a report that
 * arrives with the version, the browser and the rule count already in it.
 */

export const SUPPORT_EMAIL = 'support@palworks.ai';

/**
 * Ceiling on the whole composed URL.
 *
 * There is no standard limit, but clients and OS handlers impose their own and
 * some truncate silently rather than refusing, which would lose the tail of the
 * diagnostics without telling the user. 2000 is comfortably under the shortest
 * limit reported in the wild and far more than this body needs.
 */
export const MAILTO_LIMIT = 2000;

export interface SupportContext {
    /** From the manifest, so it is the build the user is actually running. */
    version: string;
    /** navigator.userAgent, verbatim. */
    userAgent: string;
    /** A short OS string, e.g. "Linux x86_64". May be empty. */
    platform: string;
    /** How many rules they have. A user with none has a different problem. */
    ruleCount: number;
    /** Whether verbose logging is on, which decides the instructions below. */
    loggingEnabled: boolean;
}

/**
 * The browser and major version, pulled off the user agent.
 *
 * Order matters: every Chromium browser claims Chrome, so the ones that also
 * announce themselves have to be tested first or Edge reports as Chrome. Brave
 * is deliberately absent: it presents an unmodified Chrome user agent so that
 * it cannot be fingerprinted, and there is nothing here to match on.
 */
export const browserLabel = (userAgent: string): string => {
    const ua = userAgent || '';
    const patterns: [string, RegExp][] = [
        ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
        ['Opera', /OPR\/(\d+)/],
        ['Vivaldi', /Vivaldi\/(\d+)/],
        ['Firefox', /Firefox\/(\d+)/],
        ['Chrome', /Chrome\/(\d+)/],
        ['Safari', /Version\/(\d+).*Safari/],
    ];
    for (const [name, pattern] of patterns) {
        const match = ua.match(pattern);
        if (match) return `${name} ${match[1]}`;
    }
    return 'Unknown browser';
};

/**
 * The facts, as lines the user can read before they send them.
 *
 * Shown as well as sent: the "Copy diagnostics" button hands back exactly this
 * block, so someone without a mail client configured is not stuck, and someone
 * who wants to check what they are sending can.
 *
 * `browser` is a parameter rather than always derived here so that the
 * truncation path in buildSupportMailto() can shorten the user agent string
 * without also degrading the line that names the browser.
 */
export const buildDiagnosticsBlock = (
    ctx: SupportContext,
    browser: string = browserLabel(ctx.userAgent),
): string => [
    `Extension: Favicon Changer Ultimate ${ctx.version}`,
    `Browser: ${browser}`,
    `Platform: ${ctx.platform || 'unknown'}`,
    `User agent: ${ctx.userAgent}`,
    `Rules saved: ${ctx.ruleCount}`,
    `Verbose logging: ${ctx.loggingEnabled ? 'on' : 'off'}`,
].join('\n');

export const buildSupportSubject = (ctx: SupportContext): string =>
    `Support request: Favicon Changer Ultimate ${ctx.version} on ${browserLabel(ctx.userAgent)}`;

/**
 * What the user is asked for, in the order it helps us.
 *
 * The prompts sit at the top because that is where the cursor lands, and the
 * diagnostics below them with a line asking that they be kept, since the first
 * instinct on seeing machine output in a draft is to delete it.
 */
export const buildSupportBody = (
    ctx: SupportContext,
    browser: string = browserLabel(ctx.userAgent),
): string => {
    const logInstruction = ctx.loggingEnabled
        ? 'Verbose logging is already on. Reproduce the problem, then press Download under Debug Logs on the settings page and attach the file to this mail.'
        : 'A log helps a lot. On the settings page, open Debug Logs, turn on Verbose Logging, reproduce the problem, then press Download and attach the file to this mail.';

    return [
        'What went wrong?',
        '',
        '',
        'Which site was it on?',
        '',
        '',
        'What did you expect to happen instead?',
        '',
        '',
        'Diagnostics (please keep these, they save a round trip):',
        buildDiagnosticsBlock(ctx, browser),
        '',
        logInstruction,
        '',
    ].join('\n');
};

/**
 * The composed URL, guaranteed to fit MAILTO_LIMIT.
 *
 * The user agent is the only unbounded field, so it is the one that gets
 * shortened. Nothing of value is lost with it: the browser and its version are
 * already on their own derived line above, which is the reason that line exists
 * rather than leaving support to read the string.
 */
export const buildSupportMailto = (ctx: SupportContext): string => {
    const browser = browserLabel(ctx.userAgent);
    const compose = (userAgent: string): string =>
        `mailto:${SUPPORT_EMAIL}`
        + `?subject=${encodeURIComponent(buildSupportSubject(ctx))}`
        + `&body=${encodeURIComponent(buildSupportBody({ ...ctx, userAgent }, browser))}`;

    const full = compose(ctx.userAgent);
    if (full.length <= MAILTO_LIMIT) return full;

    let ua = ctx.userAgent;
    while (ua.length > 0 && compose(`${ua} (truncated)`).length > MAILTO_LIMIT) {
        ua = ua.slice(0, Math.max(0, ua.length - 32));
    }
    return compose(ua ? `${ua} (truncated)` : 'too long to include');
};
