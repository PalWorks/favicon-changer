import { describe, it, expect, vi } from 'vitest';
import { findBestRule, findConflictingRule, patternMatches } from './matcher';
import { FaviconRule } from '../types';

// logger uses chrome.storage — stub it out so tests run in Node.
vi.mock('./logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Helper to build a minimal FaviconRule without boilerplate.
function rule(overrides: Partial<FaviconRule> & Pick<FaviconRule, 'matchType' | 'matcher'>): FaviconRule {
  return {
    id: overrides.matcher,
    faviconUrl: 'https://example.com/icon.png',
    sourceType: 'upload',
    createdAt: 0,
    ...overrides,
  } as FaviconRule;
}

const GOOGLE_URL    = 'https://www.google.com/search?q=test';
const GOOGLE_DOMAIN = 'www.google.com';
const GA4_URL       = 'https://analytics.google.com/analytics/web/';
const GA4_DOMAIN    = 'analytics.google.com';
const SHEET_URL     = 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0';
const SHEET_URL_2   = 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=99';
const OTHER_SHEET   = 'https://docs.google.com/spreadsheets/d/ZZZ999/edit#gid=0';
const SHEET_DOMAIN  = 'docs.google.com';
const SHEET_PREFIX  = 'https://docs.google.com/spreadsheets/d/ABC123';

// ---------------------------------------------------------------------------
// findBestRule
// ---------------------------------------------------------------------------

describe('findBestRule', () => {
  it('returns null for an empty rules array', () => {
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [])).toBeNull();
  });

  it('returns null when no rule matches', () => {
    const rules = [rule({ matchType: 'domain', matcher: 'example.com' })];
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, rules)).toBeNull();
  });

  // --- Exact URL ---

  it('matches an exact URL rule', () => {
    const r = rule({ matchType: 'exact_url', matcher: GOOGLE_URL });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [r])).toBe(r);
  });

  it('does not match exact URL rule when URL differs by trailing slash', () => {
    const r = rule({ matchType: 'exact_url', matcher: 'https://www.google.com/' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [r])).toBeNull();
  });

  // --- Priority: exact_url > regex > domain ---

  it('exact URL beats domain rule on the same site', () => {
    const exact  = rule({ matchType: 'exact_url', matcher: GOOGLE_URL, faviconUrl: 'exact.png' });
    const domain = rule({ matchType: 'domain',    matcher: 'google.com', faviconUrl: 'domain.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [domain, exact])?.faviconUrl).toBe('exact.png');
  });

  it('exact URL beats regex rule on the same site', () => {
    const exact = rule({ matchType: 'exact_url', matcher: GOOGLE_URL, faviconUrl: 'exact.png' });
    const regex = rule({ matchType: 'regex',     matcher: 'google\\.com', faviconUrl: 'regex.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [regex, exact])?.faviconUrl).toBe('exact.png');
  });

  it('regex beats domain rule on the same site', () => {
    const regex  = rule({ matchType: 'regex',  matcher: 'analytics\\.google\\.com', faviconUrl: 'regex.png' });
    const domain = rule({ matchType: 'domain', matcher: 'google.com',                faviconUrl: 'domain.png' });
    expect(findBestRule(GA4_URL, GA4_DOMAIN, [domain, regex])?.faviconUrl).toBe('regex.png');
  });

  // --- Domain match ---

  it('matches domain rule on the exact root domain', () => {
    const r = rule({ matchType: 'domain', matcher: 'google.com' });
    // The test URL's hostname is 'google.com'
    expect(findBestRule('https://google.com/', 'google.com', [r])).toBe(r);
  });

  it('matches domain rule on a subdomain', () => {
    const r = rule({ matchType: 'domain', matcher: 'google.com' });
    expect(findBestRule(GA4_URL, GA4_DOMAIN, [r])).toBe(r);
  });

  it('does not match domain rule when only partial match (no dot boundary)', () => {
    // 'notgoogle.com' should not match a rule for 'google.com'
    const r = rule({ matchType: 'domain', matcher: 'google.com' });
    expect(findBestRule('https://notgoogle.com/', 'notgoogle.com', [r])).toBeNull();
  });

  // --- Regex ---

  it('matches a regex rule against the full URL', () => {
    const r = rule({ matchType: 'regex', matcher: 'analytics\\.google\\.com\\/analytics' });
    expect(findBestRule(GA4_URL, GA4_DOMAIN, [r])).toBe(r);
  });

  it('skips an invalid regex and falls through to domain match', () => {
    const bad    = rule({ matchType: 'regex',  matcher: '[invalid(', faviconUrl: 'bad.png' });
    const domain = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'domain.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [bad, domain])?.faviconUrl).toBe('domain.png');
  });

  it('first matching regex wins when multiple regex rules exist', () => {
    const r1 = rule({ matchType: 'regex', matcher: 'google', faviconUrl: 'first.png' });
    const r2 = rule({ matchType: 'regex', matcher: 'google', faviconUrl: 'second.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [r1, r2])?.faviconUrl).toBe('first.png');
  });

  it('first matching domain rule wins when multiple domain rules exist', () => {
    const r1 = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'first.png' });
    const r2 = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'second.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [r1, r2])?.faviconUrl).toBe('first.png');
  });
});

// ---------------------------------------------------------------------------
// findBestRule: prefix match type (R-01)
//
// The case from the Chrome Web Store review: one favicon that stays applied to
// one Google Sheets document while the tail of the URL changes between sheets.
// ---------------------------------------------------------------------------

describe('findBestRule prefix', () => {
  it('holds across URL variations under the same document', () => {
    const r = rule({ matchType: 'prefix', matcher: SHEET_PREFIX });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [r])).toBe(r);
    expect(findBestRule(SHEET_URL_2, SHEET_DOMAIN, [r])).toBe(r);
  });

  it('does not leak to a different document on the same site', () => {
    const r = rule({ matchType: 'prefix', matcher: SHEET_PREFIX });
    expect(findBestRule(OTHER_SHEET, SHEET_DOMAIN, [r])).toBeNull();
  });

  it('anchors at the start, so it is not substring matching', () => {
    const r = rule({ matchType: 'prefix', matcher: 'https://docs.google.com/a' });
    expect(findBestRule('https://evil.example/?x=https://docs.google.com/a', 'evil.example', [r])).toBeNull();
  });

  it('never matches on an empty matcher', () => {
    // Otherwise an empty prefix would match every URL on the web.
    const r = rule({ matchType: 'prefix', matcher: '' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [r])).toBeNull();
  });

  it('beats a domain rule for the same site', () => {
    const prefix = rule({ matchType: 'prefix', matcher: SHEET_PREFIX,   faviconUrl: 'prefix.png' });
    const domain = rule({ matchType: 'domain', matcher: 'google.com',   faviconUrl: 'domain.png' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [domain, prefix])?.faviconUrl).toBe('prefix.png');
  });

  it('beats a regex rule, so a document rule cannot lose to a site-wide pattern', () => {
    // The deliberate ordering decision in ADR-013.
    const prefix = rule({ matchType: 'prefix', matcher: SHEET_PREFIX,          faviconUrl: 'prefix.png' });
    const regex  = rule({ matchType: 'regex',  matcher: 'docs\\.google\\.com', faviconUrl: 'regex.png' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [regex, prefix])?.faviconUrl).toBe('prefix.png');
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [prefix, regex])?.faviconUrl).toBe('prefix.png');
  });

  it('loses to an exact URL rule for the same page', () => {
    const prefix = rule({ matchType: 'prefix',    matcher: SHEET_PREFIX, faviconUrl: 'prefix.png' });
    const exact  = rule({ matchType: 'exact_url', matcher: SHEET_URL,    faviconUrl: 'exact.png' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [prefix, exact])?.faviconUrl).toBe('exact.png');
  });

  it('prefers the longer prefix regardless of rule order', () => {
    const broad    = rule({ matchType: 'prefix', matcher: 'https://docs.google.com/spreadsheets', faviconUrl: 'broad.png' });
    const specific = rule({ matchType: 'prefix', matcher: SHEET_PREFIX,                           faviconUrl: 'specific.png' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [broad, specific])?.faviconUrl).toBe('specific.png');
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [specific, broad])?.faviconUrl).toBe('specific.png');
  });

  it('a very long prefix never outranks an exact_url rule', () => {
    const longPrefix = rule({ matchType: 'prefix',    matcher: 'https://docs.google.com/' + 'a'.repeat(400), faviconUrl: 'prefix.png' });
    const exact      = rule({ matchType: 'exact_url', matcher: SHEET_URL, faviconUrl: 'exact.png' });
    expect(findBestRule(SHEET_URL, SHEET_DOMAIN, [longPrefix, exact])?.faviconUrl).toBe('exact.png');
  });
});

