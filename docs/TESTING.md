# Testing

## Philosophy

Extension code splits cleanly into three testability tiers, and the strategy follows that split:

| Tier | Files | How it is verified | Status |
|---|---|---|---|
| Pure logic | `matcher`, `validation`, `patterns`, `importRules`, `canvas` string helpers | Vitest in plain Node, fast, deterministic | covered |
| Browser-API logic | `storage` (migration, usage), `messaging` (`isRestrictedUrl`) | Vitest with a stubbed `chrome` global | migration and URL gating covered; the messaging and logging paths are not |
| Canvas + DOM behaviour | `utils/canvas.ts` drawing, `content.ts`, all components | Manual, unpacked, in a real browser | manual only |

Table name: **test-tiers**

The highest-value target is tier 1, because rule matching is where user-visible correctness
lives and it needs no browser at all. `utils/matcher.ts` was written free of Chrome API calls
specifically so it can be tested this way, keep it that way.

Current coverage: **165 tests across 7 files**, run time under a second.

| File | Covers |
|---|---|
| `matcher.test.ts` | Every precedence tier and pair, within-tier specificity, prefix semantics, paused rules, the conflict detector, `patternMatches` |
| `importRules.test.ts` | Whole-file rejects, per-rule validation, scheme allow-list, field rebuilding, metadata cleaning |
| `validation.test.ts` | Regex and URL validity, the ReDoS length cap, the icon scheme allow-list, byte estimation |
| `patterns.test.ts` | Regex escaping, prefix suggestion (including the Sheets case and `file:`), anchored regex suggestion |
| `canvas.test.ts` | `normalizeImageDataUrl`, the SVG-mislabelled-as-PNG repair |
| `messaging.test.ts` | `isRestrictedUrl`, the gate in front of every injection |
| `storage.test.ts` | The v1 format migration, its latch, settings defaults, storage usage |

Table name: **test-files**

The stubbing pattern for `storage.test.ts` is worth knowing: `chrome` must be stubbed **before**
the module is imported, because `constants.ts` computes `IS_DEV` from the presence of
`chrome.storage` at module-evaluation time and `storage.ts` silently swaps in `localStorage`
without it. Hence `vi.stubGlobal` at the top of the file, then `await import('./storage')`. The
stub also has to support both the callback and promise forms of `chrome.storage.local.get`,
because `logger.ts` uses one and `storage.ts` the other.

---

## Running

```bash
npm test              # once, CI-style
npx vitest            # watch
npx vitest run --coverage   # needs @vitest/coverage-v8 installed first
npx tsc --noEmit      # type check, separate from tests, and not part of the build
```

`npm run check` runs the type check and the tests together. Both, plus the production build, run
automatically before every `git push` via [.githooks/pre-push](../.githooks/pre-push); there is no
CI workflow, by decision (ADR-012).

The type check is only meaningful as of 2026-09-02: before that, React's type definitions were
not installed at all, so component code was inferred from JavaScript rather than checked
(LIMITATIONS L-29). Installing them surfaced a real prop bug immediately (L-30). If
`@types/react` ever disappears from `package.json`, `allowJs: true` will quietly restore that
blindness rather than error.

There is no `vitest.config.ts`. Defaults apply: Node environment, `*.test.ts` discovery. A
`jsdom` environment would be needed before testing anything that touches `document` or `canvas`.

---

## Conventions

**Stub the logger.** Every `utils/` module imports `logger`, which calls `chrome.storage` at
module scope. In Node that throws. Mock it at the top of the file:

```ts
vi.mock('./logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
```

**Use a rule factory,** not inline literals, `FaviconRule` has nine fields and only two matter
per test. The existing `rule()` helper in `matcher.test.ts` takes `matchType` and `matcher` as
required and fills the rest.

**Name the behaviour, not the function.** `it('exact URL beats domain rule on the same site')`,
not `it('findBestRule works')`.

