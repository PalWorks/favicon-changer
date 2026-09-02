# Decision Records

Why the code is shaped the way it is. Each record states the decision, the forcing constraint,
and what breaks if it is reversed. These are the things most likely to be "cleaned up" into a
regression by someone who does not know the history, including a future agent.

Records are reconstructed from the commit history and the in-code rationale comments; dates are
the commit dates where known.

---

## ADR-001: Mutate the tracked `<link href>` in place; never remove-and-append
**Status**: Accepted · 2026-06-09 (`d16434f`) · **Load-bearing**

**Decision.** `updateFavicon()` reuses the `<link rel*=icon>` element Chrome is already tracking
and only changes its `href` attribute. New elements are created only when the page has no icon
link at all.

**Why.** Verified empirically: Chrome repaints a **background** tab's icon only when the `href`
of an element it already tracks is mutated. Inserting a fresh `<link>` is ignored until the tab
is reloaded or activated. Remove-then-append is a fresh insert as far as Chrome is concerned.

**If reversed.** Rules stop applying to background tabs, the most common way the extension is
actually used (many tabs open, icons as visual labels). It will look like it works, because the
foreground tab still updates.

**Also.** The write is skipped when the `href` is already correct, which suppresses a visible
icon flash on redundant re-applies.

---

## ADR-002: Do nothing on pages we have not modified
**Status**: Accepted · 2026-06-06 (`7845f0e`)

**Decision.** A `hasModified` flag gates the no-rule branch. If no rule matches and we never
changed this page, the content script performs no DOM access and no restore.

**Why.** The earlier code unconditionally reconciled `<head>` on every page. That `<head>` churn
broke SPAs that observe their own head; GA4's header component was the reported case.

**If reversed.** Sporadic, hard-to-reproduce breakage on third-party sites where the extension
was supposed to be inert, and the bug report will not mention favicons.

---

## ADR-003: Debounced MutationObserver plus a self-terminating poller
**Status**: Accepted · 2026-06-06 (`1b43ec5`)

**Decision.** Defend the icon with two mechanisms: an observer on `<head>` debounced at 100 ms,
and a 2 s poller that stops itself after 5 clean checks and is re-armed by the observer.

**Why.** Neither alone is sufficient. The observer alone produced a "favicon war", the page
rewrote the icon, we rewrote it back synchronously, the page reacted, unbounded. The poller
alone either lags visibly or never sleeps. Debouncing collapses hydration bursts; self-stopping
keeps a quiet page from waking the event loop forever.

**If reversed.** Either a mutation loop that pins a CPU core, or icons that silently revert on
SPA navigation.

**Tuning knobs.** `OBSERVER_DEBOUNCE_MS` and `MAX_STABLE_CHECKS` in
[constants.ts](../constants.ts). Do not inline them.

---

## ADR-004: Store the icon inline as a `data:` URL, not a remote reference
**Status**: Accepted · from the start

**Decision.** Every locally-produced icon (emoji, upload, badge, overlay) is rendered to a canvas
and stored as a PNG `data:` URL inside the rule.

**Why.** It makes the extension work offline, keeps the privacy claim honest (no network request
per page load), and removes any dependency on a host that could disappear or track requests.

**Cost.** `chrome.storage.local` has a quota and no `unlimitedStorage` permission is requested,
so icons must be kept small, hence the 128px cap and `compressFaviconDataUrl()`. It also rules
out `chrome.storage.sync`, whose ~8KB per-item limit cannot hold a PNG data URL. Cross-device
sync therefore needs a different design, not a storage-area swap.

**Exception.** The "paste image URL" source stores the URL verbatim by explicit user choice, and
import counts such rules so the user is told.

---

## ADR-005: Key rules by generated id, with a one-shot migration
**Status**: Accepted · 2026-01-26 (`e33cb54`)

**Decision.** `rules` is `Record<id, FaviconRule>`. Rules were originally keyed by domain.
`getStorageData()` detects the old shape (an entry lacking `id`/`matcher`), rewrites it, and sets
a `migrated: true` latch so the scan never runs again.

**Why.** Domain keys allow exactly one rule per site, which makes `exact_url` and `regex` rules
impossible to represent.

**If reversed.** Multi-rule-per-site breaks. Removing the latch instead makes every single read
re-scan every rule.

**Note.** Old rules migrate to `matchType: 'domain'`, the closest equivalent of the old
behaviour.

---

## ADR-006: Two Vite builds, content script as IIFE
**Status**: Accepted · 2026-01-25 (`e3dc761`)

**Decision.** `npm run build` runs `vite build` then `vite build -c vite.content.config.ts`, the
second with `format: 'iife'` and `emptyOutDir: false`.

**Why.** Chrome injects content scripts as classic scripts; an ESM bundle with `import`
statements throws at runtime. IIFE inlines the shared modules into one self-contained file.

**If reversed.** `content.js` fails to load with a bare `import` error, and the failure is
invisible unless you open the console of a content page, the popup keeps working, so it looks
like a matching bug.

---

## ADR-007: Hand the upload off to a real window on Linux/CrOS/BSD
**Status**: Accepted · 2026-06-09 (`d16434f`)

**Decision.** On platforms where Chrome closes the toolbar popup when a native file dialog opens,
`background.ts` disables `default_popup` so `action.onClicked` fires and opens
`index.html?expanded=1` as a 460×720 popup window. The popup's "Browse" button hands off the same
way via `pendingEditorTarget`.

