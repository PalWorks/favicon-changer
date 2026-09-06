# Changelog

All notable changes to Favicon Changer Ultimate. Reconstructed from git history; entries before
v1.3.0 are grouped by the release they shipped in.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The shipped version
number is `public/manifest.json`; `package.json` is kept equal to it.

---

## [Unreleased]

---

## [1.4.2]: 2026-09-06

### Added
- **A one-time review prompt.** After the extension has actually changed a favicon for you on
  four separate days, a small strip asks once whether you would rate it. "No thanks" is
  permanent, there is no second ask, and there is no question in front of the link deciding who
  gets sent to the store. The counter behind it is a number on your device, described in the
  privacy policy; nothing is sent anywhere.

### Changed
- The content script's favicon observer moved into its own module so its behaviour is covered by
  tests. No change to what it does.

---

## [1.4.1]: 2026-09-06

Three bugs found by driving the loaded extension in a real browser for the first time, rather
than reasoning about it. One of them broke the core promise, changing a favicon without a
reload, on a large share of the web.

### Added
- **The rules list is searchable, filterable and sortable**, with filter chips per match type
  showing how many rules each has, and sorting by newest, oldest or alphabetically. The heading
  reads "4 of 14" while a filter is active, so a narrowed list cannot be mistaken for all of them.
- **Emoji icons render at 128px**, matching every other icon source. They were 64px, which was
  visibly softer on a high-DPI display and left no headroom for taller glyphs.
- **Accessibility**: every control on the settings page now has an accessible name, save results
  and errors are announced to screen readers rather than only drawn, and the pause switches
  expose their on/off state. Audited programmatically with all sections expanded: 30 of 30
  controls named, none unreachable by keyboard.
- **Bulk delete.** Tick several rules, or "select all shown", and remove them in one action. It is
  a single storage write and a single notification to open tabs, rather than one of each per rule.

### Fixed
- **Setting a favicon did nothing until the page was reloaded, on any site that lists an
  `apple-touch-icon` before its favicon.** That is a large share of the web; Wikipedia is one.
  The extension was changing the wrong icon link and deleting the one the browser actually paints
  the tab from, so the tab kept its old icon until it was reloaded. It now changes the right one,
  and leaves home-screen and pinned-tab icons alone instead of deleting them.
- **Your icon lost to sites that set their own favicon repeatedly**, the unread-count kind. The
  extension mistook the site's changes for its own and only corrected them every two seconds, so
  the icon flickered between the two. It now restores your icon within a fraction of a second.
- **Deleting a rule could restore the wrong icon**, the home-screen one instead of the site's
  real favicon, on those same sites.
- **"URL Starts With" and "Regex" now fill in a suggested pattern as you type the address.**
  Choosing the match type before typing the address, which is the natural order on the settings
  page, used to leave the pattern box empty, and after saving one rule it kept the previous
  rule's text. Your own edits are never overwritten.

### Changed
- The 128px icon is now sized the way Chrome asks, with padding, so it sits consistently beside
  other extensions in the store and on the extensions page.
- A security contact is published: **support@palworks.ai**, with what to include and a
  three-working-day acknowledgement.
- Dependency updates are raised weekly and grouped by Dependabot. It is a configuration file
  rather than a workflow, so it runs on GitHub's own infrastructure and adds no CI.


---

## [1.4.0]: 2026-09-06

Flexible URL matching, the feature a Chrome Web Store review asked for, plus the correctness and
hardening work that came with it.

### Added
- **"URL Starts With" matching.** A rule can now cover every address beginning with a given
  prefix, which is how you keep one favicon on one document (a Google Sheet, a Notion page, a
  Jira ticket) as the tail of its URL changes between views. Requested in a Chrome Web Store
  review. It ranks above regex, so a document-scoped rule cannot lose to a site-wide pattern.
- **Regex matching in the editor.** The engine had always supported it and it was unit tested,
  but there was no way to create one without hand-editing an exported JSON file. It is now the
  fourth scope option, with live validation.
