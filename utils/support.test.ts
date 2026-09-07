import { describe, it, expect } from 'vitest';
import {
    MAILTO_LIMIT,
    SUPPORT_EMAIL,
    SupportContext,
    browserLabel,
    buildDiagnosticsBlock,
    buildSupportBody,
    buildSupportMailto,
    buildSupportSubject,
} from './support';

const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0';
const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0';
const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15';

const ctx = (over: Partial<SupportContext> = {}): SupportContext => ({
    version: '1.4.3',
    userAgent: CHROME_UA,
    platform: 'Linux x86_64',
    ruleCount: 7,
    loggingEnabled: false,
    ...over,
});

/** The body as the mail client will actually receive it. */
const bodyOf = (url: string): string =>
    decodeURIComponent(url.slice(url.indexOf('&body=') + '&body='.length));

const subjectOf = (url: string): string =>
    decodeURIComponent(url.slice(url.indexOf('?subject=') + '?subject='.length, url.indexOf('&body=')));

describe('browserLabel', () => {
    it('names Chrome and its major version', () => {
        expect(browserLabel(CHROME_UA)).toBe('Chrome 152');
    });

    // Every Chromium browser claims Chrome too, so the order of the patterns is
    // the whole behaviour here. Edge reporting itself as Chrome would send us
    // looking at the wrong browser.
    it('names Edge rather than Chrome', () => {
        expect(browserLabel(EDGE_UA)).toBe('Edge 152');
    });

    it('names Firefox', () => {
        expect(browserLabel(FIREFOX_UA)).toBe('Firefox 154');
    });

    it('names Safari from its Version token, not its WebKit build', () => {
        expect(browserLabel(SAFARI_UA)).toBe('Safari 18');
    });

    it('says so when it cannot tell', () => {
        expect(browserLabel('some other client')).toBe('Unknown browser');
        expect(browserLabel('')).toBe('Unknown browser');
    });
});

describe('buildDiagnosticsBlock', () => {
    it('carries the version, the browser, the platform and the rule count', () => {
        const block = buildDiagnosticsBlock(ctx());
        expect(block).toContain('Extension: Favicon Changer Ultimate 1.4.3');
        expect(block).toContain('Browser: Chrome 152');
        expect(block).toContain('Platform: Linux x86_64');
        expect(block).toContain('Rules saved: 7');
        expect(block).toContain(CHROME_UA);
    });

    it('reports the logging state both ways', () => {
        expect(buildDiagnosticsBlock(ctx())).toContain('Verbose logging: off');
        expect(buildDiagnosticsBlock(ctx({ loggingEnabled: true }))).toContain('Verbose logging: on');
    });

    it('does not leave an empty platform line', () => {
        expect(buildDiagnosticsBlock(ctx({ platform: '' }))).toContain('Platform: unknown');
    });

    it('never reports zero rules as anything other than zero', () => {
        expect(buildDiagnosticsBlock(ctx({ ruleCount: 0 }))).toContain('Rules saved: 0');
    });
});

describe('buildSupportSubject', () => {
    it('is triageable without opening the mail', () => {
        expect(buildSupportSubject(ctx({ userAgent: EDGE_UA })))
            .toBe('Support request: Favicon Changer Ultimate 1.4.3 on Edge 152');
    });
});

describe('buildSupportBody', () => {
    it('asks the three questions before it states any facts', () => {
        const body = buildSupportBody(ctx());
        expect(body.indexOf('What went wrong?')).toBe(0);
        expect(body.indexOf('Which site was it on?')).toBeLessThan(body.indexOf('Diagnostics'));
        expect(body).toContain('What did you expect to happen instead?');
    });

    it('asks the user to keep the diagnostics', () => {
        expect(buildSupportBody(ctx())).toContain('please keep these');
    });

    it('tells a user with logging off how to turn it on', () => {
        const body = buildSupportBody(ctx({ loggingEnabled: false }));
        expect(body).toContain('turn on Verbose Logging');
    });

    it('does not tell a user with logging already on to turn it on', () => {
        const body = buildSupportBody(ctx({ loggingEnabled: true }));
        expect(body).toContain('already on');
        expect(body).not.toContain('turn on Verbose Logging');
    });

    // Anything outside ASCII costs three encoded characters per byte in the
    // URL, which is budget spent for nothing in a diagnostic mail.
    it('is ASCII, so the encoded URL stays cheap', () => {
        expect(/^[\x20-\x7E\n]*$/.test(buildSupportBody(ctx()))).toBe(true);
    });
});

describe('buildSupportMailto', () => {
    it('addresses the support mailbox', () => {
        expect(buildSupportMailto(ctx()).startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    });

    it('round trips the subject and body a client would parse', () => {
        const url = buildSupportMailto(ctx());
        expect(subjectOf(url)).toBe(buildSupportSubject(ctx()));
        expect(bodyOf(url)).toBe(buildSupportBody(ctx()));
    });

    it('fits the limit on a real user agent, with room to spare', () => {
        const url = buildSupportMailto(ctx());
        expect(url.length).toBeLessThanOrEqual(MAILTO_LIMIT);
    });

    it('fits the limit for every browser tested here', () => {
        [CHROME_UA, EDGE_UA, FIREFOX_UA, SAFARI_UA].forEach(userAgent => {
            expect(buildSupportMailto(ctx({ userAgent })).length).toBeLessThanOrEqual(MAILTO_LIMIT);
        });
    });

    describe('with an absurd user agent', () => {
        // A user agent this long does not happen by accident, but a truncated
        // mailto: fails silently in some clients, so the bound is enforced
        // rather than assumed.
        //
        // The padding sits *before* the Chrome token deliberately, so that
        // shortening from the right destroys it. That is what makes the
        // "keeps naming the browser" case below discriminating: with the
        // padding at the end, the token survives the cut and the case passes
        // whether or not the label is derived from the full string.
        const padded = ctx({
            userAgent: `Mozilla/5.0 (X11; Linux x86_64) ${'x'.repeat(5000)} Chrome/152.0.0.0 Safari/537.36`,
        });

        it('still fits the limit', () => {
            expect(buildSupportMailto(padded).length).toBeLessThanOrEqual(MAILTO_LIMIT);
        });

        it('says that it shortened the string', () => {
            expect(bodyOf(buildSupportMailto(padded))).toContain('(truncated)');
        });

        // The whole reason the browser gets its own derived line: shortening
        // the raw string must not cost us the one fact we need from it.
        it('keeps naming the browser correctly', () => {
            expect(bodyOf(buildSupportMailto(padded))).toContain('Browser: Chrome 152');
            expect(subjectOf(buildSupportMailto(padded))).toContain('on Chrome 152');
        });

        it('keeps the questions and the log instruction', () => {
            const body = bodyOf(buildSupportMailto(padded));
            expect(body).toContain('What went wrong?');
            expect(body).toContain('Verbose Logging');
        });
    });

    it('survives a context with nothing useful in it', () => {
        const url = buildSupportMailto({
            version: '', userAgent: '', platform: '', ruleCount: 0, loggingEnabled: false,
        });
        expect(url.length).toBeLessThanOrEqual(MAILTO_LIMIT);
        expect(bodyOf(url)).toContain('Browser: Unknown browser');
    });
});
