# Limitations

Known defects, edge cases and technical debt, as of v1.3.0 (2026-09-02). This file is the
reference; the prioritised work queue is [../ROADMAP.md](../ROADMAP.md), and each entry links to
its roadmap item. If you hit one of these, it is already known. Do not rediscover it, and do not
"fix" a behaviour listed under *By design*.

---

## 1. Matching

### L-01 · No prefix or wildcard match · *resolved 2026-09-02, R-01 done*
**Fixed** by the `prefix` match type ("URL Starts With"), which covers one document across all
its views. `exact_url` is still byte-exact by design, including `?query` and `#hash`; that is
what prefix exists to sit beside. Note wildcards (`*`) were **not** added: prefix covers the
leading-wildcard case and regex covers the rest. See [DECISIONS.md](DECISIONS.md) ADR-013.

### L-02 · `regex` rules could not be created in the UI · *resolved 2026-09-02, R-02 done*
**Fixed.** The editor's scope control now covers all four match types, with a pattern field,
live validation, a prefilled suggestion, and a count of how many open tabs the pattern matches.
The engine had supported regex from the start; only the UI was missing, so a user asked for a
feature that was already 90% built.

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

### L-06 · The global fallback favicon applies to every unmatched page · *copy corrected 2026-09-02, R-25 done*
The behaviour is unchanged and is not a bug: `defaultFaviconUrl` applies to **every** page with
no matching rule, whether or not it has an icon of its own. What was wrong was the copy, which
promised "if a site has no favicon". Telling those two cases apart needs a network request per
page (a site can serve `/favicon.ico` with no `<link>` tag at all), which the privacy position
rules out, so the setting now says what it does and warns while it is active.

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

### L-11 · The rules list did not scale · *resolved, R-33 on 2026-09-02 and R-32 on 2026-09-06*
**Fixed** in two parts. Per-rule pause (R-33) means a rule can be switched off without losing its
icon, so ruling one out as the cause of something no longer means deleting it. Search, per-type
filter chips with counts, three sort orders and multi-select bulk delete (R-32) mean the list
stays usable well past the couple of dozen rules where it used to become unmanageable.

### L-12 · No storage-usage visibility · *resolved 2026-09-02, R-27 done*
**Fixed.** The settings page shows a meter of bytes used against the quota, with a warning band
from 75% that points at image-upload rules as the biggest consumers. The "Storage full" error on
save is still the backstop, but it is no longer the first warning.

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

*The favicon write path (ADR-001), historically the most fragile thing here, is now covered by
`utils/faviconDom.test.ts` under jsdom. It asserts element identity, so a remove-and-append
rewrite fails the suite rather than shipping.*

### L-31 · An undecodable icon showed a broken-image glyph, not the fallback · *resolved 2026-09-02*
A `data:` URL that is well-formed but not a decodable image (which an imported rule can carry,
since decodability cannot be checked at import time) leaves a 0x0 image and fires **load**, not
error. Worse, a data URL can finish loading before React attaches the handlers, so neither fired.
`FaviconPreview` now also checks the element directly for `complete && naturalWidth === 0`.
Found while verifying R-33 against deliberately broken test data.

### L-32 · The dev server was exposed on every network interface · *resolved 2026-09-02*
`vite.config.ts` set `host: '0.0.0.0'`, so `npm run dev` listened on the LAN and on any VPN or
tailnet interface. Vite's dev server has a recurring class of path-traversal and
arbitrary-file-read advisories (four were open against the pinned version, since updated), which
made that bind a file-read surface on the developer's machine. Now localhost-only, with
`npm run dev -- --host` as the explicit opt-in. See [SECURITY.md](SECURITY.md) threat 6.


### L-13 · The content script could be initialised twice · *resolved 2026-09-02, R-08 done*
`content.js` is both declared in the manifest and injected on demand by
`ensureContentScriptReady` (ADR-008). The `PING` guard usually prevents a double-inject, but a
still-loading tab that has not yet registered its listener will fail the ping and receive a second
copy in the same context, two MutationObservers, two intervals, two message listeners. There is
no `window.__fcu_loaded` latch.