- **Pattern help for both.** Prefix and regex rules are prefilled from the page you are on, with
  the query string, fragment and trailing path segment dropped, so the common case is one click.
  The regex suggestion is escaped and anchored, which is the part people get wrong by hand. The
  editor also shows how many of your open tabs the pattern currently matches, and which, so a
  pattern can be checked before it is saved rather than after.
- The rules list labels and colours all four match types.
- **Pause a rule instead of deleting it.** A switch on each rule in the settings list turns it off
  without losing its icon or settings, so ruling a rule out as the cause of something no longer
  means recreating it afterwards. Paused rules never match and never trigger a conflict warning.
- **A storage meter** in settings, showing bytes used against the browser quota with a warning
  band, since every icon is stored on your device and the only previous signal was a save failing.

### Security
- **The dev server no longer listens on every network interface.** `vite.config.ts` bound it to
  `0.0.0.0`, so `npm run dev` was reachable from the local network and any VPN interface, while
  Vite's dev server had four open path-traversal and arbitrary-file-read advisories. It is now
  localhost-only; `npm run dev -- --host` is the explicit opt-in. Affects contributors, not users.
- **Six high-severity advisories closed** by moving Vite from 6.4.1 to 6.4.3, inside the existing
  version range. Production dependencies were and are clean.
- `npm audit` now runs in the pre-push hook, blocking on production-scope findings and reporting
  dev-only ones without blocking.
- **Rules import is validated properly.** Every rule in an imported file is rebuilt field by
  field rather than trusted: the match type must be one we know, a regex must compile, and the
  icon must be an inline image or an http(s) address, which rejects `javascript:`,
  `data:text/html` and `file:` URLs. Icons are capped at 256KB, files at 500 rules, badge text at
  the 3 characters the editor has always implied, and unknown fields are dropped instead of
  stored. Rules that fail are now listed with the reason rather than disappearing silently.

### Fixed
- **Rule matching now picks the most specific rule, not the oldest.** Every matching rule is
  scored (tier rank, then matcher length as the tie-break) instead of each precedence tier being
  scanned first-match-wins. A domain rule for `docs.google.com` now beats one for `google.com`
  on a docs URL whichever was created first. Tier rank still dominates length, so a long regex
  cannot outrank an exact URL.
- **Editing a regex rule no longer destroys it.** The options editor coerced a loaded rule's
  match type into one of its two scope buttons, so saving a regex rule rewrote it as an exact URL
  match holding the regex source as a literal URL, and the existing-rule lookup then failed to
  recognise it and saved a duplicate under a new id. One edit produced two bad rules. The real
  match type is preserved, and a loaded rule is now looked up by id.
- **`createdAt` is no longer overwritten on every save**, so the rules list's Created column
  means what it says. A new optional `updatedAt` records the last edit.
- **The default fallback favicon field no longer writes on every keystroke.** It committed to
  storage and broadcast to every open tab per character typed; it now commits on blur or Enter,
  and skips a no-op save.
- **The Badge and Overlay tool explains itself on a page with no favicon** instead of showing an
  endless loading placeholder and an Apply button that silently did nothing.
- **The fallback favicon setting now says what it does.** It was labelled as applying "if a site
  has no favicon" while actually applying to every site without a matching rule, which read as the
  extension going rogue across the whole web. The behaviour is unchanged and intended; the copy was
  wrong, and it now warns while a fallback is set. Distinguishing the two cases would need a
  network request per page, which this extension will not do.
- **An icon that cannot be decoded now falls back to the placeholder** instead of showing the
  browser's broken-image glyph. Such an icon fires a load event rather than an error, so nothing
  had caught it.
- **Debug logging no longer loses entries.** Each line was a separate read-modify-write of the
  whole log, so the content script and the popup overwrote each other, precisely when the log was
  being relied on. Entries are now batched, writes are serialised, and the buffer is flushed
  before the popup can be destroyed.
- **The rule conflict banner covers every case and its button does something.** It now reports
  any higher-precedence rule that would win, not just the two types it used to know about, names
  the rule that wins, and excludes the rule being edited from shadowing itself. It re-targets the editor at the
  overriding rule, or opens Settings when that rule is a regex the popup cannot edit.
