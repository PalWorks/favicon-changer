import { describe, it, expect } from 'vitest';
import {
  isValidRegex,
  isValidUrl,
  isValidBadgeText,
  isAllowedFaviconUrl,
  approximateUrlBytes,
  MAX_ICON_BYTES,
} from './validation';

describe('isValidRegex', () => {
  it('accepts a normal pattern', () => {
    expect(isValidRegex('docs\\.google\\.com')).toBe(true);
  });

  it('rejects a pattern that does not compile', () => {
    expect(isValidRegex('[invalid(')).toBe(false);
    expect(isValidRegex('a{2,1}')).toBe(false);
  });

  it('accepts an empty pattern, which compiles and matches everything', () => {
    // Guarding against that is the matcher's job, not this function's.
    expect(isValidRegex('')).toBe(true);
  });

  it('rejects a pattern at the length cap, as a partial ReDoS guard', () => {
    expect(isValidRegex('a'.repeat(2000))).toBe(true);
    expect(isValidRegex('a'.repeat(2001))).toBe(false);
  });
});

describe('isValidUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=1#c',
    'file:///home/user/x.html',
    'chrome://extensions',
  ])('accepts %s', (url) => {
    expect(isValidUrl(url)).toBe(true);
  });

  it.each(['example.com', 'not a url', '', '//example.com'])('rejects %s', (url) => {
    // Scheme-relative and bare hostnames are not absolute URLs.
    expect(isValidUrl(url)).toBe(false);
  });
});

describe('isValidBadgeText', () => {
  it('allows up to three characters', () => {
    expect(isValidBadgeText('')).toBe(true);
    expect(isValidBadgeText('9')).toBe(true);
    expect(isValidBadgeText('99+')).toBe(true);
  });

  it('rejects four or more', () => {
    expect(isValidBadgeText('1234')).toBe(false);
  });
});

describe('isAllowedFaviconUrl', () => {
  it.each([
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/svg+xml,%3Csvg%3E%3C/svg%3E',
    'data:image/webp;base64,AAA=',
    'https://cdn.example.com/i.png',
    'http://cdn.example.com/i.png',
  ])('allows %s', (url) => {
    expect(isAllowedFaviconUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:application/json,{}',
    'data:image/png',          // no separator, so not a real data URL payload
    'file:///etc/passwd',
    'chrome-extension://abc/i.png',
    'ftp://example.com/i.png',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isAllowedFaviconUrl(url)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isAllowedFaviconUrl(undefined as any)).toBe(false);
    expect(isAllowedFaviconUrl(null as any)).toBe(false);
    expect(isAllowedFaviconUrl(42 as any)).toBe(false);
  });

  it('is not fooled by a data:image prefix inside another scheme', () => {
    expect(isAllowedFaviconUrl('javascript:/*data:image/png;base64,*/alert(1)')).toBe(false);
  });
});

describe('approximateUrlBytes', () => {
  it('estimates the decoded size of a base64 data URL', () => {
    // 4 base64 characters carry 3 bytes.
    const payload = 'A'.repeat(400);
    expect(approximateUrlBytes(`data:image/png;base64,${payload}`)).toBe(300);
  });

  it('falls back to string length for anything else', () => {
    const url = 'https://cdn.example.com/i.png';
    expect(approximateUrlBytes(url)).toBe(url.length);
  });

  it('lines up with the import cap', () => {
    const justUnder = 'data:image/png;base64,' + 'A'.repeat(Math.floor(MAX_ICON_BYTES / 0.75) - 4);
    const wellOver = 'data:image/png;base64,' + 'A'.repeat(Math.ceil(MAX_ICON_BYTES / 0.75) + 100);
    expect(approximateUrlBytes(justUnder)).toBeLessThanOrEqual(MAX_ICON_BYTES);
    expect(approximateUrlBytes(wellOver)).toBeGreaterThan(MAX_ICON_BYTES);
  });
});