### L-14 · `notifyTabs` fanned out to every tab · *resolved 2026-09-02, R-09 done*
**Fixed.** `sendMessageToTab` takes an `inject` flag, and `notifyTabs` sets it only for the active
tab of each window. Discarded tabs are skipped entirely; every other tab is pinged without
injection and reads the new rules on its next load. Filtering by "could this rule affect this
URL" was rejected: doing it correctly needs a diff of the old and new rule sets, because a
deleted rule affects the tabs it used to match, and the injection cost was the real problem.

### L-15 · OS detection was implemented twice, two different ways · *resolved 2026-09-02, R-10 done*
`chrome.runtime.getPlatformInfo()` in [background.ts:20](../background.ts#L20) versus a
`navigator.userAgent` regex in [FaviconEditor.tsx:18](../components/FaviconEditor.tsx#L18). They
can disagree (the UA test also catches Android, then explicitly excludes it), and a disagreement
means the button says "Browse" while the bubble is disabled, or vice versa.

### L-16 · Log writes raced and were expensive when enabled · *resolved 2026-09-02, R-20 done*
**Fixed.** Entries are buffered in memory and written as one batch every 250 ms, with flushes
chained so two can never interleave their read-modify-write. `pagehide` forces a flush, because
the popup is destroyed on blur and would otherwise take the buffer with it. `getLogs()` returns
buffered entries too, so the viewer never looks stale, and the ring buffer now trims with
`splice` rather than a single `shift` that could not keep up with a batch.

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
MV3 service worker, `chrome.action`, and `chrome.*` globals throughout.

**Corrected 2026-09-07 by testing rather than reasoning.** Edge is Chromium and takes the same
package; the work there is a Partner Center submission. Firefox 154 was installed from the built
`dist/` over WebDriver BiDi and driven end to end: **every `chrome.*` API this extension uses
exists there**, so the `browser` namespace shim this entry used to claim is not needed. What is
needed is two manifest lines (`background.scripts` instead of `background.service_worker`, and a
`browser_specific_settings.gecko.id`). See ROADMAP R-23 for what was measured and what is still
untested, and [PUBLISHING.md](PUBLISHING.md) for the submissions themselves.

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

### L-33 · A page that reasserts its favicon for ever will alternate with us · *open, by design*
The MutationObserver re-applies our icon within the 100 ms debounce of any page write it did not
make (ADR-014), so an ordinary SPA that reasserts its icon on an event loses within about 150 ms
and our icon then holds. A page that reasserts unconditionally on a short timer is a different
case: both sides keep writing, and the tab icon visibly alternates. Measured against a synthetic
page rewriting every 300 ms, the split was roughly even, with the busiest renderer at 12% of one
core, so the cost is bounded rather than a pinned core.

No DOM-level approach can win this outright, since the page runs in the same document and can
always write last. The options are to accept the alternation, to back off after N re-applies in a
window (our icon then loses, but quietly), or to shorten the debounce (we win more often and write
more). Accepting it is the current position, because no real site behaves this way; the synthetic
case exists to bound the cost, not because it was observed in the wild.

### L-34 · Background tabs keep their old icon across an extension update · *open, inherent*
Reloading the extension kills the content script in every open tab. `notifyTabs` only injects into
the active tab (R-09), so a background tab has nothing listening and keeps whatever icon it had
until it is reloaded or navigated. This is the documented cost of not injecting into every tab on
every rule change, and it surfaced while testing: after a `chrome.runtime.reload()`, the active
tab picked up a new rule and background tabs did not. Users see it only after an update from the
store, and only until they touch the tab.

### L-35 · The URL parser accepted a hostname the browser had escaped · *resolved 2026-09-07, R-49 done*
`hostnameFromInput()` treated `new URL()` not throwing as proof that the input was a hostname.
Chrome percent-encodes characters that are illegal in a host rather than throwing, so
"not a url at all" became the matcher `not%20a%20url%20at%20all` and sat in the rules list
matching nothing. Node throws on the same input, so the unit tests could not see it. Now the shape
of the parsed hostname is checked (`looksLikeHostname`), and the same audit found the mirror-image
problem: `scheme:` was accepted as a scheme, so `localhost:3000/app` produced the prefix
suggestion `localhost:///3000`.

