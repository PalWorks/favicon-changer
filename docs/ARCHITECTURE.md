# Architecture

Favicon Changer Ultimate is a Chrome Manifest V3 extension that replaces the favicon of any
page according to user-defined rules. It has no backend, no accounts and no network dependency
of its own. Everything is a browser-local read/write against `chrome.storage.local`.

- **Stack**: React 19, TypeScript 5.8, Tailwind CSS 4 (via `@tailwindcss/postcss`), Vite 6, Vitest 4.
- **Size**: ~2,500 lines of first-party TypeScript/TSX plus a ~750-line emoji library.
- **Distribution**: Chrome Web Store, extension ID `egedbdckafdbomehjaihjhbcgmngmlah`.

---

## 1. The four execution contexts

An extension is not one program. It is four programs in four different sandboxes that share
nothing except `chrome.storage.local` and message passing. Knowing which context a file runs in
is the single most important fact about it.

| Context | Entry file | Built as | Lifetime | Can touch page DOM | Can call `chrome.tabs` |
|---|---|---|---|---|---|
| Toolbar popup | `index.html` → `index.tsx` → `App.tsx` | ESM | Dies on blur | No | Yes |
| Standalone editor window | `index.html?expanded=1` (same code) | ESM | Until closed | No | Yes |
| Options page | `options.html` → `Options.tsx` | ESM | Until closed | No | Yes |
| Service worker | `background.ts` | ESM | Wakes on event, dies idle | No | Yes |
| Content script | `content.ts` | IIFE | Lives with the page | **Yes, only here** | No |

Table name: **execution-contexts**

The popup and the standalone editor window run *the same React tree*; they differ only by the
`?expanded=1` query flag, read in [App.tsx](../App.tsx). The popup and the options page also
share their entire editor UI, [FaviconEditor](../components/FaviconEditor.tsx) takes a
`mode: 'popup' | 'options'` prop and branches internally.

---

## 2. Build pipeline

`npm run build` is **two sequential Vite builds** into the same `dist/`:

```
vite build                                # pass 1: ESM
  index.html    -> dist/popup.js    + dist/index.html
  options.html  -> dist/options.js  + dist/options.html
  background.ts -> dist/background.js
  public/*      -> dist/            (manifest.json, icons/)

vite build -c vite.content.config.ts      # pass 2: IIFE, emptyOutDir: false
  content.ts    -> dist/content.js
```

Two passes exist because **a content script cannot be an ES module**. Chrome injects content
scripts as classic scripts, so `import` statements would throw at runtime. Pass 2 therefore
sets `format: 'iife'` to inline every dependency (`utils/matcher`, `utils/logger`, `constants`)
into one self-contained file. Pass 2 must run second and must set `emptyOutDir: false`, or it
would wipe pass 1's output. See [vite.config.ts](../vite.config.ts) and
[vite.content.config.ts](../vite.content.config.ts).

`public/manifest.json` is copied verbatim, so **the manifest version is the source of truth for
the shipped version number**; `package.json`'s version is only for npm bookkeeping. Keep them
equal by hand.

---

## 3. The favicon write path: the load-bearing trick

This is the least obvious code in the repo and the part most likely to be "fixed" into a
regression. It lives in `updateFavicon()` in [utils/faviconDom.ts](../utils/faviconDom.ts),
which the content script is the only importer of. It was extracted from `content.ts` precisely so
it could be unit tested: [utils/faviconDom.test.ts](../utils/faviconDom.test.ts) asserts on the
**identity** of the mutated element, and 8 of its cases fail if the code is rewritten as
remove-and-append.

Chrome only repaints the tab-strip icon from a DOM change in two situations:

1. the tab is the **active** tab, or
2. the `href` of a `<link>` element **Chrome is already tracking** is mutated.

Appending a brand-new `<link rel="icon">`, or removing-then-appending one, is **not** picked up
for background tabs, Chrome keeps showing the load-time favicon until the tab is reloaded.
So `updateFavicon()` deliberately:

1. collects every `link[rel*='icon']`,
2. reuses the element already marked `data-fc-modified`, else the page's **own first** icon link
   (the one Chrome began tracking at load), and mutates its `href` in place,
3. creates a new link **only** when the page has no icon link at all,
4. skips the write entirely if the `href` is already correct (prevents a visible icon flash on
   redundant re-applies),
5. removes the other icon links so the browser cannot pick a stale one.

**Do not refactor this into a remove-and-append.** It is the reason background tabs update
without a reload, and it is how sites like Gmail update their own unread-count favicon. The test
suite will stop you, which is the point of it.

