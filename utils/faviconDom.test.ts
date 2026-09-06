// @vitest-environment jsdom
//
// The only DOM test in the suite, and the one that earns its keep: it locks in
// ADR-001, which is the behaviour that breaks silently, only on background
// tabs, and only in a real browser. Everything here is about identity of the
// mutated element, not just its final href.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CHANGE_MARK, updateFavicon, readOriginalFaviconHref, removeMarkedFaviconLinks, hasFaviconHref } from './faviconDom';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ICON = 'data:image/png;base64,AAAA';
const OTHER = 'data:image/png;base64,BBBB';

const setHead = (html: string) => { document.head.innerHTML = html; };
const icons = () => Array.from(document.querySelectorAll("link[rel*='icon']")) as HTMLLinkElement[];

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('updateFavicon: the element must be mutated, not replaced (ADR-001)', () => {
  it('mutates the SAME element instance the page shipped', () => {
    setHead('<link rel="icon" href="/original.png">');
    const before = icons()[0];

    updateFavicon(ICON);

    const after = icons()[0];
    // Identity is the whole point. Chrome only repaints a background tab when
    // the href of an element it is ALREADY TRACKING changes, so a replaced node
    // would look correct here and silently fail in a real browser.
    expect(after).toBe(before);
    expect(after.getAttribute('href')).toBe(ICON);
  });

  it('keeps mutating that same instance across repeated applies', () => {
    setHead('<link rel="icon" href="/original.png">');
    const original = icons()[0];

    updateFavicon(ICON);
    updateFavicon(OTHER);
    updateFavicon(ICON);

    expect(icons()[0]).toBe(original);
    expect(original.getAttribute('href')).toBe(ICON);
  });

  it('does not detach and re-attach the element', () => {
    setHead('<link rel="icon" href="/original.png">');
    const link = icons()[0];
    const parentBefore = link.parentNode;

    updateFavicon(ICON);

    expect(link.isConnected).toBe(true);
    expect(link.parentNode).toBe(parentBefore);
  });

  it('reuses the element even when the page used a compound rel', () => {
    setHead('<link rel="shortcut icon" href="/original.ico">');
    const before = icons()[0];

    updateFavicon(ICON);

    expect(icons()[0]).toBe(before);
    // rel is normalised so the browser cannot treat it as a different kind of icon.
    expect(before.getAttribute('rel')).toBe('icon');
  });

  it('prefers the element it already owns over the page\'s own', () => {
    setHead(`<link rel="icon" href="/theirs.png"><link rel="icon" href="/ours.png" ${CHANGE_MARK}="true">`);
    const ours = icons().find(l => l.hasAttribute(CHANGE_MARK))!;

    updateFavicon(ICON);

    expect(icons()).toHaveLength(1);
    expect(icons()[0]).toBe(ours);
    expect(ours.getAttribute('href')).toBe(ICON);
  });
});

describe('updateFavicon: writes', () => {
  it('marks the element it owns', () => {
    setHead('<link rel="icon" href="/original.png">');
    updateFavicon(ICON);
    expect(icons()[0].getAttribute(CHANGE_MARK)).toBe('true');
  });

  it('does not rewrite an href that is already correct', () => {
    // A redundant write flashes the tab icon, so the no-op path matters.
    setHead('<link rel="icon" href="/original.png">');
    updateFavicon(ICON);

    const link = icons()[0];
    const spy = vi.spyOn(link, 'setAttribute');
    updateFavicon(ICON);

    const hrefWrites = spy.mock.calls.filter(([name]) => name === 'href');
    expect(hrefWrites).toHaveLength(0);
    spy.mockRestore();
  });

  it('still writes when the href actually changed', () => {
    setHead('<link rel="icon" href="/original.png">');
    updateFavicon(ICON);

    const link = icons()[0];
    const spy = vi.spyOn(link, 'setAttribute');
    updateFavicon(OTHER);

    expect(spy.mock.calls.filter(([name]) => name === 'href')).toHaveLength(1);
    expect(link.getAttribute('href')).toBe(OTHER);
    spy.mockRestore();
  });

  it('removes the other tab favicon links so a stale one cannot be picked', () => {
    setHead(`
      <link rel="icon" href="/a.png">
      <link rel="shortcut icon" href="/b.ico">
    `);
    const kept = icons()[0];

    updateFavicon(ICON);

    expect(icons()).toEqual([kept]);
  });

  // R-45. Wikipedia lists apple-touch-icon first. Mutating that one repaints
  // nothing, because it is not the element Chrome paints the tab from, and
  // deleting the real favicon link on top of it left Chrome tracking a node
  // that no longer existed. Adding a rule to an open page then did nothing
  // until the page was reloaded, which is exactly what ADR-001 exists to stop.
  it('mutates the real favicon link, not an apple-touch-icon listed first', () => {
    setHead(`
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="icon" href="/favicon.ico">
    `);
    const apple = icons()[0];
    const favicon = icons()[1];

    updateFavicon(ICON);

    expect(favicon.getAttribute('href')).toBe(ICON);
    expect(favicon.hasAttribute(CHANGE_MARK)).toBe(true);
    expect(apple.getAttribute('href')).toBe('/apple.png');
    expect(apple.hasAttribute(CHANGE_MARK)).toBe(false);
  });

  it('leaves links that never reach the tab strip in place', () => {
    setHead(`
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="mask-icon" href="/mask.svg">
      <link rel="icon" href="/favicon.ico">
    `);

    updateFavicon(ICON);

    expect(icons().map(l => l.getAttribute('href'))).toEqual(['/apple.png', '/mask.svg', ICON]);
  });

  it('falls back to an apple-touch-icon when the page has no real favicon', () => {
    setHead('<link rel="apple-touch-icon" href="/apple.png">');
    const only = icons()[0];

    updateFavicon(ICON);

    expect(icons()[0]).toBe(only);
    expect(only.getAttribute('href')).toBe(ICON);
    expect(only.getAttribute('rel')).toBe('icon');
  });

  it('leaves non-icon head elements alone', () => {
    setHead('<title>t</title><meta name="x" content="y"><link rel="stylesheet" href="/s.css"><link rel="icon" href="/a.png">');
    updateFavicon(ICON);

    expect(document.querySelector('title')).toBeTruthy();
    expect(document.querySelector('meta[name="x"]')).toBeTruthy();
    expect(document.querySelector('link[rel="stylesheet"]')).toBeTruthy();
  });
});