**Why.** The action popup is destroyed on blur. A file dialog blurs it. The upload aborted with
no error message, the worst class of bug, because it reads as "the extension is broken".

**Why OS-gated.** Windows and macOS keep the bubble alive through a file dialog, and the bubble
is a nicer interaction, so they keep it. The list is
`POPUP_CLOSES_ON_DIALOG = {linux, cros, openbsd}` in [background.ts](../background.ts).

**Note.** Detection is duplicated: `chrome.runtime.getPlatformInfo()` in the service worker,
user-agent sniffing in [FaviconEditor.tsx](../components/FaviconEditor.tsx) (the platform API is
async and unavailable in that render path). The two can disagree; consolidating them is a roadmap
item. Drag-and-drop never needs the hand-off because no OS dialog opens.

---

## ADR-008: `PING`, then inject, rather than trusting the manifest declaration
**Status**: Accepted · 2026-06-06 (`a512606`)

**Decision.** Before messaging a tab, `ensureContentScriptReady()` pings it and injects
`content.js` with `chrome.scripting.executeScript` if there is no reply, up to 3 attempts with a
200 ms settle.

**Why.** The manifest declaration does not cover tabs that were already open when the extension
was installed or updated, and the script may not be listening yet on a still-loading tab. This is
why `scripting` is in `permissions`.

**Cost.** Both an injection path and a declared path exist, so a re-injection into a context that
*does* already have the script would double-register the observer and listeners. Guarding
`content.ts` with a `window.__fcu_loaded` latch is a roadmap item.

---

## ADR-009: Errors always log; everything else is opt-in
**Status**: Accepted · 2026-06-06

**Decision.** [utils/logger.ts](../utils/logger.ts) writes `ERROR` to the console always, and
`INFO`/`DEBUG`/`WARN` only when the user enables verbose logging in the options page. Enabled
logs are also persisted to a 1000-line ring buffer in `chrome.storage.local` for copy/download.

**Why.** The content script logs on hot paths on every page; a chatty extension pollutes every
site's console and gets blamed for other people's bugs. Persistence exists because the popup dies
on blur, so console output is often gone before it can be read, the log buffer is the only way
to debug a user's popup problem remotely.

**Implementation note.** The enabled flag is cached in memory per context and kept fresh via
`chrome.storage.onChanged`, so a log call on a hot path does not hit storage. Do not replace the
cache with a direct read.

---

## ADR-010: One editor component for popup, window and options page
**Status**: Accepted · 2026-01-25 (`c44af43`)

**Decision.** [FaviconEditor.tsx](../components/FaviconEditor.tsx) serves all three surfaces via
`mode: 'popup' | 'options'` and `context: 'action' | 'expanded'`.

**Why.** The three surfaces differ only in where the target comes from (active tab vs. hand-off
payload vs. typed URL) and whether a header is shown. Three copies of the save/validate/conflict
logic would drift.

**Cost.** The component is ~520 lines with several `if (mode === …)` branches and mode-dependent
effects; the mode matrix is the main source of subtle UI bugs (for example `refreshData()` must
not re-query the active tab in the expanded window, or it blanks the target after a save).
Extracting the shared logic into a hook is a roadmap item.

---

## ADR-011: Disclose the options-page Google favicon lookup rather than remove it
**Status**: Accepted · 2026-09-02

**Decision.** The rule editor on the options page previews a typed domain's icon via
`https://www.google.com/s2/favicons?domain=<domain>`. Keep the call; document it explicitly in
[../PRIVACY_POLICY.md](../PRIVACY_POLICY.md) under a dedicated "Network Requests" section that
names what is sent, when, to whom, and how to avoid it.

**Why.** The options page has no active tab to read an icon from, so without a lookup service the
editor cannot show the user which site they are configuring. Disclosure keeps the privacy
statement accurate at the cost of a weaker "no third parties whatsoever" claim.

**Consequence.** The extension is no longer strictly zero-third-party, and the store listing
copy must not claim otherwise. The self-hosted alternative (fetching `https://<domain>/favicon.ico`
directly) leaks the domain to that site instead and fails on many sites; it remains a roadmap
option if the claim is later judged more valuable than the preview.

---

## ADR-012: A local pre-push hook instead of a CI workflow
**Status**: Accepted · 2026-09-02

**Decision.** The type check, unit tests and production build run from
[.githooks/pre-push](../.githooks/pre-push), gating `git push` on the developer's machine. There
is no GitHub Actions workflow, and adding one needs a deliberate decision.

**Why.** Keeping GitHub Actions usage to a minimum is a project constraint. A solo repo with a
9 second check suite does not need a hosted runner to get the same protection: the hook blocks
the push before anything reaches the remote, which is earlier than CI would catch it anyway.

**How it installs.** `package.json`'s `prepare` script runs
`git config core.hooksPath .githooks` on `npm install`, so a fresh clone is gated after one
install. `.git/hooks` is not versioned, which is why the hook lives in a tracked directory.

**Bypass.** `git push --no-verify`. Deliberate and visible, which is the point.

**Trade-off.** A hook only protects the machine it is installed on, and it cannot gate a pull
request opened from elsewhere or a push made with `--no-verify`. If this repo ever takes outside
contributions, that gap is real and a minimal workflow (single job, PRs to `main` only) becomes
worth its cost. Note that GitHub Actions is free on standard runners for public repositories, so
the cost in question is complexity and noise rather than money.

**If reversed** (a workflow is added): keep the hook. The two are complementary, and the hook is
the one that gives feedback in 9 seconds rather than 90.
