import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A chrome.storage.local stub covering both call styles, because logger.ts uses
 * the promise form and storage.ts uses callbacks.
 *
 * It has to be installed BEFORE storage.ts is imported: constants.ts computes
 * IS_DEV from the presence of chrome.storage at module-evaluation time, and
 * storage.ts silently swaps in localStorage when it is absent.
 */
const store: Record<string, any> = {};

// Both are deferred by a turn on purpose. A synchronous stub hides the whole
// class of bug these tests exist for: chrome.storage has no transactions, so a
// read-modify-write that is not serialised loses the other writer's change, and
// with an instant stub the two never overlap. See ROADMAP R-65.
const defer = (fn: () => void) => { setTimeout(fn, 0); };

const get = (keys: any, cb?: (r: any) => void) => {
  const read = () => {
    let out: Record<string, any> = {};
    if (keys === null || keys === undefined) out = { ...store };
    else if (typeof keys === 'string') out = { [keys]: store[keys] };
    else if (Array.isArray(keys)) keys.forEach(k => { out[k] = store[k]; });
    else Object.keys(keys).forEach(k => { out[k] = store[k] ?? keys[k]; });
    return out;
  };
  if (cb) { defer(() => cb(read())); return undefined as any; }
  return new Promise(resolve => defer(() => resolve(read())));
};

// Set by one test to make the next write fail the way chrome does, through
// runtime.lastError rather than by throwing.
let failNextSet: string | null = null;

const set = (items: any, cb?: () => void) => {
  const write = () => {
    if (failNextSet) {
      (globalThis as any).chrome.runtime.lastError = { message: failNextSet };
      failNextSet = null;
      return false;
    }
    Object.assign(store, items);
    return true;
  };
  if (cb) {
    defer(() => {
      const ok = write();
      cb();
      if (!ok) (globalThis as any).chrome.runtime.lastError = undefined;
    });
    return undefined as any;
  }
  return new Promise<void>(resolve => defer(() => { write(); resolve(); }));
};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get,
      set,
      remove: (key: any, cb?: () => void) => { delete store[key]; if (cb) cb(); return Promise.resolve(); },
      getBytesInUse: (_keys: any, cb: (n: number) => void) => cb(JSON.stringify(store).length),
      QUOTA_BYTES: 10485760,
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
  runtime: { lastError: undefined },
  tabs: { query: (_q: any, cb: (t: any[]) => void) => cb([]) },
});

