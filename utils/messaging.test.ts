import { describe, it, expect, vi } from 'vitest';
import { isRestrictedUrl } from './messaging';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// isRestrictedUrl gates every content-script injection call site, so a false
// negative means a failed injection and a stream of console errors on pages we
// were never allowed to touch.
describe('isRestrictedUrl', () => {
  it.each([
    ['chrome://extensions'],
    ['chrome://newtab/'],
    ['chrome-extension://abcdef/options.html'],
    ['edge://settings'],
    ['about:blank'],
    ['view-source:https://example.com'],
    ['https://chrome.google.com/webstore/category/extensions'],
    ['https://chromewebstore.google.com/detail/abc'],
  ])('treats %s as restricted', (url) => {
    expect(isRestrictedUrl(url)).toBe(true);
  });

  it.each([
    ['https://example.com/'],
    ['http://localhost:3000/index.html'],
    ['https://docs.google.com/spreadsheets/d/ABC/edit'],
    ['file:///home/user/page.html'],
  ])('treats %s as allowed', (url) => {
    // file: is allowed here on purpose: the separate file-scheme permission
    // check happens at the injection site, not in this function.
    expect(isRestrictedUrl(url)).toBe(false);
  });

  it('treats a missing or unparseable URL as restricted, failing safe', () => {
    expect(isRestrictedUrl(undefined)).toBe(true);
    expect(isRestrictedUrl('')).toBe(true);
    expect(isRestrictedUrl('not a url')).toBe(true);
  });

  it('does not restrict a normal site whose path mentions the web store', () => {
    expect(isRestrictedUrl('https://example.com/chromewebstore.google.com')).toBe(false);
  });

  it('restricts the web store on any path', () => {
    expect(isRestrictedUrl('https://chromewebstore.google.com/')).toBe(true);
  });
});
