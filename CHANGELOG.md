# Changelog

All notable changes to Favicon Changer Ultimate. Reconstructed from git history; entries before
v1.3.0 are grouped by the release they shipped in.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The shipped version
number is `public/manifest.json`; `package.json` is kept equal to it.

---

## [Unreleased]

### Fixed
- **React type definitions were never installed** (`@types/react`, `@types/react-dom`). React 19
  ships none, and `allowJs: true` let TypeScript infer React from its JavaScript, so every
  component, prop and hook was unchecked. Installing them surfaced one real defect:
- **`Button` had no `size` prop** while 11 call sites passed `size="sm"`. Those buttons rendered
  full size, and `size` leaked onto the DOM `<button>` through the props spread. `Button` now
  takes `size?: 'sm' | 'md'` and keeps it out of the DOM.
- Em dashes removed from the three user-facing strings that contained them.

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
