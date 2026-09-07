# Testing

## Philosophy

Extension code splits cleanly into three testability tiers, and the strategy follows that split:

| Tier | Files | How it is verified | Status |
|---|---|---|---|
| Pure logic | `matcher`, `validation`, `patterns`, `importRules`, `canvas` string helpers | Vitest in plain Node, fast, deterministic | covered |
| Browser-API logic | `storage` (migration, usage), `messaging` (`isRestrictedUrl`) | Vitest with a stubbed `chrome` global | migration and URL gating covered; the messaging and logging paths are not |
| DOM behaviour | `utils/faviconDom.ts` | Vitest under jsdom | covered, including the ADR-001 identity lock |
| Canvas + component behaviour | `utils/canvas.ts` drawing, `content.ts` orchestration, all components | Manual, unpacked, in a real browser | manual only |

Table name: **test-tiers**

The highest-value target is tier 1, because rule matching is where user-visible correctness
lives and it needs no browser at all. `utils/matcher.ts` was written free of Chrome API calls
specifically so it can be tested this way, keep it that way.

Current coverage: **280 tests across 11 files**, run time under two seconds.

| File | Covers |
|---|---|
| `matcher.test.ts` | Every precedence tier and pair, within-tier specificity, prefix semantics, paused rules, the conflict detector, `patternMatches` |
| `importRules.test.ts` | Whole-file rejects, per-rule validation, scheme allow-list, field rebuilding, metadata cleaning |
| `validation.test.ts` | Regex and URL validity, the ReDoS length cap, the icon scheme allow-list, byte estimation |
| `patterns.test.ts` | Regex escaping, prefix suggestion (including the Sheets case and `file:`), anchored regex suggestion |
| `canvas.test.ts` | `normalizeImageDataUrl`, the SVG-mislabelled-as-PNG repair |
| `messaging.test.ts` | `isRestrictedUrl`, the gate in front of every injection |
| `storage.test.ts` | The v1 format migration, its latch, settings defaults, storage usage |
| `ruleScope.test.ts` | The editor's scope machine: which match type is selected, what pattern it saves, and whether that pattern is valid. Asserts on event *sequences*, since every bug it exists to prevent was an interaction between two steps. Includes the R-42 and "Edit that rule instead" regressions as named cases |
| `faviconObserver.test.ts` | Whose write a head mutation was (ADR-014): a page write on the element we own, our own write, a re-write of the same value, an appended icon link, unrelated head churn; plus the debounce, coalescing, settling after a re-apply, and disconnect |
| `rating.test.ts` | The review prompt's decision: day keys in local time, defensive parsing of hand-edited storage, one count per day, and that a dismissal is permanent |
| `faviconDom.test.ts` | The favicon write path: element identity (ADR-001), which link is chosen when a page has several (R-45), the no-op write, stale-link removal, pages with no icon link, original-icon capture and its preference for the real favicon over an `apple-touch-icon` (R-44) |

Table name: **test-files**

`faviconDom.test.ts` is the only DOM test, and it opts in per file with a
`// @vitest-environment jsdom` docblock rather than switching the whole suite, which keeps the
other seven files running in plain Node. It asserts on the **identity** of the mutated element,
not just its final `href`: a replaced node ends up with the right `href` and still fails in a
real browser, which is exactly the regression ADR-001 exists to prevent. Rewriting the function
as remove-and-append turns 8 of its cases red, which was verified by doing it.

**The `URL` parser is not the same in Node and in Chrome, and the difference is a trap.**
`new URL('https://not a url at all')` throws here and *succeeds* in the browser, which
percent-encodes the characters that are illegal in a host. Any code that treats "the parser did
not throw" as "this input was valid" will therefore pass in this suite and fail in the product,
which is exactly what R-49 was: a domain rule saved with the matcher
`not%20a%20url%20at%20all`. Validate the shape of what the parser returns
(`looksLikeHostname()`), and test the validator directly rather than through the parser, because
in Node the input never reaches it.

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

## Driving the real extension

The command-line flags do not work and the DevTools protocol does. This was wrong in an earlier
version of this file, and correcting it turned four bugs up in an afternoon, including one that
broke the product's core promise on a large class of sites (R-42 to R-45).

**What does not work:** `--load-extension` and `--disable-extensions-except`. Chrome 152 accepts
them on the command line and then silently ignores them: no extension target appears, the service
worker never starts, `onInstalled` never fires, and nothing is logged. Verified headless, and
headful under `xvfb`, with the flags confirmed present on the real process command line.

