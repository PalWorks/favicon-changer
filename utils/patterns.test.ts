import { describe, it, expect } from 'vitest';
import { escapeRegex, hasExplicitScheme, hostnameFromInput, looksLikeHostname, suggestPrefix, suggestRegex } from './patterns';

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

// R-49. The URL parser is not a validator, and Chrome's differs from Node's:
// Chrome percent-encodes characters that are illegal in a host instead of
// throwing, so `new URL('https://not a url at all').hostname` is
// 'not%20a%20url%20at%20all' in the browser and a throw here. The shape check
// has to be tested directly for that reason; asserting through
// hostnameFromInput in Node would pass without the guard existing at all.
describe('looksLikeHostname', () => {
  it('accepts ordinary hostnames', () => {
    for (const host of ['example.com', 'sub.example.co.uk', 'localhost', '127.0.0.1', 'xn--wgv71a.jp', 'a-b.example']) {
      expect(looksLikeHostname(host), host).toBe(true);
    }
  });

  it('accepts a bracketed IPv6 literal, which the parser has already validated', () => {
    expect(looksLikeHostname('[2001:db8::1]')).toBe(true);
  });

  it('rejects a hostname the parser had to escape', () => {
    for (const host of ['not%20a%20url%20at%20all', 'a%20b', 'x%20y.com']) {
      expect(looksLikeHostname(host), host).toBe(false);
    }
  });

  it('rejects empty labels, which can never equal a real hostname', () => {
    for (const host of ['', '...', 'a..b', '.com', 'example.']) {
      expect(looksLikeHostname(host), host).toBe(false);
    }
  });
});

describe('hostnameFromInput applies the shape check', () => {
  it('still reads the ordinary cases', () => {
    expect(hostnameFromInput('example.com')).toBe('example.com');
    expect(hostnameFromInput('https://sub.example.com/page?q=1')).toBe('sub.example.com');
    expect(hostnameFromInput('  example.com  ')).toBe('example.com');
  });

  it('returns nothing for input the parser tolerated but is not an address', () => {
    expect(hostnameFromInput('...')).toBe('');
    expect(hostnameFromInput('.com')).toBe('');
  });

  it('returns nothing for a file URL, which has no host', () => {
    expect(hostnameFromInput('file:///home/me/notes.html')).toBe('');
  });
});

// A scheme is `scheme://`, not `scheme:`. Treating `localhost:3000/app` as the
// `localhost:` scheme parsed to an empty host and a path of `3000/app`, and the
// prefix suggestion built from that was `localhost:///3000`, which then passed
// prefix validation because it does contain `scheme://`. This extension is
// listed under Developer Tools; its users type port numbers.
describe('hasExplicitScheme', () => {
  it('accepts the schemes this extension actually deals with', () => {
    for (const v of ['http://a.com', 'https://a.com', 'file:///home/me/x', 'ftp://a.com', 'chrome-extension://abc/x']) {
      expect(hasExplicitScheme(v), v).toBe(true);
    }
  });

  it('rejects a host:port that only looks like a scheme', () => {
    for (const v of ['localhost:3000', 'localhost:3000/app', '127.0.0.1:8899/spa.html', 'example.com:8080/x']) {
      expect(hasExplicitScheme(v), v).toBe(false);
    }
  });

  it('rejects a bare domain and a path', () => {
    expect(hasExplicitScheme('example.com')).toBe(false);
    expect(hasExplicitScheme('/docs/page')).toBe(false);
    expect(hasExplicitScheme('')).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(hasExplicitScheme('  https://a.com  ')).toBe(true);
  });
});

describe('hostnameFromInput reads a host:port the way a developer means it', () => {
  it('reads the host from a bare host and port', () => {
    expect(hostnameFromInput('localhost:3000')).toBe('localhost');
    expect(hostnameFromInput('localhost:3000/app')).toBe('localhost');
    expect(hostnameFromInput('127.0.0.1:8899/spa.html')).toBe('127.0.0.1');
  });

  it('still reads a host from a full URL with a port', () => {
    expect(hostnameFromInput('http://localhost:3000/app')).toBe('localhost');
  });
});

