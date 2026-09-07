import { describe, it, expect, vi, afterEach } from 'vitest';
import { isRestrictedUrl, requestFromTab } from './messaging';

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

// --- requestFromTab ---------------------------------------------------------
//
// The function that reads the reply a save used to throw away. Its contract is
// narrow and worth pinning: null means "no answer", never "it failed", because
// the caller turns null into "reload the page" rather than into an error.

const withChrome = (impl: any) => { (globalThis as any).chrome = impl; };

afterEach(() => { delete (globalThis as any).chrome; });

describe('requestFromTab', () => {
  it('returns the content script\'s reply', async () => {
    withChrome({
      tabs: { sendMessage: vi.fn().mockResolvedValue({ status: 'applied', ruleId: 'r1' }) },
      runtime: {},
    });
    await expect(requestFromTab(7, { type: 'RulesUpdated' }, { inject: false }))
      .resolves.toEqual({ status: 'applied', ruleId: 'r1' });
  });

  it('returns null when nothing is listening in that tab', async () => {
    withChrome({
      tabs: { sendMessage: vi.fn().mockRejectedValue(new Error('Could not establish connection')) },
      runtime: {},
    });
    await expect(requestFromTab(7, { type: 'RulesUpdated' }, { inject: false })).resolves.toBeNull();
  });

  it('returns null for an empty reply, so undefined is never mistaken for an answer', async () => {
    withChrome({ tabs: { sendMessage: vi.fn().mockResolvedValue(undefined) }, runtime: {} });
    await expect(requestFromTab(7, { type: 'RulesUpdated' }, { inject: false })).resolves.toBeNull();
  });

  it('gives up on its own schedule rather than waiting on the browser', async () => {
    // A save button is waiting on this, so the wait has to be bounded here.
    withChrome({ tabs: { sendMessage: vi.fn(() => new Promise(() => {})) }, runtime: {} });
    const started = Date.now();
    await expect(requestFromTab(7, { type: 'RulesUpdated' }, { inject: false, timeoutMs: 20 }))
      .resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('pings first when injection is allowed, then asks', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce({ ok: true })                        // PING
      .mockResolvedValueOnce({ status: 'excluded' });             // RulesUpdated
    withChrome({ tabs: { sendMessage }, runtime: {} });

    await expect(requestFromTab(7, { type: 'RulesUpdated' })).resolves.toEqual({ status: 'excluded' });
    expect(sendMessage).toHaveBeenNthCalledWith(1, 7, { type: 'PING' });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 7, { type: 'RulesUpdated' });
  });

  it('returns null without asking when the tab can never run a content script', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('no receiver'));
    withChrome({
      tabs: { sendMessage, get: vi.fn().mockResolvedValue({ url: 'chrome://extensions' }) },
      runtime: {},
    });

    await expect(requestFromTab(7, { type: 'RulesUpdated' })).resolves.toBeNull();
    // One PING, no second attempt: a restricted URL is refused before injecting.
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