- **The content script cannot initialise twice in one page.** It is both declared in the manifest
  and injected on demand, and a failed ping against a still-loading tab could deliver a second
  copy, leaving two observers, two polling intervals and two message listeners.
- One source of truth for the popup-closes-on-file-dialog OS check, which was previously decided
  twice by two different mechanisms that could disagree.
- **React type definitions were never installed** (`@types/react`, `@types/react-dom`). React 19
  ships none, and `allowJs: true` let TypeScript infer React from its JavaScript, so every
  component, prop and hook was unchecked. Installing them surfaced one real defect:
- **`Button` had no `size` prop** while 11 call sites passed `size="sm"`. Those buttons rendered
  full size, and `size` leaked onto the DOM `<button>` through the props spread. `Button` now
  takes `size?: 'sm' | 'md'` and keeps it out of the DOM.
- Em dashes removed from the three user-facing strings that contained them.

### Changed
- **The scope selector moved above the URL field and onto a single row of four**, with short
  button labels so it fits the popup. From review feedback.
- **The favicon write path is now covered by tests.** It was extracted from the content script
  into its own module so it could be tested under jsdom, and the tests assert on the identity of
  the mutated element: rewriting it the "obvious" way, replacing the element instead of mutating
  it, now fails the suite instead of silently breaking every background tab. That is the single
  most fragile behaviour in the extension.
- **Saving a rule no longer touches every open tab.** It pinged all of them and injected a content
  script into any that did not answer, so one save could reach a hundred tabs and wake discarded
  ones. Now discarded tabs are skipped, only the tab you are looking at is worth an injection, and
  the rest pick up the change on their next load.
- **The packaged extension is a third smaller**, 577 KB down to 381 KB. The 497px logo master
  was being shipped for a header drawn at 32 to 40 CSS pixels; a 160px version ships instead and
  the master moved to `store-assets/masters/`.
- `icons/128.png` is now a true 128x128. It was 127x128.
- Store promo tiles regenerated at the sizes Chrome actually requires, 440x280 and 1400x560, from
  the original design masters with the composition unchanged. Specs and method recorded in
  [store-assets/README.md](store-assets/README.md).

### Removed
- Dead code, each symbol verified unreferenced across the whole repo first: `generateFavicon` and
  its `GenerateFaviconOptions`/`Shape` types, `EXTENSION_WIDTH`/`EXTENSION_HEIGHT`,
  `DEFAULT_EMOJIS`, an unused `TabInfo` import, a duplicate `TabInfo` interface, and the
  `RESET_ICON` message handler that nothing had ever sent.
- `declare const chrome: any` from `content.ts` and `utils/storage.ts`, which shadowed the real
  `@types/chrome` definitions. Removing it produced zero errors, so it was pure debt.
- An unused `loadEnv` call and an empty `define` block in `vite.config.ts`, left over from
  removed Gemini API key plumbing.

### Added
- **Pre-push checks** in [.githooks/pre-push](.githooks/pre-push): type check, unit tests and the
  production build, installed automatically by `npm install`. Deliberately a git hook rather than
  a GitHub Actions workflow (ADR-012). New scripts: `npm run check`, `npm run typecheck`.
- Documentation set: `AGENTS.md`, `ROADMAP.md`, `CONTEXT_MAP.md`, `CHANGELOG.md`, and
  `docs/` (`ARCHITECTURE`, `DOMAIN`, `DECISIONS`, `PLAYBOOK`, `TESTING`, `RUNBOOK`, `SECURITY`,
  `LIMITATIONS`).
- Chrome Web Store promo tiles committed under `store-assets/`.

### Changed
- `package.json` version aligned to the manifest (`1.2.1` → `1.3.0`); the manifest was correct.
- **Privacy policy**: new "Network Requests" section enumerating all three cases in which the
  extension causes a network request, including explicit disclosure that the options-page rule
  editor previews a typed domain via Google's public favicon service
  (`google.com/s2/favicons`), what is sent, when, to whom, and how to avoid it. Recorded as
  ADR-011.

---