describe('updateFavicon: pages with no icon link', () => {
  it('creates one, marked as ours', () => {
    setHead('<title>no icon here</title>');

    expect(updateFavicon(ICON)).toBe(true);

    const created = icons();
    expect(created).toHaveLength(1);
    expect(created[0].getAttribute('href')).toBe(ICON);
    expect(created[0].getAttribute('rel')).toBe('icon');
    expect(created[0].getAttribute(CHANGE_MARK)).toBe('true');
    expect(created[0].parentNode).toBe(document.head);
  });

  it('then reuses the element it created rather than making another', () => {
    setHead('');
    updateFavicon(ICON);
    const created = icons()[0];

    updateFavicon(OTHER);

    expect(icons()).toHaveLength(1);
    expect(icons()[0]).toBe(created);
  });
});

describe('readOriginalFaviconHref', () => {
  it('returns the page\'s own icon, ignoring ours', () => {
    setHead(`<link rel="icon" href="/ours.png" ${CHANGE_MARK}="true"><link rel="icon" href="/theirs.png">`);
    expect(readOriginalFaviconHref()).toBe('/theirs.png');
  });

  it('returns null when every icon link is ours', () => {
    setHead(`<link rel="icon" href="/ours.png" ${CHANGE_MARK}="true">`);
    expect(readOriginalFaviconHref()).toBeNull();
  });

  it('returns null on a page with no icon link', () => {
    setHead('<title>t</title>');
    expect(readOriginalFaviconHref()).toBeNull();
  });

  // Wikipedia lists apple-touch-icon before its real favicon, so a naive
  // first-match captured the wrong icon and restored it after a rule was
  // deleted. R-44.
  it('prefers the tab favicon over an apple-touch-icon listed first', () => {
    setHead('<link rel="apple-touch-icon" href="/apple.png"><link rel="icon" href="/favicon.ico">');
    expect(readOriginalFaviconHref()).toBe('/favicon.ico');
  });

  it('accepts "shortcut icon" as the tab favicon', () => {
    setHead('<link rel="mask-icon" href="/mask.svg"><link rel="shortcut icon" href="/favicon.ico">');
    expect(readOriginalFaviconHref()).toBe('/favicon.ico');
  });

  it('falls back to the only icon-ish link when there is no real favicon', () => {
    setHead('<link rel="apple-touch-icon" href="/apple.png">');
    expect(readOriginalFaviconHref()).toBe('/apple.png');
  });

  it('still ignores our own link when choosing the preferred one', () => {
    setHead(`<link rel="icon" href="/ours.png" ${CHANGE_MARK}="true"><link rel="apple-touch-icon" href="/apple.png">`);
    expect(readOriginalFaviconHref()).toBe('/apple.png');
  });
});

describe('removeMarkedFaviconLinks', () => {
  it('removes only the links we own', () => {
    setHead(`<link rel="icon" href="/theirs.png"><link rel="icon" href="/ours.png" ${CHANGE_MARK}="true">`);
    removeMarkedFaviconLinks();
    expect(icons().map(l => l.getAttribute('href'))).toEqual(['/theirs.png']);
  });
});

describe('hasFaviconHref', () => {
  it('reports whether the current icon is still ours', () => {
    setHead('<link rel="icon" href="/original.png">');
    updateFavicon(ICON);
    expect(hasFaviconHref(ICON)).toBe(true);

    // Simulate the page stealing the favicon back, which is what the backup
    // poller in content.ts exists to notice.
    icons()[0].setAttribute('href', '/stolen.png');
    expect(hasFaviconHref(ICON)).toBe(false);
  });

  it('is not fooled by a URL containing selector metacharacters', () => {
    const tricky = 'data:image/png;base64,A"]/*';
    setHead('<link rel="icon" href="/original.png">');
    updateFavicon(tricky);
    expect(hasFaviconHref(tricky)).toBe(true);
  });
});