**Assert on identity or on a marker field.** The existing tests return the rule object and check
`toBe(r)` or set a distinctive `faviconUrl` (`'exact.png'`) to prove *which* rule won. Do not
assert on `createdAt`, it is overwritten on every save.

---

## The manual list really is manual

Loading the extension cannot be automated on this machine. Chrome 152 accepts
`--load-extension` and `--disable-extensions-except` on the command line and then **silently
ignores them**: no extension target appears over the DevTools protocol, the service worker never
starts, `onInstalled` never opens the options page, and nothing is logged. Verified headless, and
headful under `xvfb`, with the flags confirmed present on the real process command line. So there
is no way to drive a real extension build from a script here; `chrome://extensions` and
**Load unpacked** is the only route.

What *can* be automated, and is worth doing before the manual pass:

- `npm run check` for logic and types.
- `npm run dev` plus a browser driver for the React surfaces. The pages render with the
  `localStorage` storage shim, so editor behaviour, button states and rule writes can all be
  driven and asserted without an extension at all. This is how R-05's "no writes while typing"
  and R-03's "one rule, still regex, createdAt preserved" were confirmed.
- `node --check dist/*.js` to catch a broken bundle, and a grep of `dist/content.js` to confirm
  it is still a self-contained IIFE with no bare `import`.

What cannot: everything that depends on the content script actually running in a page. That is
the list below, and it is exactly the part where this codebase has historically broken.

---

## What a change must be tested against manually

`npm run build`, reload unpacked, then walk this list. These are the cases that have actually
broken before, in the order they broke:

1. **Active tab**, apply an emoji rule; the tab icon changes immediately.
2. **Background tab**, apply a rule to a page in a *non-focused* tab; its icon must change
   without a reload. This is the one that regresses when `updateFavicon` is refactored.
   See [DECISIONS.md](DECISIONS.md) ADR-001.
3. **SPA that rewrites its own icon** (Gmail or Google Analytics). Our icon must win and must not
   oscillate; watch the CPU, a mutation war is visible as a pinned core.
4. **A page with no rule**, must stay completely untouched. Confirm nothing is logged and the
   site's own icon is intact. ADR-002.
5. **An excluded domain**, add it in options; the page must be inert even with a matching rule.
6. **Rule deletion**, the original favicon comes back on the affected tabs.
7. **Upload on Linux**, the "Open" button must produce a standalone window whose file picker
   survives; the file must apply to the tab the popup was opened from. ADR-007.
8. **Drag-and-drop upload in the bubble**, works on every OS with no hand-off.
9. **An SVG favicon site** (github.com), export the original, re-upload the exported file; it
   must decode rather than showing a broken image. This is what `normalizeImageDataUrl` guards.
10. **Import/export round trip**, export, delete all rules, re-import, rules return.
11. **Options ⇄ popup live sync**, with both open, a change in one appears in the other.

---

## Gaps worth closing, highest value first

1. **A `jsdom` suite for `content.ts`'s `updateFavicon`.** Asserting that the *same element
   instance* is mutated rather than replaced would lock ADR-001 into the test suite, which is
   where it belongs: it is the one behaviour that breaks silently, only on background tabs, and
   only in a real browser. This needs the `jsdom` devDependency, so it is a dependency decision
   rather than just work (ROADMAP R-14).
2. **The messaging paths**: `ensureContentScriptReady`'s ping-then-inject-then-retry, and
   `notifyTabs`'s decision about which tabs to touch. Both need a `chrome.tabs` stub, which
   `storage.test.ts` already demonstrates.
3. **`logger.ts` batching**: that concurrent writers do not lose entries, and that `pagehide`
   flushes. Needs fake timers.
4. **Canvas drawing** (`drawBadge`, `drawOverlay`, `compressFaviconDataUrl`): needs a canvas
   implementation, so it is the most expensive and the least likely to regress silently.

Tests, the type check and the build all run on `git push` (ADR-012). They do **not** run on a
pull request from a machine without the hook installed, which is the one gap left by not having a
CI workflow. See [../ROADMAP.md](../ROADMAP.md).