vi.mock('./logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./logger')>();
  return {
    ...actual,
    logger: { ...actual.logger, info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const { logger } = await import('./logger');
const { getStorageData, getStorageUsage, saveRule, saveSettings, deleteRule } = await import('./storage');

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

/**
 * Lets the deferred stub settle.
 *
 * getStorageData deliberately does NOT await the migration latch write: it
 * returns the rules and lets the latch land on its own, so the first read is
 * not held up by a write nobody is waiting for. Anything asserting on what was
 * *persisted*, rather than on what was returned, therefore has to wait a turn.
 */
const settled = () => new Promise(resolve => setTimeout(resolve, 1));

describe('getStorageData migration', () => {
  // The v1 format keyed rules by domain, which allows only one rule per site and
  // cannot represent exact_url, prefix or regex at all. See ADR-005.
  const OLD = {
    'google.com': { domain: 'google.com', faviconUrl: 'data:image/png;base64,AAA=', type: 'upload', createdAt: 111 },
    'example.com': { domain: 'example.com', faviconUrl: 'data:image/png;base64,BBB=' },
  };

  it('rewrites domain-keyed rules to id-keyed rules', async () => {
    store.rules = structuredClone(OLD);

    const { rules } = await getStorageData();
    const values = Object.values(rules);

    expect(values).toHaveLength(2);
    // Keyed by the rule's own id now, not by domain.
    Object.entries(rules).forEach(([key, rule]) => expect(key).toBe(rule.id));
    expect(Object.keys(rules)).not.toContain('google.com');

    const google = values.find(r => r.matcher === 'google.com')!;
    expect(google.matchType).toBe('domain');       // closest equivalent of v1 behaviour
    expect(google.sourceType).toBe('upload');
    expect(google.createdAt).toBe(111);
    expect(google.faviconUrl).toBe('data:image/png;base64,AAA=');
  });

  it('gives a migrated rule a createdAt when the old one had none', async () => {
    store.rules = structuredClone(OLD);
    const { rules } = await getStorageData();
    const example = Object.values(rules).find(r => r.matcher === 'example.com')!;
    expect(typeof example.createdAt).toBe('number');
    expect(example.createdAt).toBeGreaterThan(0);
  });

  it('persists the result and latches so the scan never runs twice', async () => {
    store.rules = structuredClone(OLD);
    await getStorageData();
    await settled();

    expect(store.migrated).toBe(true);
    // What was written back is the new shape, not the old one.
    Object.entries(store.rules).forEach(([key, rule]: [string, any]) => {
      expect(rule.id).toBe(key);
      expect(rule.matcher).toBeTruthy();
    });
  });

  it('leaves already-migrated storage completely alone', async () => {
    // Deliberately old-shaped data behind the latch: it must be returned as-is,
    // proving the scan really is skipped rather than merely idempotent.
    store.migrated = true;
    store.rules = { 'legacy-key': { domain: 'old.com', faviconUrl: 'x' } };

    const { rules } = await getStorageData();
    expect(Object.keys(rules)).toEqual(['legacy-key']);
  });

  it('sets the latch even when there was nothing to migrate', async () => {
    store.rules = {
      abc: { id: 'abc', matcher: 'example.com', matchType: 'domain', faviconUrl: 'x', sourceType: 'upload', createdAt: 1 },
    };
    await getStorageData();
    await settled();
    expect(store.migrated).toBe(true);
  });

  it('passes new-format rules through untouched', async () => {
    const rule = { id: 'abc', matcher: 'https://x.test/a', matchType: 'prefix', faviconUrl: 'x', sourceType: 'emoji', createdAt: 1, enabled: false };
    store.rules = { abc: structuredClone(rule) };
    const { rules } = await getStorageData();
    expect(rules.abc).toEqual(rule);
  });

  it('returns defaults for empty storage', async () => {
    const { rules, settings } = await getStorageData();
    expect(rules).toEqual({});
    expect(settings.excludedDomains).toEqual([]);
  });

  it('fills in missing settings keys without dropping the ones present', async () => {
    store.settings = { defaultFaviconUrl: 'https://x.test/i.png' };
    const { settings } = await getStorageData();
    expect(settings.defaultFaviconUrl).toBe('https://x.test/i.png');
    expect(settings.excludedDomains).toEqual([]);
  });
});

describe('getStorageUsage', () => {
  it('reports bytes against the quota', async () => {
    store.rules = { a: { id: 'a' } };
    const usage = await getStorageUsage();
    expect(usage.bytes).toBeGreaterThan(0);
    expect(usage.quota).toBe(10485760);
    expect(usage.percent).toBeCloseTo((usage.bytes / usage.quota) * 100, 6);
  });
});

// --- Mutations -------------------------------------------------------------
//
// Every mutation here is a read-modify-write over a store with no
// transactions, which is the most dangerous shape in this codebase: get it
// wrong and a rule is not duplicated, it is gone. Reproduced in a real browser
// before these were written (ROADMAP R-65).

const rule = (over: Partial<import('../types').FaviconRule> = {}): import('../types').FaviconRule => ({
  id: 'r1',
  matcher: 'example.com',
  matchType: 'domain',
  faviconUrl: 'data:image/png;base64,AAAA',
  sourceType: 'emoji',
  createdAt: 100,
  ...over,
});

describe('saveRule', () => {
  it('writes the rule', async () => {
    await saveRule(rule());
    expect(Object.keys(store.rules)).toEqual(['r1']);
  });

  it('collapses a second rule for the same scope and matcher, keeping the new one', async () => {
    // Two quick clicks used to leave both, and findBestRule breaks an exact tie
    // by keeping the EARLIER rule, so the user's last choice silently lost.
    await saveRule(rule({ id: 'first', faviconUrl: 'data:image/png;base64,FIRST' }));
    await saveRule(rule({ id: 'second', faviconUrl: 'data:image/png;base64,SECOND' }));

    const ids = Object.keys(store.rules);
    expect(ids).toEqual(['second']);
    expect(store.rules.second.faviconUrl).toBe('data:image/png;base64,SECOND');
  });

  it('keeps the earliest createdAt when it collapses one, since the list orders by it', async () => {
    await saveRule(rule({ id: 'first', createdAt: 100 }));
    await saveRule(rule({ id: 'second', createdAt: 500 }));
    expect(store.rules.second.createdAt).toBe(100);
  });

  it('does not treat a different scope on the same matcher as a duplicate', async () => {
    await saveRule(rule({ id: 'a', matchType: 'domain', matcher: 'example.com' }));
    await saveRule(rule({ id: 'b', matchType: 'prefix', matcher: 'example.com' }));
    expect(Object.keys(store.rules).sort()).toEqual(['a', 'b']);
  });

  it('does not treat a different matcher in the same scope as a duplicate', async () => {
    await saveRule(rule({ id: 'a', matcher: 'a.example' }));
    await saveRule(rule({ id: 'b', matcher: 'b.example' }));
    expect(Object.keys(store.rules).sort()).toEqual(['a', 'b']);
  });

  it('re-saving the same id is an edit, not a collapse', async () => {
    await saveRule(rule({ id: 'r1', faviconUrl: 'data:image/png;base64,ONE' }));
    vi.mocked(logger.info).mockClear();
    await saveRule(rule({ id: 'r1', faviconUrl: 'data:image/png;base64,TWO' }));

    expect(Object.keys(store.rules)).toEqual(['r1']);
    expect(store.rules.r1.faviconUrl).toBe('data:image/png;base64,TWO');
    // And it must not report having removed a duplicate. The log is the support
    // channel for this product, so a line claiming a rule was deleted when none
    // was is a false lead in exactly the situation it gets read.
    const collapseLines = vi.mocked(logger.info).mock.calls
      .filter(([message]) => String(message).includes('Collapsing'));
    expect(collapseLines).toEqual([]);
  });

  it('reports the collapse when there really was one', async () => {
    await saveRule(rule({ id: 'first' }));
    vi.mocked(logger.info).mockClear();
    await saveRule(rule({ id: 'second' }));
    const collapseLines = vi.mocked(logger.info).mock.calls
      .filter(([message]) => String(message).includes('Collapsing'));
    expect(collapseLines).toHaveLength(1);
    expect(collapseLines[0][1]).toMatchObject({ kept: 'second', removed: 'first' });
  });

  it('a failed write is reported to its caller and does not block the next one', async () => {
    // Behind the migration latch, so the only write in flight is the rule.
    // Without this, getStorageData's fire-and-forget latch write consumes the
    // injected failure and the test proves nothing.
    store.migrated = true;
    failNextSet = 'QUOTA_BYTES quota exceeded';
    await expect(saveRule(rule({ id: 'doomed', matcher: 'doomed.example' }))).rejects.toThrow(/quota/i);

    // The queue must still be usable: a rejected write that poisoned it would
    // take every later save down with it.
    await saveRule(rule({ id: 'after', matcher: 'after.example' }));
    expect(Object.keys(store.rules)).toEqual(['after']);
  });

  it('loses neither of two saves started at the same moment', async () => {
    // THE regression test. Unserialised, the second read happens before the
    // first write and one rule vanishes entirely.
    await Promise.all([
      saveRule(rule({ id: 'a', matcher: 'a.example' })),
      saveRule(rule({ id: 'b', matcher: 'b.example' })),
    ]);
    expect(Object.keys(store.rules).sort()).toEqual(['a', 'b']);
  });

  it('loses none of ten saves started at the same moment', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => saveRule(rule({ id: `r${i}`, matcher: `s${i}.example` }))),
    );
    expect(Object.keys(store.rules)).toHaveLength(10);
  });

  it('does not write settings back, so it cannot revert a concurrent settings change', async () => {
    store.settings = { excludedDomains: ['keep.example'], defaultFaviconUrl: 'https://cdn/x.png' };
    await saveRule(rule());
    expect(store.settings).toEqual({ excludedDomains: ['keep.example'], defaultFaviconUrl: 'https://cdn/x.png' });
  });

  it('survives a rule deleted at the same moment as another is saved', async () => {
    store.rules = { old: rule({ id: 'old', matcher: 'old.example' }) };
    await Promise.all([
      deleteRule('old'),
      saveRule(rule({ id: 'new', matcher: 'new.example' })),
    ]);
    expect(Object.keys(store.rules)).toEqual(['new']);
  });
});

describe('saveSettings', () => {
  it('does not write rules back, so it cannot revert a concurrent rule save', async () => {
    store.rules = { keep: rule({ id: 'keep' }) };
    await saveSettings({ excludedDomains: ['a.example'] });
    expect(Object.keys(store.rules)).toEqual(['keep']);
    expect(store.settings).toEqual({ excludedDomains: ['a.example'] });
  });

  it('loses neither a settings change nor a rule saved at the same moment', async () => {
    await Promise.all([
      saveSettings({ excludedDomains: ['a.example'] }),
      saveRule(rule({ id: 'r1' })),
    ]);
    expect(store.settings.excludedDomains).toEqual(['a.example']);
    expect(Object.keys(store.rules)).toEqual(['r1']);
  });
});
