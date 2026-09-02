import { describe, it, expect } from 'vitest';
import { escapeRegex, suggestPrefix, suggestRegex } from './patterns';

const SHEET = 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0';

describe('escapeRegex', () => {
  it('escapes every regex metacharacter', () => {
    const escaped = escapeRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o');
    expect(new RegExp(escaped).test('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(true);
  });

  it('makes a pasted URL match itself literally and nothing else', () => {
    // The footgun this exists to remove: unescaped, '.' matches any character
    // and '?' makes the preceding character optional.
    const raw = 'https://example.com/a?b=1';
    expect(new RegExp(escapeRegex(raw)).test(raw)).toBe(true);
    expect(new RegExp(escapeRegex(raw)).test('https://exampleXcom/a?b=1')).toBe(false);
    expect(new RegExp(raw).test('https://exampleXcom/ab=1')).toBe(true); // unescaped over-matches
  });

  it('leaves a plain string untouched', () => {
    expect(escapeRegex('abc123')).toBe('abc123');
  });
});

describe('suggestPrefix', () => {
  it('covers one Google Sheets document across its sheets', () => {
    // The case from the Chrome Web Store review.
    expect(suggestPrefix(SHEET)).toBe('https://docs.google.com/spreadsheets/d/ABC123');
  });

  it('drops the query string and the fragment', () => {
    expect(suggestPrefix('https://example.com/docs/report?page=2#section'))
      .toBe('https://example.com/docs');
  });

  it('keeps a single-segment path whole, rather than widening to the whole site', () => {
    // Dropping it would make the rule equivalent to a domain rule, which is a
    // separate match type the user could have picked instead.
    expect(suggestPrefix('https://example.com/pricing')).toBe('https://example.com/pricing');
  });

  it('handles a bare origin', () => {
    expect(suggestPrefix('https://example.com/')).toBe('https://example.com/');
    expect(suggestPrefix('https://example.com')).toBe('https://example.com/');
  });

  it('keeps the port, which is part of the origin', () => {
    expect(suggestPrefix('https://localhost:3000/a/b')).toBe('https://localhost:3000/a');
  });

  it('does not emit the string "null" for a file URL', () => {
    // URL.origin is the literal string 'null' for file:, which would produce a
    // prefix matching nothing.
    const out = suggestPrefix('file:///home/user/docs/page.html');
    expect(out).not.toContain('null');
    expect(out).toBe('file:///home/user/docs');
  });

  it('falls back to trimming query and fragment for an unparseable input', () => {
    expect(suggestPrefix('not a url?x=1#y')).toBe('not a url');
  });

  it('always produces a prefix of the URL it came from', () => {
    for (const url of [
      SHEET,
      'https://example.com/pricing',
      'https://example.com/',
      'https://localhost:3000/a/b',
      'https://github.com/o/r/blob/main/src/x.ts',
    ]) {
      expect(url.startsWith(suggestPrefix(url))).toBe(true);
    }
  });
});

describe('suggestRegex', () => {
  it('anchors at the start and escapes the separators', () => {
    expect(suggestRegex(SHEET)).toBe('^https://docs\\.google\\.com/spreadsheets/d/ABC123');
  });

  it('produces a pattern that matches the source URL', () => {
    expect(new RegExp(suggestRegex(SHEET)).test(SHEET)).toBe(true);
  });

  it('produces a pattern anchored enough to reject a lookalike host', () => {
    const pattern = new RegExp(suggestRegex('https://docs.google.com/a/b'));
    expect(pattern.test('https://evil.example/?x=https://docs.google.com/a/b')).toBe(false);
  });
});
