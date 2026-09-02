import { describe, it, expect } from 'vitest';
import { validateImportedRules } from './importRules';
import { MAX_IMPORT_RULES } from './validation';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const raw = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  matcher: 'example.com',
  matchType: 'domain',
  faviconUrl: PNG,
  sourceType: 'upload',
  createdAt: 1700000000000,
  ...overrides,
});

const file = (...rules: Record<string, unknown>[]) =>
  Object.fromEntries(rules.map((r, i) => [`k${i}`, r]));

describe('validateImportedRules: whole-file failures', () => {
  it('rejects a non-object', () => {
    expect(validateImportedRules('nope').fatal).toBeTruthy();
    expect(validateImportedRules(null).fatal).toBeTruthy();
    expect(validateImportedRules(42).fatal).toBeTruthy();
  });

  it('rejects an array, which is not the export shape', () => {
    expect(validateImportedRules([raw()]).fatal).toBeTruthy();
  });

  it('rejects an empty object', () => {
    expect(validateImportedRules({}).fatal).toBeTruthy();
  });

  it('rejects a file over the rule cap without validating any of it', () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_IMPORT_RULES + 1 }, (_, i) => [`k${i}`, raw({ id: `r${i}` })])
    );
    const out = validateImportedRules(many);
    expect(out.fatal).toContain(String(MAX_IMPORT_RULES));
    expect(Object.keys(out.accepted)).toHaveLength(0);
  });

  it('accepts a file exactly at the cap', () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_IMPORT_RULES }, (_, i) => [`k${i}`, raw({ id: `r${i}` })])
    );
    const out = validateImportedRules(many);
    expect(out.fatal).toBeUndefined();
    expect(Object.keys(out.accepted)).toHaveLength(MAX_IMPORT_RULES);
  });
});

describe('validateImportedRules: per-rule validation', () => {
  it('accepts a well-formed rule of every match type', () => {
    const out = validateImportedRules(file(
      raw({ id: 'a', matchType: 'domain', matcher: 'example.com' }),
      raw({ id: 'b', matchType: 'prefix', matcher: 'https://example.com/docs' }),
      raw({ id: 'c', matchType: 'exact_url', matcher: 'https://example.com/x' }),
      raw({ id: 'd', matchType: 'regex', matcher: 'example\\.com' }),
    ));
    expect(out.rejected).toHaveLength(0);
    expect(Object.keys(out.accepted).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rejects an unknown match type', () => {
    const out = validateImportedRules(file(raw({ matchType: 'wildcard' })));
    expect(out.accepted).toEqual({});
    expect(out.rejected[0].reason).toContain('unknown match type');
  });

  it('rejects a missing match type', () => {
    const out = validateImportedRules(file(raw({ matchType: undefined })));
    expect(out.rejected).toHaveLength(1);
  });

  it('rejects an invalid regex, which would otherwise run on every page load', () => {
    const out = validateImportedRules(file(raw({ matchType: 'regex', matcher: '[invalid(' })));
    expect(out.rejected[0].reason).toContain('regex');
  });

  it('rejects an over-long regex', () => {
    const out = validateImportedRules(file(raw({ matchType: 'regex', matcher: 'a'.repeat(2001) })));
    expect(out.rejected).toHaveLength(1);
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['data:application/json,{}'],
    ['file:///etc/passwd'],
    ['chrome-extension://abc/icon.png'],
    ['not a url at all'],
  ])('rejects a favicon URL with a disallowed scheme: %s', (url) => {
    const out = validateImportedRules(file(raw({ faviconUrl: url })));
    expect(out.accepted).toEqual({});
    expect(out.rejected[0].reason).toContain('icon must be');
  });

  it.each([
    ['data:image/png;base64,iVBORw0KGgo='],
    ['data:image/svg+xml,%3Csvg%3E%3C/svg%3E'],
    ['https://cdn.example.com/i.png'],
    ['http://cdn.example.com/i.png'],
  ])('accepts an allowed favicon URL: %s', (url) => {
    const out = validateImportedRules(file(raw({ faviconUrl: url })));
    expect(out.rejected).toHaveLength(0);
  });

  it('rejects an oversized icon', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(400 * 1024);
    const out = validateImportedRules(file(raw({ faviconUrl: big })));
    expect(out.rejected[0].reason).toContain('larger than');
  });

  it('rejects missing required fields, naming the rule where it can', () => {
    const out = validateImportedRules(file(
      raw({ id: undefined }),
      raw({ matcher: undefined }),
      raw({ faviconUrl: undefined }),
    ));
    expect(out.accepted).toEqual({});
    expect(out.rejected.map(r => r.reason)).toEqual(['missing id', 'missing matcher', 'missing faviconUrl']);
    expect(out.rejected[1].matcher).toBe('(unnamed rule)');
  });

  it('keeps the good rules and reports only the bad ones', () => {
    const out = validateImportedRules(file(
      raw({ id: 'good' }),
      raw({ id: 'bad', matchType: 'nope' }),
    ));
    expect(Object.keys(out.accepted)).toEqual(['good']);
    expect(out.rejected).toHaveLength(1);
  });

  it('counts rules whose icon is fetched remotely', () => {
    const out = validateImportedRules(file(
      raw({ id: 'a', faviconUrl: PNG }),
      raw({ id: 'b', faviconUrl: 'https://cdn.example.com/i.png' }),
      raw({ id: 'c', faviconUrl: 'http://cdn.example.com/j.png' }),
    ));
    expect(out.remoteCount).toBe(2);
  });
});

