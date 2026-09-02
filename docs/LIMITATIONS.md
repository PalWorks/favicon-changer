# Limitations

Known defects, edge cases and technical debt, as of v1.3.0 (2026-09-02). This file is the
reference; the prioritised work queue is [../ROADMAP.md](../ROADMAP.md), and each entry links to
its roadmap item. If you hit one of these, it is already known. Do not rediscover it, and do not
"fix" a behaviour listed under *By design*.

---

## 1. Matching

### L-01 · `exact_url` is byte-exact, and there is no prefix or wildcard match → **R-01**
A rule scoped **This Page Only** matches only that literal URL. `?query`, `#hash` and a trailing
slash all break it. Any site whose URL carries a document id plus mutable path segments
(Google Sheets, Notion, Jira, GitHub file views) therefore needs one rule per URL variant.
This is the top user-reported gap. **Workaround**: scope to **Entire Domain**, accepting that it
covers the whole site.

### L-02 · `regex` rules cannot be created in the UI → **R-02**
The engine fully supports `matchType: 'regex'` ([utils/matcher.ts:11](../utils/matcher.ts#L11)),
the rules list renders a purple `regex` badge for it, and it is unit-tested, but the editor's
scope control is typed `'domain' | 'exact_url'`
([FaviconEditor.tsx:38](../components/FaviconEditor.tsx#L38)), so nothing can produce one. Regex
rules can only enter storage by hand-editing an exported JSON file and re-importing it.

### L-03 · Editing a regex rule converted it to `exact_url` and duplicated it · *resolved 2026-09-02, R-03 done*
Loading a rule into the options editor coerces the scope
([FaviconEditor.tsx:94](../components/FaviconEditor.tsx#L94)); on save, `matchType` becomes
`exact_url` while `matcher` keeps the regex source, so it matches nothing. Because the
existing-rule lookup keys on `matcher` **and** `matchType`
([FaviconEditor.tsx:190](../components/FaviconEditor.tsx#L190)), it does not find the original,
generates a fresh `id`, and leaves the regex rule in place, the user now has two rules, one
broken. Data loss in practice. Blocks L-02 from being useful.

### L-04 · Within one tier the oldest rule won, not the most specific · *resolved 2026-09-02, R-04 done*
`findBestRule` uses `Array.find` at each tier
([utils/matcher.ts:7,11,27](../utils/matcher.ts#L27)) over `Object.values(rules)`, i.e. insertion
order. With domain rules for both `google.com` and `docs.google.com`, whichever was created first
wins on `docs.google.com`. Users read this as random. **Workaround**: delete the broader rule.

### L-05 · No `www` normalisation · *by design, but surprising*
`domain` matches downward only: a rule for `google.com` covers `www.google.com`, but a rule for
`www.google.com` does not cover `google.com`. Document it rather than "fix" it, silent host
rewriting would be worse.

---

## 2. Rules and settings UX

### L-06 · The global fallback favicon applies to every unmatched page → **R-25**
The settings copy says "if a site has no favicon"; the implementation applies
`defaultFaviconUrl` to **every** page with no matching rule
([content.ts:216](../content.ts#L216)), regardless of whether that page has its own icon. Users
set it once and believe the extension has gone rogue across the whole web.

### L-07 · The fallback URL field wrote storage and messaged every tab per keystroke · *resolved 2026-09-02, R-05 done*
[GlobalSettings.tsx:69](../components/options/GlobalSettings.tsx#L69) calls `onSettingsChange` on
every `onChange`, which reaches `saveSettings` → `persistData` + `notifyTabs()`. A 40-character
URL is 40 storage writes and 40 full-tab-broadcasts, each of which may inject a content script.
There is also an `onBlur` handler doing the same job correctly, so the `onChange` write is
redundant as well as expensive.

### L-08 · "Switch to Overriding Rule" did almost nothing · *resolved 2026-09-02, R-11 done*
The button is live and user-visible
([FaviconEditor.tsx:398](../components/FaviconEditor.tsx#L398)) but its handler only sets the
scope and `manualUrl`, and `manualUrl` is unused in popup mode. Its own body carries the
half-finished reasoning as comments. Clicking it appears to do nothing.

### L-09 · Badge/Overlay silently no-opped on a site with no favicon · *resolved 2026-09-02, R-06 done*
The preview effect returns early when `sourceIconUrl` is empty, so `previewUrl` stays null and
`handleApply` returns without feedback ([BadgeSection.tsx:103](../components/editor/BadgeSection.tsx#L103)).
**Workaround**: set an emoji or uploaded icon first, then badge it.

### L-10 · `createdAt` was overwritten on every save · *resolved 2026-09-02, R-26 done*
`handleSave` always sets `createdAt: Date.now()`, so the rules list's "Created" column is really
"last modified". Harmless today, but it destroys the only ordering signal, which L-04's fix may
want to use.

### L-11 · The rules list does not scale → **R-32**, **R-33**
No search, sort, filter, bulk delete, or per-rule enable/disable. Past roughly 30 rules the list
is unmanageable, and testing a rule requires deleting it.

### L-12 · No storage-usage visibility → **R-27**
Icons are stored inline (ADR-004) against a finite quota. The user finds out at the moment a save
fails. The error message is good ("Storage full. Try deleting unused rules"), but arrives too late.

---

## 3. Type safety and tooling

### L-29 · React had no type definitions installed · *resolved 2026-09-02, R-00 done*
**Fixed.** Kept here because it explains why the codebase looked clean while carrying L-30, and
because `allowJs: true` will silently do this again if the types are ever dropped from
`package.json`.

`@types/react` and `@types/react-dom` are **not in `package.json` and not in
`package-lock.json`**, and React 19 ships no bundled types. Because `tsconfig.json` sets
`allowJs: true`, TypeScript resolves `react` to `node_modules/react/index.js` and infers types
from JavaScript, so every component, prop, hook and JSX expression in the project is effectively
unchecked.

- `npx tsc --noEmit` today: **1 error**, namely
  `ErrorBoundary.tsx(52,21): Property 'props' does not exist on type 'ErrorBoundary'`, which is
  simply what a class component looks like with no React types.
- Measured with the types installed: **11 errors**, all of them the same real bug (L-30).

The build does not catch this because Vite transpiles without type-checking and `npm run build`
never calls `tsc`.

### L-30 · `Button` had no `size` prop while 11 call sites passed one · *resolved 2026-09-02, R-00 done*
[components/Button.tsx](../components/Button.tsx) defines only `variant` and `isLoading`; its
`baseStyle` hardcodes `px-4 py-2 … text-sm`. Eleven call sites pass `size="sm"`
(FaviconEditor ×2, UploadSection ×2, DebugLogs ×4, GlobalSettings ×3), all of which:

1. render at **full size** rather than the intended small size, a live, user-visible layout
   defect in the popup and the settings page, and
2. leak `size="sm"` onto the DOM `<button>` via the `{...props}` spread, where `size` is not a
   valid attribute for that element.

Invisible without React types, which is exactly why L-29 matters.

---

## 4. Runtime and robustness

### L-13 · The content script could be initialised twice · *resolved 2026-09-02, R-08 done*
`content.js` is both declared in the manifest and injected on demand by
`ensureContentScriptReady` (ADR-008). The `PING` guard usually prevents a double-inject, but a
still-loading tab that has not yet registered its listener will fail the ping and receive a second
copy in the same context, two MutationObservers, two intervals, two message listeners. There is
no `window.__fcu_loaded` latch.

### L-14 · `notifyTabs` fans out to every tab → **R-09**
[storage.ts:184](../utils/storage.ts#L184) queries all tabs and pings each one, injecting where
silent. With 100 tabs open, one rule save touches 100 tabs, including discarded ones, which it
may wake. It does not check whether a tab could even be affected by the change.

### L-15 · OS detection was implemented twice, two different ways · *resolved 2026-09-02, R-10 done*
`chrome.runtime.getPlatformInfo()` in [background.ts:20](../background.ts#L20) versus a
`navigator.userAgent` regex in [FaviconEditor.tsx:18](../components/FaviconEditor.tsx#L18). They
can disagree (the UA test also catches Android, then explicitly excludes it), and a disagreement
means the button says "Browse" while the bubble is disabled, or vice versa.

### L-16 · Log writes race and are expensive when enabled → **R-20**
Each log line does a read-modify-write of the whole `debug_logs` array
([logger.ts:86](../utils/logger.ts#L86)). Concurrent writes from the content script and the popup
lose entries, and a chatty page does a storage round trip per line. Only active with verbose
logging on, which is exactly when the log needs to be trustworthy.

### L-17 · A page can still fight for the icon
The debounce plus self-stopping poller (ADR-003) bound the cost, but a page that reasserts its
favicon aggressively will still trade writes with us. **Mitigation available to users**: add the
domain to Excluded Sites.

### L-18 · Restoring an icon we never captured leaves the tab blank
If no un-marked icon link existed when `captureOriginalFavicon` ran (SPA that adds its icon
late), deleting a rule removes our link and restores nothing
([content.ts:176](../content.ts#L176)). The tab falls back to whatever Chrome can find, often
nothing, until reload.

### L-19 · `RESET_ICON` had a handler and no sender · *resolved 2026-09-02, removed*
[content.ts:258](../content.ts#L258) implements a page-reloading reset that nothing in the
codebase ever sends. Dead protocol surface.

---

## 5. Verified dead code · *removed 2026-09-02, R-18 done*

The inventory that used to sit here (`generateFavicon`, `GenerateFaviconOptions`, `Shape`,
`EXTENSION_WIDTH`/`HEIGHT`, `DEFAULT_EMOJIS`, the unused `TabInfo` import, the duplicate
`TabInfo` interface, and the `RESET_ICON` handler) has been deleted. Each was confirmed
unreferenced across every `.ts`, `.tsx`, `.html` and config file in the repo first.

Two things in that list were deliberately **not** deleted, and should not be:

- `isValidBadgeText()` in [../utils/validation.ts](../utils/validation.ts) is still unused. It
  should be **wired up** by R-07 (import validation), because the 3 character badge rule is
  currently enforced only by `maxLength` on the editor input and not at all on imported data.
- `switchToConflictRule` was never dead. It was L-08, now fixed.

The general lesson: `switchToConflictRule` looked exactly as unused as the rest from a
call-graph glance, but was wired to a visible button. Confirm against the JSX, not just imports.

## 6. Platform and reach

### L-20 · Chrome/Chromium only → **R-23**
Raw `chrome.*` globals with `declare const chrome: any`, MV3 service worker, `chrome.action`.
Edge is likely to work as-is; Firefox needs the `browser` namespace, an `event_page`/background
script shim and a manifest variant.

### L-21 · English only → **R-22**
No `_locales`, every string inline in TSX. 983 users with no localisation ceiling lifted.

### L-22 · No cross-device sync → **R-24**, *and partly by design*
`chrome.storage.local` is per-profile per-device. `storage.sync` cannot be swapped in: its ~8 KB
per-item limit cannot hold a PNG data URL (ADR-004). Real sync needs a different icon-storage
design, not a one-line change. Export/import JSON is the current answer.

### L-23 · Type safety was opted out at the Chrome boundary · *resolved 2026-09-02, R-19 done*
Separate from L-29, and narrower.
`declare const chrome: any` appears in [content.ts:3](../content.ts#L3) and
[utils/storage.ts:5](../utils/storage.ts#L5) even though `@types/chrome` is installed and listed
in `tsconfig.json`. Every Chrome API call in those files is unchecked.

### L-24 · Checks are local only, not enforced remotely · *resolved for this repo, R-13 done*
Fixed as of 2026-09-02: `.githooks/pre-push` runs typecheck, tests and build before every push
(ADR-012). Deliberately **not** a GitHub Actions workflow, so the remaining gap is that the gate
only exists on machines where `npm install` has run, and `git push --no-verify` bypasses it. An
outside contributor's PR would not be checked automatically.

---

## 7. Assets and packaging

### L-25 · `icons/128.png` is 127×128, not 128×128 → **R-12**
Off by one pixel in width. Chrome scales it, and the store may warn.

### L-26 · Store promo tiles do not match Chrome Web Store dimensions → **R-12**
`store-assets/Small Promo Tile.png` is 1200×896 and `Marquee Promo Tile.png` is 1632×656. The
store's documented sizes are 440×280 for the small tile and 1400×560 for the marquee.
*[Unverified: confirm current requirements in the Developer Dashboard before re-exporting.]*

### L-27 · The shipped logo is 231 KB for a 32px render → **R-28**
`icons/FaviconChangerLogo.png` is 497×502 and 231 KB, 40% of the entire packaged extension, and
is only ever drawn at `w-8 h-8` (popup header) or `w-10 h-10` (options header).

### L-28 · Build config carried a removed feature's scar · *resolved 2026-09-02, R-29 done*
`vite.config.ts` still calls `loadEnv` into an unused `env` and keeps an empty `define: {}` with a
comment about removed Gemini API keys.
