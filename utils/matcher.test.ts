import { describe, it, expect, vi } from 'vitest';
import { findBestRule, findConflictingRule } from './matcher';
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
});