// ---------------------------------------------------------------------------
// patternMatches: the editor's live preview helper
// ---------------------------------------------------------------------------

describe('patternMatches', () => {
  it('agrees with each match type', () => {
    expect(patternMatches('exact_url', SHEET_URL, SHEET_URL, SHEET_DOMAIN)).toBe(true);
    expect(patternMatches('exact_url', SHEET_URL, SHEET_URL_2, SHEET_DOMAIN)).toBe(false);
    expect(patternMatches('prefix', SHEET_PREFIX, SHEET_URL_2, SHEET_DOMAIN)).toBe(true);
    expect(patternMatches('prefix', SHEET_PREFIX, OTHER_SHEET, SHEET_DOMAIN)).toBe(false);
    expect(patternMatches('regex', 'spreadsheets/d/ABC', SHEET_URL, SHEET_DOMAIN)).toBe(true);
    expect(patternMatches('domain', 'google.com', SHEET_URL, SHEET_DOMAIN)).toBe(true);
    expect(patternMatches('domain', 'bing.com', SHEET_URL, SHEET_DOMAIN)).toBe(false);
  });

  it('reports false for an invalid regex rather than throwing', () => {
    expect(patternMatches('regex', '[invalid(', SHEET_URL, SHEET_DOMAIN)).toBe(false);
  });

  it('reports false for an empty pattern', () => {
    expect(patternMatches('prefix', '', SHEET_URL, SHEET_DOMAIN)).toBe(false);
    expect(patternMatches('regex', '', SHEET_URL, SHEET_DOMAIN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findBestRule: specificity (R-04)
//
// Before R-04 each tier was scanned with Array.find, so among equally-typed
// matching rules the OLDEST won regardless of how specific it was. These lock
// in "most specific wins", and that a long matcher can never jump its tier.
// ---------------------------------------------------------------------------

describe('findBestRule specificity', () => {
  it('prefers the longer domain matcher regardless of rule order', () => {
    const broad    = rule({ matchType: 'domain', matcher: 'google.com',          faviconUrl: 'broad.png' });
    const specific = rule({ matchType: 'domain', matcher: 'analytics.google.com', faviconUrl: 'specific.png' });

    // Created broad-first (the order that used to give the wrong answer)...
    expect(findBestRule(GA4_URL, GA4_DOMAIN, [broad, specific])?.faviconUrl).toBe('specific.png');
    // ...and specific-first.
    expect(findBestRule(GA4_URL, GA4_DOMAIN, [specific, broad])?.faviconUrl).toBe('specific.png');
  });

  it('still applies the broad domain rule on a sibling subdomain', () => {
    const broad    = rule({ matchType: 'domain', matcher: 'google.com',           faviconUrl: 'broad.png' });
    const specific = rule({ matchType: 'domain', matcher: 'analytics.google.com', faviconUrl: 'specific.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [broad, specific])?.faviconUrl).toBe('broad.png');
  });

  it('prefers the longer regex matcher regardless of rule order', () => {
    const broad    = rule({ matchType: 'regex', matcher: 'google',                 faviconUrl: 'broad.png' });
    const specific = rule({ matchType: 'regex', matcher: 'google\\.com\\/search', faviconUrl: 'specific.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [broad, specific])?.faviconUrl).toBe('specific.png');
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [specific, broad])?.faviconUrl).toBe('specific.png');
  });

  it('keeps the first rule on an exact tie, so results stay stable', () => {
    const r1 = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'first.png' });
    const r2 = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'second.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [r1, r2])?.faviconUrl).toBe('first.png');
  });

  it('a very long domain matcher never outranks an exact_url rule', () => {
    // Tier rank must dominate matcher length, or specificity could promote a
    // rule out of its tier.
    const longDomain = rule({ matchType: 'domain', matcher: 'a'.repeat(250) + '.google.com', faviconUrl: 'domain.png' });
    const exact      = rule({ matchType: 'exact_url', matcher: GOOGLE_URL, faviconUrl: 'exact.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [longDomain, exact])?.faviconUrl).toBe('exact.png');
  });

  it('a very long regex never outranks an exact_url rule', () => {
    const longRegex = rule({ matchType: 'regex', matcher: 'google' + '|google'.repeat(300), faviconUrl: 'regex.png' });
    const exact     = rule({ matchType: 'exact_url', matcher: GOOGLE_URL, faviconUrl: 'exact.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [longRegex, exact])?.faviconUrl).toBe('exact.png');
  });

  it('a very long domain matcher never outranks a regex rule', () => {
    const longDomain = rule({ matchType: 'domain', matcher: 'a'.repeat(250) + '.google.com', faviconUrl: 'domain.png' });
    const regex      = rule({ matchType: 'regex', matcher: 'search', faviconUrl: 'regex.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [longDomain, regex])?.faviconUrl).toBe('regex.png');
  });

  it('ignores a rule with an unrecognised matchType', () => {
    const bogus  = rule({ matchType: 'wildcard' as any, matcher: 'google.com', faviconUrl: 'bogus.png' });
    const domain = rule({ matchType: 'domain', matcher: 'google.com', faviconUrl: 'domain.png' });
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [bogus, domain])?.faviconUrl).toBe('domain.png');
    expect(findBestRule(GOOGLE_URL, GOOGLE_DOMAIN, [bogus])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findConflictingRule
// ---------------------------------------------------------------------------

describe('findConflictingRule', () => {
  it('returns null for exact_url scope (only checks domain scope)', () => {
    const r = rule({ matchType: 'exact_url', matcher: GOOGLE_URL });
    expect(findConflictingRule(GOOGLE_URL, 'exact_url', [r])).toBeNull();
  });

  it('returns null when no conflicting rules exist for domain scope', () => {
    const r = rule({ matchType: 'domain', matcher: 'google.com' });
    expect(findConflictingRule(GOOGLE_URL, 'domain', [r])).toBeNull();
  });

  it('returns exact_url conflict when adding a domain rule for the same URL', () => {
    const r = rule({ matchType: 'exact_url', matcher: GOOGLE_URL });
    expect(findConflictingRule(GOOGLE_URL, 'domain', [r])).toBe(r);
  });

  it('returns regex conflict when a regex rule matches the target URL', () => {
    const r = rule({ matchType: 'regex', matcher: 'google\\.com\\/search' });
    expect(findConflictingRule(GOOGLE_URL, 'domain', [r])).toBe(r);
  });

  it('returns null for invalid regex (treated as non-conflicting)', () => {
    const r = rule({ matchType: 'regex', matcher: '[invalid(' });
    expect(findConflictingRule(GOOGLE_URL, 'domain', [r])).toBeNull();
  });

  it('returns null when regex does not match the target URL', () => {
    const r = rule({ matchType: 'regex', matcher: 'bing\\.com' });
    expect(findConflictingRule(GOOGLE_URL, 'domain', [r])).toBeNull();
  });

  it('reports a prefix rule shadowing a domain-scoped edit', () => {
    const r = rule({ matchType: 'prefix', matcher: SHEET_PREFIX });
    expect(findConflictingRule(SHEET_URL, 'domain', [r], SHEET_DOMAIN)).toBe(r);
  });

  it('reports the highest-ranked shadowing rule when several apply', () => {
    const prefix = rule({ matchType: 'prefix',    matcher: SHEET_PREFIX, faviconUrl: 'prefix.png' });
    const exact  = rule({ matchType: 'exact_url', matcher: SHEET_URL,    faviconUrl: 'exact.png' });
    expect(findConflictingRule(SHEET_URL, 'domain', [prefix, exact], SHEET_DOMAIN)?.faviconUrl).toBe('exact.png');
  });

  it('does not report a lower or equal tier as a conflict', () => {
    // A domain rule cannot shadow a prefix edit, and same-tier shadowing is
    // deliberately out of scope here (ROADMAP R-35).
    const domain = rule({ matchType: 'domain', matcher: 'google.com' });
    expect(findConflictingRule(SHEET_URL, 'prefix', [domain], SHEET_DOMAIN)).toBeNull();

    const otherPrefix = rule({ matchType: 'prefix', matcher: 'https://docs.google.com' });
    expect(findConflictingRule(SHEET_URL, 'prefix', [otherPrefix], SHEET_DOMAIN)).toBeNull();
  });

  it('returns null when editing a regex rule and only a domain rule exists', () => {
    const domain = rule({ matchType: 'domain', matcher: 'google.com' });
    expect(findConflictingRule(GOOGLE_URL, 'regex', [domain], GOOGLE_DOMAIN)).toBeNull();
  });
});
