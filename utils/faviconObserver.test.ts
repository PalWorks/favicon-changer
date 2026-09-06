// @vitest-environment jsdom
//
// The other half of the content script's DOM behaviour, and the one that had no
// test at all until R-48. The bug it protects against (deciding whose write a
// mutation was by our own ownership mark rather than by the href) passed every
// test in this repository for months and was only caught by driving a real
// browser. See ADR-014 and ROADMAP R-43.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { displacesFavicon, observeFaviconChanges } from './faviconObserver';
import { CHANGE_MARK, updateFavicon } from './faviconDom';

const ICON = 'data:image/png;base64,AAAA';
const OTHER = '/site.png';

const setHead = (html: string) => { document.head.innerHTML = html; };
const iconLink = () => document.head.querySelector('link[rel*="icon"]') as HTMLLinkElement;

// Records delivered to a MutationObserver, captured for the pure predicate.
const recordsFor = async (mutate: () => void): Promise<MutationRecord[]> => {
  let captured: MutationRecord[] = [];
  const observer = new MutationObserver(records => { captured = captured.concat(records); });
  observer.observe(document.head, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'],
  });
  mutate();
  await Promise.resolve();
  captured = captured.concat(observer.takeRecords());
  observer.disconnect();
  return captured;
};

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => { setHead(''); });

describe('displacesFavicon: whose write was it (ADR-014)', () => {
  // The regression that started all of this. updateFavicon marks the element
  // Chrome tracks, which is the element a page reasserting its own icon keeps
  // rewriting, so "is it marked?" answers the wrong question.
  it('reports a page write on the very element we own', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => iconLink().setAttribute('href', OTHER));

    expect(displacesFavicon(records, ICON)).toBe(true);
  });

  it('ignores our own write, so re-applying cannot loop', async () => {
    setHead(`<link rel="icon" href="${OTHER}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => iconLink().setAttribute('href', ICON));

    expect(displacesFavicon(records, ICON)).toBe(false);
  });

  it('ignores a re-write of the same value', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => iconLink().setAttribute('href', ICON));

    expect(displacesFavicon(records, ICON)).toBe(false);
  });

  it('reports a fresh icon link the page appended', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = OTHER;
      document.head.appendChild(link);
    });

    expect(displacesFavicon(records, ICON)).toBe(true);
  });

  it('ignores an appended link that already carries our icon', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.setAttribute('href', ICON);
      document.head.appendChild(link);
    });

    expect(displacesFavicon(records, ICON)).toBe(false);
  });

  it('ignores head churn that has nothing to do with icons', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const records = await recordsFor(() => {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = '/app.css';
      document.head.appendChild(style);
      document.head.appendChild(document.createElement('script'));
    });

    expect(displacesFavicon(records, ICON)).toBe(false);
  });

  it('reports an apple-touch-icon the page rewrote, since rel still says icon', async () => {
    setHead(`<link rel="apple-touch-icon" href="/apple.png"><link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const apple = document.head.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    const records = await recordsFor(() => apple.setAttribute('href', '/apple2.png'));

    expect(displacesFavicon(records, ICON)).toBe(true);
  });

  it('is false for an empty batch', () => {
    expect(displacesFavicon([], ICON)).toBe(false);
  });
});

describe('observeFaviconChanges: wiring and debounce', () => {
  it('calls back after a page write, once the debounce elapses', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const onDisplaced = vi.fn();
    const sub = observeFaviconChanges(document.head, ICON, onDisplaced, 5);

    iconLink().setAttribute('href', OTHER);
    await tick(0);
    expect(onDisplaced).not.toHaveBeenCalled(); // still inside the debounce

    await tick(20);
    expect(onDisplaced).toHaveBeenCalledTimes(1);
    sub.disconnect();
  });

  // The whole point of the debounce: an SPA re-hydrating <head> emits a burst.
  it('coalesces a burst of page writes into one re-apply', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const onDisplaced = vi.fn();
    const sub = observeFaviconChanges(document.head, ICON, onDisplaced, 5);

    for (let i = 0; i < 20; i++) iconLink().setAttribute('href', `${OTHER}?v=${i}`);
    await tick(20);

    expect(onDisplaced).toHaveBeenCalledTimes(1);
    sub.disconnect();
  });

  it('does not call back when updateFavicon does the writing', async () => {
    setHead(`<link rel="icon" href="${OTHER}">`);
    const onDisplaced = vi.fn();
    const sub = observeFaviconChanges(document.head, ICON, onDisplaced, 5);

    updateFavicon(ICON);
    await tick(20);

    expect(onDisplaced).not.toHaveBeenCalled();
    sub.disconnect();
  });

  // The real cycle: the page takes the icon, we take it back, and taking it
  // back must not itself count as the page displacing us.
  it('settles after we re-apply, rather than ping-ponging', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const onDisplaced = vi.fn(() => { updateFavicon(ICON); });
    const sub = observeFaviconChanges(document.head, ICON, onDisplaced, 5);

    iconLink().setAttribute('href', OTHER);
    await tick(40);

    expect(onDisplaced).toHaveBeenCalledTimes(1);
    expect(iconLink().getAttribute('href')).toBe(ICON);
    sub.disconnect();
  });

  it('stops on disconnect, including a re-apply still pending', async () => {
    setHead(`<link rel="icon" href="${ICON}" ${CHANGE_MARK}="true">`);
    const onDisplaced = vi.fn();
    const sub = observeFaviconChanges(document.head, ICON, onDisplaced, 20);

    iconLink().setAttribute('href', OTHER);
    await tick(0);
    sub.disconnect();
    await tick(40);

    expect(onDisplaced).not.toHaveBeenCalled();
  });
});