### Holding the icon against the page

Sites, especially SPAs, rewrite their own favicon after hydration, which would undo our
change. Two mechanisms defend it, both wired up in `setupObserver()`:

- A **MutationObserver** on `<head>` (`childList`, `subtree`, `attributes` filtered to
  `href`/`rel`). Mutations on elements carrying `data-fc-modified` are ignored, so we never
  react to our own writes. Real external changes are debounced by `OBSERVER_DEBOUNCE_MS`
  (100 ms) so an SPA re-hydration burst collapses into one re-apply instead of a mutation war.
- A **backup poller** every 2 s (`startVerificationInterval`), for changes an observer can miss.
  It **self-terminates** after `MAX_STABLE_CHECKS` (5) consecutive clean checks, so a quiet page
  stops waking the event loop after ~10 s. The observer re-arms it if the icon is later stolen.

### The do-no-harm rule

A `hasModified` module flag records whether *we* have ever mutated this page. When no rule
matches and `hasModified` is false, the content script touches **nothing**, no DOM write, no
observer, no interval. This was added because unconditional `<head>` churn broke some SPAs
(GA4's header component being the known case). Excluded domains return even earlier, before any
matching runs.

---

## 4. Data flow

### Applying a rule on page load

```
document_start: content.js injected (manifest declaration, <all_urls>)
   -> DOMContentLoaded -> applyRule()
      -> captureOriginalFavicon()          remembers the page's own icon for later restore
      -> chrome.storage.local.get(['rules','settings'])
      -> settings.excludedDomains contains hostname?  -> return, touch nothing
      -> findBestRule(url, hostname, rules)           utils/matcher.ts
         -> hit           -> updateFavicon(rule.faviconUrl) + setupObserver()
         -> miss + global fallback set -> updateFavicon(settings.defaultFaviconUrl)
         -> miss          -> restore original only if hasModified, then tear everything down
```

### Saving a rule from the UI

```
User picks emoji / uploads image / builds badge
   -> section component renders it to a 128px <canvas> (64px for emoji)
   -> canvas.toDataURL('image/png')  [+ compressFaviconDataUrl() for uploads]
   -> FaviconEditor.handleSave() builds the FaviconRule
   -> utils/storage.saveRule() -> chrome.storage.local.set({rules})
   -> notifyTabs(): for every non-restricted tab
        -> ensureContentScriptReady(tabId)   PING; chrome.scripting.executeScript if silent
        -> sendMessage {type:'RulesUpdated'}
   -> content script re-runs applyRule() -> href mutation -> tab repaints, no reload
   -> options page also re-renders via chrome.storage.onChanged
```

The favicon itself is almost always stored **inline as a `data:` URL** inside the rule, not as a
remote reference. That is what makes the extension work offline and privately, and it is why
uploads are downscaled to 128 px and compressed before saving.

---

## 5. Message protocol

Three message types, all sent to a tab's content script. There is no messaging *to* the service
worker, and the content script never initiates a message.

| Type | Sender | Handler | Effect |
|---|---|---|---|
| `PING` | `utils/messaging.ensureContentScriptReady` | `content.ts` | Replies `{ok:true}` to prove the script is live |
| `RulesUpdated` | `utils/storage.notifyTabs` | `content.ts` | Re-runs `applyRule()` |
Table name: **message-protocol**

A third type, `RESET_ICON`, was handled here but never sent by anything; it was removed on
2026-09-02. The content script also carries a `window.__fcuContentLoaded` latch so a second
injected copy does not register a second listener (both would call `sendResponse`) or a second
observer.

`ensureContentScriptReady` exists because the manifest-declared content script may not be listening
yet (or at all, on a page loaded before an update). It pings, and on silence injects `content.js`
via `chrome.scripting.executeScript`, waits 200 ms, and retries up to 3 times. `isRestrictedUrl()`
gates this to skip `chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:` and the
Web Store, where injection always fails.

---

## 6. Storage layout

One flat `chrome.storage.local` namespace, no nesting beyond this:

| Key | Type | Written by | Purpose |
|---|---|---|---|
| `rules` | `Record<ruleId, FaviconRule>` | storage.ts | All favicon rules, keyed by generated id |
| `settings` | `GlobalSettings` | storage.ts | `defaultFaviconUrl`, `excludedDomains[]` |
| `migrated` | `boolean` | storage.ts | Latch so the v1 format migration scan runs once |
| `pendingEditorTarget` | `PendingEditorTarget` | storage.ts, background.ts | Hand-off payload popup → standalone window; consumed and deleted on read |
| `enable_debug_logging` | `boolean` | logger.ts | Verbose logging opt-in |
| `debug_logs` | `string[]` | logger.ts | Ring buffer, last 1000 lines |

Table name: **storage-keys**

Rules were originally keyed by domain (`{"google.com": {...}}`). They are now keyed by a
generated id so one site can have several rules of different match types. `getStorageData()`
migrates the old shape on first read and sets `migrated: true` so the scan never repeats. See
[DECISIONS.md](DECISIONS.md).

---

## 7. The OS popup workaround

On Linux, ChromeOS and OpenBSD, Chrome destroys the toolbar popup the moment a native
file-picker dialog takes focus, which silently aborts every upload. The workaround spans three
files and is easy to misread as redundancy:

- [background.ts](../background.ts) calls `chrome.runtime.getPlatformInfo()` on every service
  worker activation. On an affected OS it calls `chrome.action.setPopup({popup: ''})`, which
  disables the bubble so that `chrome.action.onClicked` fires instead; the listener opens
  `index.html?expanded=1` as a 460×720 popup **window** (which does not close on blur), reusing
  and reloading an already-open one rather than stacking windows.
- [utils/storage.ts](../utils/storage.ts) `openExpandedEditor()` does the same hand-off from
  inside the popup, writing `pendingEditorTarget` first so the new window knows which tab it is
  editing.
- [FaviconEditor.tsx](../components/FaviconEditor.tsx) detects the affected OS from the user
  agent and passes `onRequestExpand` down to `UploadSection`, which turns the "Browse" button
  into "Open" (a window hand-off) instead of a direct file dialog.

Drag-and-drop needs none of this, no OS dialog opens, so it works directly in the bubble
everywhere.

---

## 8. Module map

```
index.tsx / App.tsx ........... popup + expanded-window bootstrap
Options.tsx ................... options page bootstrap, storage.onChanged live sync
background.ts ................. service worker: OS detection, action routing
content.ts .................... orchestration: rule lookup, observer, polling

components/
  FaviconEditor.tsx ........... shared editor engine for popup and options (~520 lines)
  Accordion / Button / FaviconPreview ... presentational primitives
  editor/UploadSection.tsx .... file + drag-drop + URL, canvas fit modes, MIME repair
  editor/EmojiSection.tsx ..... searchable emoji grid -> 64px canvas
  editor/BadgeSection.tsx ..... badge/overlay compositor over the live site icon
  options/GlobalSettings.tsx .. fallback favicon, exclusion list, import/export
  options/RulesList.tsx ....... rule table, click to edit
  options/DebugLogs.tsx ....... log viewer, verbose toggle, copy/download
  shared/ErrorBoundary.tsx .... wraps both React roots

utils/
  faviconDom.ts ............... the ONLY DOM-mutating code. Imported by content.ts alone
  faviconObserver.ts .......... whose favicon write was it, and the debounce (ADR-014)
  matcher.ts .................. findBestRule / findConflictingRule  (pure, unit-tested)
  rating.ts ................... when to ask for a review, and the rules about how (ADR-015)
  ruleScope.ts ................ the editor's scope/pattern machine (pure, ADR-016)
  storage.ts .................. all chrome.storage access, migration, import/export, hand-off
  messaging.ts ................ isRestrictedUrl, PING-then-inject, sendMessageToTab
  canvas.ts ................... drawOverlay, drawBadge, compression, data-URL MIME repair
  validation.ts ............... regex/URL/file-type/file-size guards
  logger.ts ................... opt-in persistent logger, memory-cached enable flag

types.ts ...................... FaviconRule, GlobalSettings, StorageData, MatchType
constants.ts .................. tuning constants, IS_DEV, EMOJI_LIBRARY
```

`utils/matcher.ts` is deliberately pure and dependency-light so it can be imported by both the
IIFE content script and the React pages, and unit-tested in plain Node.

---

## 9. Dev-mode shim

`IS_DEV` in [constants.ts](../constants.ts) is `!globalThis.chrome?.storage`, true when the code
runs under `npm run dev` in a normal browser tab rather than as an installed extension. In that
mode `utils/storage.ts` transparently swaps `chrome.storage.local` for `localStorage` and
`getCurrentTabInfo()` returns a fixed `example.com` stub, so the React UI can be developed with
hot reload. The content script has no dev mode; favicon behaviour must be tested unpacked.

See [DOMAIN.md](DOMAIN.md) for rule semantics, [DECISIONS.md](DECISIONS.md) for why these
choices were made, and [LIMITATIONS.md](LIMITATIONS.md) for where this design currently leaks.
