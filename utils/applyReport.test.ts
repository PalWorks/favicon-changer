import { describe, it, expect, vi } from 'vitest';
import {
    ApplyReport,
    SaveVerification,
    TabCandidate,
    decideApply,
    describeSaveOutcome,
    isApplyReport,
    pickTargetTab,
} from './applyReport';
import { FaviconRule, GlobalSettings, MatchType } from '../types';

vi.mock('./logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

const rule = (over: Partial<FaviconRule> = {}): FaviconRule => ({
    id: 'r1',
    matcher: 'example.com',
    matchType: 'domain',
    faviconUrl: 'data:image/png;base64,AAAA',
    sourceType: 'emoji',
    createdAt: 1,
    ...over,
});

const settings = (over: Partial<GlobalSettings> = {}): GlobalSettings => ({
    excludedDomains: [],
    ...over,
});

// --- decideApply ------------------------------------------------------------
//
// This is the branching that used to live inline in content.ts. It is extracted
// so that what the page does and what it reports come from one decision, which
// is the whole point of R-61: two copies of this, one to act and one to
// describe, is the shape of the bug being removed.

describe('decideApply', () => {
    it('excludes before matching, even when a rule would have matched', () => {
        const decision = decideApply(
            'https://example.com/page',
            'example.com',
            [rule()],
            settings({ excludedDomains: ['example.com'] }),
        );
        expect(decision.kind).toBe('excluded');
    });

    it('excludes before the fallback, so an excluded page gets nothing at all', () => {
        const decision = decideApply(
            'https://example.com/page',
            'example.com',
            [],
            settings({ excludedDomains: ['example.com'], defaultFaviconUrl: 'https://cdn/x.png' }),
        );
        expect(decision.kind).toBe('excluded');
    });

    it('returns the winning rule, not merely that one matched', () => {
        const broad = rule({ id: 'broad', matcher: 'example.com', matchType: 'domain' });
        const exact = rule({ id: 'exact', matcher: 'https://example.com/page', matchType: 'exact_url' });
        const decision = decideApply('https://example.com/page', 'example.com', [broad, exact], settings());
        expect(decision).toEqual({ kind: 'rule', rule: exact });
    });

    it('falls back only when nothing matched', () => {
        const decision = decideApply(
            'https://other.com/',
            'other.com',
            [rule()],
            settings({ defaultFaviconUrl: 'https://cdn/x.png' }),
        );
        expect(decision).toEqual({ kind: 'fallback', url: 'https://cdn/x.png' });
    });

    it('does nothing when nothing matches and there is no fallback', () => {
        expect(decideApply('https://other.com/', 'other.com', [rule()], settings()).kind).toBe('none');
    });

    it('survives settings written before excludedDomains existed', () => {
        // Storage really can hold this shape; the runtime read is untyped.
        const legacy = {} as GlobalSettings;
        expect(decideApply('https://example.com/', 'example.com', [rule()], legacy).kind).toBe('rule');
    });

    it('ignores a paused rule, so pausing one reveals the fallback', () => {
        const decision = decideApply(
            'https://example.com/',
            'example.com',
            [rule({ enabled: false })],
            settings({ defaultFaviconUrl: 'https://cdn/x.png' }),
        );
        expect(decision.kind).toBe('fallback');
    });
});

// --- isApplyReport ----------------------------------------------------------
//
// Load-bearing across an extension update: a tab still running the previous
// content script answers `{ok:true}`, which is not a report and must not be
// read as a confirmation.

describe('isApplyReport', () => {
    it('accepts every status the content script can send', () => {
        ['applied', 'fallback', 'excluded', 'none', 'unavailable'].forEach(status => {
            expect(isApplyReport({ status })).toBe(true);
        });
    });

    it('rejects the previous content script\'s {ok:true} reply', () => {
        expect(isApplyReport({ ok: true })).toBe(false);
    });

    it('rejects an unknown status rather than trusting it', () => {
        expect(isApplyReport({ status: 'done' })).toBe(false);
        expect(isApplyReport({ status: 42 })).toBe(false);
    });

    it('rejects an inherited property name, since the reply is untrusted', () => {
        // A page can reply with anything. `'toString' in set` would be true.
        expect(isApplyReport({ status: 'toString' })).toBe(false);
        expect(isApplyReport({ status: 'constructor' })).toBe(false);
        expect(isApplyReport({ status: 'hasOwnProperty' })).toBe(false);
    });

    it('rejects everything that is not an object with a status', () => {
        [null, undefined, '', 'applied', 0, [], true].forEach(value => {
            expect(isApplyReport(value)).toBe(false);
        });
    });
});

// --- pickTargetTab ----------------------------------------------------------

const tab = (over: Partial<TabCandidate> = {}): TabCandidate => ({
    id: 1,
    url: 'https://example.com/page',
    hostname: 'example.com',
    active: false,
    discarded: false,
    ...over,
});

describe('pickTargetTab', () => {
    it('returns null when no open tab matches', () => {
        expect(pickTargetTab([tab({ url: 'https://other.com/', hostname: 'other.com' })], 'domain', 'example.com'))
            .toBeNull();
    });

    it('returns null when the only matching tab is discarded', () => {
        // A discarded tab holds no content script and re-runs the whole apply
        // path when the user activates it, so there is nothing to confirm.
        expect(pickTargetTab([tab({ discarded: true })], 'domain', 'example.com')).toBeNull();
    });

    it('prefers an active tab over an inactive one, whatever the order', () => {
        const inactive = tab({ id: 1 });
        const active = tab({ id: 2, active: true });
        expect(pickTargetTab([inactive, active], 'domain', 'example.com')?.id).toBe(2);
        expect(pickTargetTab([active, inactive], 'domain', 'example.com')?.id).toBe(2);
    });

    it('never prefers an active tab that does not match', () => {
        const activeElsewhere = tab({ id: 2, active: true, url: 'https://other.com/', hostname: 'other.com' });
        const matching = tab({ id: 3 });
        expect(pickTargetTab([activeElsewhere, matching], 'domain', 'example.com')?.id).toBe(3);
    });

    it('falls back to the first matching tab when none is active', () => {
        expect(pickTargetTab([tab({ id: 7 }), tab({ id: 8 })], 'domain', 'example.com')?.id).toBe(7);
    });

    it.each<[MatchType, string]>([
        ['domain', 'example.com'],
        ['prefix', 'https://example.com/'],
        ['exact_url', 'https://example.com/page'],
        ['regex', '^https://example\\.com/'],
    ])('matches with the %s scope', (matchType, matcher) => {
        expect(pickTargetTab([tab()], matchType, matcher)?.id).toBe(1);
    });
});

// --- describeSaveOutcome ----------------------------------------------------
//
// Tests assert on `kind`, not on wording, so copy can be edited without
// rewriting the suite. The one thing checked in the text is that the page name
// appears where the message promises to name it.

const verification = (over: Partial<SaveVerification> = {}): SaveVerification => ({
    savedRuleId: 'r1',
    targetLabel: 'example.com',
    checkedTab: true,
    report: { status: 'applied', ruleId: 'r1', painted: true } as ApplyReport,
    ...over,
});

describe('describeSaveOutcome', () => {
    it('confirms only when the page says it applied this exact rule', () => {
        const outcome = describeSaveOutcome(verification());
        expect(outcome.kind).toBe('confirmed');
        expect(outcome.tone).toBe('success');
        expect(outcome.fix).toBeUndefined();
    });

    it('reports a broken icon address before anything else, because no reload fixes it', () => {
        // Deliberately paired with the case that would otherwise confirm: the
        // rule did apply, and the icon still will not appear.
        const outcome = describeSaveOutcome(verification({ iconLoaded: false }));
        expect(outcome.kind).toBe('icon-failed');
        expect(outcome.tone).toBe('warning');
    });

    it('does not report a broken icon when the probe could not decide', () => {
        expect(describeSaveOutcome(verification({ iconLoaded: undefined })).kind).toBe('confirmed');
    });

    it('confirms when the probe says the address loads', () => {
        expect(describeSaveOutcome(verification({ iconLoaded: true })).kind).toBe('confirmed');
    });

    it('says the rule is waiting when no matching tab is open', () => {
        const outcome = describeSaveOutcome(verification({ checkedTab: false, report: null }));
        expect(outcome.kind).toBe('not-open');
        expect(outcome.tone).toBe('warning');
    });

    it('asks for a reload when a tab was asked and did not answer', () => {
        const outcome = describeSaveOutcome(verification({ report: null }));
        expect(outcome.kind).toBe('unconfirmed');
        expect(outcome.text).toContain('example.com');
    });

    it('treats an unreachable chrome.storage in the page as unconfirmed', () => {
        expect(describeSaveOutcome(verification({ report: { status: 'unavailable' } })).kind)
            .toBe('unconfirmed');
    });

    it('explains an excluded site and offers to unexclude it', () => {
        const outcome = describeSaveOutcome(verification({ report: { status: 'excluded' } }));
        expect(outcome.kind).toBe('excluded');
        expect(outcome.fix).toEqual({ kind: 'unexclude', domain: 'example.com' });
    });

    it('offers no unexclude button when it does not know which domain to remove', () => {
        const outcome = describeSaveOutcome(verification({ report: { status: 'excluded' }, targetLabel: '' }));
        expect(outcome.kind).toBe('excluded');
        expect(outcome.fix).toBeUndefined();
        expect(outcome.text).toContain('that page');
    });

    it('says so when the page reports that nothing matches it', () => {
        expect(describeSaveOutcome(verification({ report: { status: 'none' } })).kind).toBe('unmatched');
    });

    it('says so when the page is showing the global fallback instead', () => {
        expect(describeSaveOutcome(verification({ report: { status: 'fallback' } })).kind).toBe('fallback');
    });

    it('reports a shadowed rule when a different rule won', () => {
        const outcome = describeSaveOutcome(verification({
            report: { status: 'applied', ruleId: 'someone-else', painted: true },
        }));
        expect(outcome.kind).toBe('shadowed');
        expect(outcome.tone).toBe('warning');
    });

    it('does not confirm a rule that applied but could not be written to the page', () => {
        expect(describeSaveOutcome(verification({
            report: { status: 'applied', ruleId: 'r1', painted: false },
        })).kind).toBe('not-painted');
    });

    it('still confirms when an older report carries no painted flag', () => {
        expect(describeSaveOutcome(verification({ report: { status: 'applied', ruleId: 'r1' } })).kind)
            .toBe('confirmed');
    });

    it('prefers shadowed over not-painted, since the winning rule is the useful fact', () => {
        expect(describeSaveOutcome(verification({
            report: { status: 'applied', ruleId: 'other', painted: false },
        })).kind).toBe('shadowed');
    });

    it('never calls anything but a confirmation a success', () => {
        const reports: (ApplyReport | null)[] = [
            null,
            { status: 'excluded' },
            { status: 'none' },
            { status: 'fallback' },
            { status: 'unavailable' },
            { status: 'applied', ruleId: 'other' },
            { status: 'applied', ruleId: 'r1', painted: false },
        ];
        reports.forEach(report => {
            expect(describeSaveOutcome(verification({ report })).tone).toBe('warning');
        });
    });

    it('falls back to a neutral name when the page is unknown', () => {
        const outcome = describeSaveOutcome(verification({ report: null, targetLabel: '' }));
        expect(outcome.text).toContain('that page');
        expect(outcome.text).not.toContain('undefined');
    });
});