describe('validateImportedRules: field rebuilding', () => {
  it('drops unknown top-level fields instead of storing them', () => {
    const out = validateImportedRules(file(raw({ id: 'a', evil: 'payload', __proto__mischief: 1 })));
    expect(Object.keys(out.accepted.a).sort()).toEqual(
      ['createdAt', 'faviconUrl', 'id', 'matchType', 'matcher', 'sourceType'].sort()
    );
    expect('evil' in out.accepted.a).toBe(false);
    expect('__proto__mischief' in out.accepted.a).toBe(false);
  });

  it('keeps only known metadata keys', () => {
    const out = validateImportedRules(file(raw({
      id: 'a',
      metadata: { emojiChar: '\u{1F680}', imageMode: 'cover', nonsense: 'x', overlayOpacity: 0.5 },
    })));
    expect(out.accepted.a.metadata).toEqual({ emojiChar: '\u{1F680}', imageMode: 'cover', overlayOpacity: 0.5 });
  });

  it('drops metadata values outside their allowed set', () => {
    const out = validateImportedRules(file(raw({
      id: 'a',
      metadata: { imageMode: 'squish', badgePosition: 'middle', mode: 'hologram', overlayOpacity: 7 },
    })));
    expect(out.accepted.a.metadata).toBeUndefined();
  });

  it('enforces the 3 character badge limit that the editor input implies', () => {
    const ok = validateImportedRules(file(raw({ id: 'a', metadata: { badgeText: '99+' } })));
    expect(ok.accepted.a.metadata?.badgeText).toBe('99+');

    const tooLong = validateImportedRules(file(raw({ id: 'b', metadata: { badgeText: 'LONGTEXT' } })));
    expect(tooLong.accepted.b.metadata).toBeUndefined();
  });

  it('defaults an unknown sourceType rather than rejecting the rule', () => {
    const out = validateImportedRules(file(raw({ id: 'a', sourceType: 'telepathy' })));
    expect(out.accepted.a.sourceType).toBe('upload');
  });

  it('preserves createdAt and updatedAt when sane, and replaces a bad createdAt', () => {
    const out = validateImportedRules(file(
      raw({ id: 'a', createdAt: 1700000000000, updatedAt: 1700000009999 }),
      raw({ id: 'b', createdAt: 'yesterday' }),
    ));
    expect(out.accepted.a.createdAt).toBe(1700000000000);
    expect(out.accepted.a.updatedAt).toBe(1700000009999);
    expect(typeof out.accepted.b.createdAt).toBe('number');
    expect(out.accepted.b.createdAt).toBeGreaterThan(0);
  });

  it('only keeps originalUrl when it is itself an allowed icon URL', () => {
    const good = validateImportedRules(file(raw({ id: 'a', originalUrl: 'https://x.example/i.png' })));
    expect(good.accepted.a.originalUrl).toBe('https://x.example/i.png');

    const bad = validateImportedRules(file(raw({ id: 'b', originalUrl: 'javascript:alert(1)' })));
    expect(bad.accepted.b.originalUrl).toBeUndefined();
  });
});