## [1.3.0]: 2026-06-09

Favicon engine fixes and Chrome Web Store readiness.

### Fixed
- **Background tabs now update without a reload.** `updateFavicon` mutates the `href` of the
  `<link>` element Chrome is already tracking instead of inserting a new one; Chrome only
  repaints an inactive tab's icon for a tracked element's `href` change. See ADR-001.
- Redundant re-applies no longer flash the tab icon, the write is skipped when the `href` is
  already correct.
- SVG favicons served under a `.png` name now decode. `normalizeImageDataUrl()` sniffs the decoded
  bytes of a `data:` URL and relabels it `image/svg+xml`; export now derives its file extension
  from the real content type. This fixed the "download github.com's icon, re-upload it, get a
  broken image" report.
- SVGs reporting zero intrinsic width/height no longer produce a blank icon (aspect-ratio
  fallback in the upload compositor).

### Added
- Standalone editor window on Linux/ChromeOS/OpenBSD, where Chrome destroys the toolbar popup
  when a native file dialog opens, which had been aborting uploads silently. The service worker
  disables the bubble on those platforms and opens a real window instead. See ADR-007.
- Drag-and-drop upload, which needs no OS dialog and so works in the bubble everywhere.
- Privacy policy note on remote favicon URLs; import now reports how many incoming rules use one.

### Changed
- Metadata is dropped from `public/icons` (XFCE `.comments` artefacts) for a clean package.

---

## [1.2.1]: 2026-06-06

### Added
- **Per-site exclusion list.** Domains on it are never touched, no favicon change and no DOM
  mutation of any kind.
- 20 unit tests for `utils/matcher.ts` covering every precedence tier, subdomain behaviour,
  invalid regex handling and conflict detection. The project's first tests.

### Fixed
- **Mutation war eliminated.** The `<head>` MutationObserver is debounced (100 ms) so SPA
  re-hydration bursts collapse into one re-apply, and the 2 s backup poller now stops itself
  after 5 clean checks instead of running forever. See ADR-003.
- **No more `<head>` churn on pages with no active rule**: a `hasModified` guard means untouched
  pages stay untouched. This fixed breakage of SPAs that observe their own head (GA4's header
  component). See ADR-002.
- Settings changes now notify open tabs, so an exclusion or fallback change applies immediately.
- Chrome API error handling hardened throughout: `chrome.runtime.lastError` is checked on storage
  and tab calls, restricted URLs are filtered before injection, and the message-passing contract
  is explicit (`PING` / `RulesUpdated`).
- Version corrected in the manifest.

---

## [1.2.0]: 2026-01-26

First Chrome Web Store submission.

### Added
- Automatic image compression and downscaling to 128px so stored icons fit the storage quota.
- Input validation: file type (PNG/JPEG/SVG/WebP), 5 MB size cap, URL and regex validation with a
  2000-character pattern cap as a partial ReDoS guard.
- Storage migration from the original domain-keyed rule format to id-keyed rules, latched so it
  runs once. See ADR-005.
- `ErrorBoundary` around both React roots.
- Opt-in persistent logger with an in-options viewer, copy and download, the only way to debug a
  popup that dies on blur. See ADR-009.
- `PRIVACY_POLICY.md` and README.

### Fixed
- Content-script injection errors on restricted URLs.
- Overlay compositing, editor reset logic when switching rules, and file-scheme permission
  prompts.

---

## [1.1.0]: 2026-01-25

### Added
- **Badge & Overlay tools**: text badges with configurable colours and position, and colour
  overlays with opacity, composited over the site's own favicon.
- Editor refactored into one shared component serving the popup and the options page. See ADR-010.
- `utils/logger.ts` and `utils/canvas.ts`.

---

## [1.0.0]: 2026-01-21

Initial release.

### Added
- Per-site favicon rules with `domain`, `exact_url` and `regex` match types.
- Emoji picker with a categorised, searchable library.
- Image upload and image-URL sources.
- Options page with rule list and global settings.
- Rules import/export as JSON.
- Two-pass Vite build: ESM for extension pages, IIFE for the content script. See ADR-006.
