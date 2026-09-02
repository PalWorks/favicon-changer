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

const get = (keys: any, cb?: (r: any) => void) => {
  let out: Record<string, any> = {};
  if (keys === null || keys === undefined) out = { ...store };
  else if (typeof keys === 'string') out = { [keys]: store[keys] };
  else if (Array.isArray(keys)) keys.forEach(k => { out[k] = store[k]; });
  else Object.keys(keys).forEach(k => { out[k] = store[k] ?? keys[k]; });
  if (cb) { cb(out); return undefined as any; }
  return Promise.resolve(out);
};

const set = (items: any, cb?: () => void) => {
  Object.assign(store, items);
  if (cb) { cb(); return undefined as any; }
  return Promise.resolve();
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

const { getStorageData, getStorageUsage } = await import('./storage');

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

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