**What does work:** the `Extensions.loadUnpacked` command on the browser-level DevTools session.
Against a Chrome already running with `--remote-debugging-port`:

```js
// node, using the global WebSocket in Node 22+
const { webSocketDebuggerUrl } = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const ws = new WebSocket(webSocketDebuggerUrl);
ws.onopen = () => ws.send(JSON.stringify({
  id: 1, method: 'Extensions.loadUnpacked', params: { path: '/absolute/path/to/dist' },
}));
// -> { id: 1, result: { id: '<the extension id>' } }
```

The extension is then fully live: `background.js` appears as a `service_worker` target,
`onInstalled` fires and opens the options page, content scripts run in every tab. From there,
`Target.attachToTarget` plus `Runtime.evaluate` drives any of it:

- **The options and popup pages** are ordinary page targets. React inputs need the native value
  setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) followed by
  an `input` event; buttons take a plain `.click()`. The `aria-label`s added by R-30 are what make
  controls findable, so the accessibility work pays for itself twice.
- **Extension storage** is readable and writable from the service-worker target with
  `chrome.storage.local`. Use it to set up preconditions, not to perform the step under test: a
  rule written directly does not exercise `saveRule` or `notifyTabs`.
- **`chrome.runtime.reload()`** in the service-worker target reloads the extension from disk after
  a rebuild. It orphans the content script in every open tab and closes extension pages, so reload
  the test tabs afterwards or the next result is a false negative.

**Reading the result matters more than driving it.** Three signals, in increasing order of truth:

| Signal | How | What it proves |
|---|---|---|
| The DOM | `Runtime.evaluate` on the page target, read `link[rel*=icon]` | The content script ran and wrote what it meant to |
| The tab's favicon | the `faviconUrl` field in `http://127.0.0.1:9222/json/list` | Chrome's favicon driver accepted the change |
| The tab strip | screenshot the browser window (`import -window <id>` on X11) and look | What the user actually sees |

The DOM alone is not enough, and believing it is how R-45 survived: the DOM held our icon,
`data-fc-modified` and all, while the tab strip still showed the site's own. Poll `faviconUrl`
on a short interval to get a timeline rather than a single reading, since a background tab is not
instantaneous.

**Leave the profile as you found it.** Clear `chrome.storage.local`, close the tabs you opened,
and remove the unpacked extension, particularly when the profile is someone's daily browser and
already has the store build installed.

What can be automated without loading the extension at all, and is worth doing first:

- `npm run check` for logic and types.
- `npm run dev` plus a browser driver for the React surfaces. The pages render with the
  `localStorage` storage shim, so editor behaviour, button states and rule writes can all be
  driven and asserted without an extension at all. This is how R-05's "no writes while typing"
  and R-03's "one rule, still regex, createdAt preserved" were confirmed.
- `node --check dist/*.js` to catch a broken bundle, and a grep of `dist/content.js` to confirm
  it is still a self-contained IIFE with no bare `import`.

Items 1 to 6 below have all been run this way against a real Chrome. Items 7 to 11 still need
hands: they involve the OS file dialog, drag and drop, or two extension surfaces open at once.

---

## What a change must be tested against manually

`npm run build`, reload unpacked, then walk this list. These are the cases that have actually
broken before, in the order they broke. Items 1 to 6 can be driven over the DevTools protocol as
described above; 7 to 11 cannot.

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

1. **The messaging paths**: `ensureContentScriptReady`'s ping-then-inject-then-retry, and
   `notifyTabs`'s decision about which tabs to touch. Both need a `chrome.tabs` stub, which
   `storage.test.ts` already demonstrates.
2. **`logger.ts` batching**: that concurrent writers do not lose entries, and that `pagehide`
   flushes. Needs fake timers.
3. **`content.ts` orchestration**: the observer debounce, the self-stopping poller, and the
   do-nothing-on-unmatched-pages guard (ADR-002). Now more approachable, since the DOM half is
   already isolated and jsdom is available; needs `chrome` and `MutationObserver` stubs.
4. **Canvas drawing** (`drawBadge`, `drawOverlay`, `compressFaviconDataUrl`): needs a canvas
   implementation, so it is the most expensive and the least likely to regress silently.

Tests, the type check and the build all run on `git push` (ADR-012). They do **not** run on a
pull request from a machine without the hook installed, which is the one gap left by not having a
CI workflow. See [../ROADMAP.md](../ROADMAP.md).
