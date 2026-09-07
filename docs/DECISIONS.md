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

**Locked in by tests since 2026-09-06.** The function was extracted to
[utils/faviconDom.ts](../utils/faviconDom.ts) (imported by the content script and nothing else)
so it could be unit tested under jsdom. The tests assert on the **identity** of the mutated
element rather than only its final `href`, because a replaced node produces a correct-looking
`href` and still fails in a real browser. Rewriting it as remove-and-append fails 8 cases,
verified by doing exactly that and watching them go red.

**Amended 2026-09-06 (R-45): *which* link is half the decision.** Mutating in place is necessary
and was not sufficient, because the code took the first element matching `link[rel*='icon']`. On
a page whose head lists `<link rel="apple-touch-icon">` before its favicon, and that is a large
share of the web, the first match is not the element Chrome paints the tab from. We mutated that
one and deleted the real one, so Chrome was left tracking a node that no longer existed and the
icon did not change until the page was reloaded. The link is now chosen as: one we already own,
else the first whose `rel` contains `icon` and is not `apple-touch-icon`,
`apple-touch-icon-precomposed`, `mask-icon` or `fluid-icon`, else the first icon-ish link, else a
new one. The sibling sweep removes only competing tab favicons and leaves the rest in place.
Reproduced live on en.wikipedia.org before the fix and after.

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

---

## ADR-013: Keep `prefix` as its own match type, even though regex subsumes it
**Status**: Accepted · 2026-09-02

**Decision.** Ship `prefix` as a first-class match type alongside `regex`, ranked **above** regex
in precedence, rather than telling users to express a prefix as `^escaped\\.pattern`.

**The objection, which is correct as far as it goes.** A prefix match is a strict subset of what
regex can express: `startsWith(p)` is exactly `^` plus `p` escaped. Building regex support
therefore covers the use case, and a fourth match type is more UI, more code paths and more
tests.

**Why it earns its place anyway.** Every reason is about the failure modes of asking a person to
write the regex by hand:

1. **A pasted URL is a broken regex.** `https://example.com/a?b=1` as a pattern reads as: any
   character where the dots are, and an optional `a` because of the `?`. It still matches the
   page the user was looking at, so it looks like it worked, while also matching things it should
   not. This is the failure that never gets reported, only lived with.
2. **Regex here is unanchored.** `docs.google.com` as a regex matches
   `https://evil.example/?x=docs.google.com`. A prefix is anchored by construction, so the
   dangerous version cannot be written by accident.
3. **Specificity ranking needs a meaningful length.** R-04 breaks ties inside a tier by matcher
   length. For prefixes that is exactly right: the longer prefix is the more specific rule. For
   regex, pattern length says little about how much it matches, so the tie-break is far weaker.
4. **No ReDoS surface.** `startsWith` cannot backtrack. A regex is user-authored and runs against
   every URL on every page load, with no execution timeout available in JavaScript.
5. **It is the honest default for the common case.** "URL starts with" plus a prefilled
   suggestion is one click. Getting the same result through regex is a small editing task that a
   non-technical user will not attempt and a technical user should not have to.

**Why it ranks above regex.** A prefix rule is scoped to one document by construction. If regex
outranked it, a broad site-wide regex would silently beat the document-specific rule the user
just created, which is precisely the "matching feels random" complaint R-04 set out to fix. A
user who wants their regex to win can make it more specific; a user whose prefix loses has no
recourse.

**Consequence.** Four scope options in the editor rather than two, and `MATCH_TYPES` has to be
validated on import (R-07) because an unknown type is now a realistic thing to receive from an
older or newer export.
---

## ADR-014: Tell our favicon writes from the page's by value, not by an ownership mark
**Status**: Accepted · 2026-09-06 · **Load-bearing**

**Decision.** The content script's MutationObserver decides whether to re-apply by comparing the
icon link's `href` to the URL the active rule wants. It does not consult `data-fc-modified`.

**Why.** The mark cannot answer the question. ADR-001 requires us to repurpose the link Chrome
already tracks, and we mark that element, so on any page that reasserts its own icon the page is
rewriting the very element carrying our mark. Skipping marked elements therefore filtered out
every page write as though it were ours, and only the 2 s backup poller ever noticed. Measured
against a page rewriting its icon every 300 ms, the user's icon was on screen about 7% of the
time. The href is the honest test: if it already points at our URL the write was ours, otherwise
the page changed it.

**If reversed.** The extension loses to every SPA that reasserts its favicon, which is most of the
sites people install it for.

**Also.** It makes a feedback loop impossible for free: our own re-apply produces a mutation whose
`href` matches, which is ignored. The alternative, a suppression flag set around our own DOM
write, has to reason about when the observer callback runs relative to the write and is easy to
get subtly wrong.

**Limit.** A page that reasserts its icon unconditionally and for ever will alternate with us; the
100 ms debounce caps how often we write. See [LIMITATIONS.md](LIMITATIONS.md) L-33.

---

## ADR-015: Ask for a review once, on evidence of use, and never gate it on sentiment
**Status**: Accepted · 2026-09-06

**Decision.** A single review prompt, shown when the extension has applied a favicon on at least
four separate days and the user still has a rule. One "Rate it" going straight to the store
listing, one "No thanks" that is permanent. No second ask, ever, and no question asked before the
link.

**Why.** 1,000 users and 8 ratings is worth addressing, and asking is legitimate. How you ask is
where this goes wrong:

- **Counting opens would ask the wrong people.** Someone who opened the popup ten times on the day
  they installed it is still deciding. The counter therefore advances only on days a rule was
  actually applied to a page, which measures the extension working rather than being examined.
- **Asking twice is a nag.** A favicon extension has no event worth a second ask. The dismissal is
  persisted precisely so a later change cannot quietly turn this into a recurring prompt, and
  `rating.test.ts` asserts it holds at 400 active days.
- **Sentiment gating is out.** "Enjoying this? yes goes to the store, no goes to a feedback form"
  filters the sample, is against Chrome Web Store policy, and is the reason store ratings are
  widely distrusted. There is deliberately no fork in the code to extend.
- **An inline strip, not a dialog.** The popup is a 400px working surface. It takes 47 of 600
  pixels while it is there, and nothing while it is not.

**If reversed.** A recurring or gated prompt trades a rating average for the trust that is this
product's actual differentiation, on a listing whose reviews are already the main thing a
prospective user reads.

**Also.** The counter is local, one write per day at most, and it rides on a storage read the
content script already makes, so a page load costs nothing extra on the other 364 days. Two tabs
opening together on a new day can each count it, which over-counts by one; the value is only ever
compared against a threshold, so the cost is that the ask arrives marginally sooner. Serialising
it would mean waking the service worker on every page load, which is a worse trade. The privacy
policy describes the counter explicitly, because a "days of use" number is exactly the thing a
careful user would want to be told is not analytics.

---

## ADR-016: An unedited pattern is derived, never stored
**Status**: Accepted · 2026-09-07 · **Load-bearing**

**Decision.** The editor's scope state holds only pattern text the user typed, keyed by scope. The
suggested pattern for an untouched field is computed from the current target on demand, by
`patternValue()` in [utils/ruleScope.ts](../utils/ruleScope.ts). Nothing writes a suggestion into
state, and no effect keeps one in step with anything.

**Why.** Storing the suggestion is what kept breaking. It has to be regenerated whenever the
target address changes, whenever the scope changes, when a rule is loaded, and when the popup
hands off to the upload window, and each of those was a separate piece of code that could disagree
with the others:

- R-42: the scope button built the suggestion, so picking the scope before typing the address (the
  normal order on the settings page) left the field empty for ever, and after one save it held the
  previous rule's text, so a rule could be saved silently against the wrong site.
- The fix for R-42 added a sync effect, which then corrupted "Edit that rule instead": the button
  wrote the conflicting rule's matcher into the draft, the address field followed, and the effect
  replaced the matcher with the suggestion derived from it. For a prefix rule that is a strictly
  shorter pattern, so the user was dropped into editing a wider rule than the one they clicked,
  under a new id. Reproduced in a real browser against both builds before this decision.
- The single draft slot was rebuilt on every scope switch, so prefix to regex and back discarded
  the user's prefix text, despite a comment promising it did not.

A derived value cannot go stale, because there is nothing to keep fresh. An override cannot be
clobbered, because the only writer is the user. Both classes of bug stop being possible rather
than being fixed.

**If reversed.** The synchronisation comes back, and with it the class of defect that has produced
three of this project's user-visible bugs.

**Also.** It removed two pieces of state (`patternDraftFor`, `patternEdited`) and one effect, and
`isPatternOverridden()` falls out for free, which is what lets "Suggest from this page" appear only
when it would change something instead of always.

**Cost.** `patternValue()` runs `new URL()` on each render rather than on each change, up to three
times per render through `matcherFor` and `patternErrorFor`. Measured in microseconds on a control
that renders on keystrokes; not worth memoising, and worth much less than the correctness.


---

## ADR-017: Support is a prefilled mail from the user's own client, not a form we host
**Status**: Accepted · 2026-09-07

**Decision.** "Get help" on the settings page composes a `mailto:` to support@palworks.ai with the
subject and body already carrying the extension version, the browser and its major version, the
platform, the rule count and whether verbose logging is on, plus instructions for attaching a log.
The composition lives in [utils/support.ts](../utils/support.ts) and is tested there. There is no
form, no endpoint, and no request the extension makes.

**Why.** The thing missing from support today is not a channel, since the store listing already
provides one. It is that a report arrives with no version, no browser build and no reproduction, so
the first reply is always a request for those. A prefilled mail fixes exactly that, and costs
nothing else:

- **No key.** A hosted form needs a credential to send mail, and a published extension is a public
  archive: anyone can unzip the CRX and read it. See [SECURITY.md](SECURITY.md).
- **No promise to rewrite.** The listing, the README and the privacy policy all say there is no
  server and nothing is collected. A form posting a name, an address and attachments to
  infrastructure we run would make that untrue, would have to be declared in the store's data
  disclosure as personally identifiable information and user communications, and would be material
  enough to expect a re-review.
- **No abuse surface.** An unauthenticated send endpoint is a spam cannon, and the obvious control
  (a third-party challenge script) would mean widening `script-src 'self'`. Weakening the CSP to
  fight spam the feature itself created is a poor trade.
- **No phone number**, in either shape. Nothing here telephones anyone, it is the field most
  likely to stop someone submitting, and it is regulated personal data held for no purpose.

**What it cannot do.** Attach the log automatically, or look like anything but a mail draft. The
body therefore tells the user how to attach one, and adapts: a user who already has verbose
logging on is not told to turn it on.

**Also.** The composed URL is capped at 2000 characters, since some clients truncate a long
`mailto:` silently rather than refusing it. Only the user agent is unbounded, so that is the field
shortened, and the browser and version are on their own derived line precisely so nothing of value
is lost when it is. The diagnostics are rendered on the page as well as sent, and the copy button
hands back the same block, so nobody has to trust a description of what is included and nobody
without a configured mail client is stuck.

**If reversed.** A hosted form is a separate decision, taken on evidence that these mails are
still unusable, and it carries a privacy policy change and a store data disclosure with it rather
than after it. The Resend CLI authenticated on the maintainer's machine is not a route to this: it
lets a person send mail, not the extension.

---

## ADR-018: Chrome Web Store only, English only, for now
**Status**: Accepted · 2026-09-07

**Decision.** The product ships to the Chrome Web Store and in English. Internationalisation
(R-22), the Firefox and Edge listings (R-23) and cross-device sync (R-24) are **paused**: planned
in full, deliberately not started. Store screenshots (R-39) are wanted but do not block a release.

**Why.** All three are reach or convenience projects, and each was sized honestly before being
deferred rather than being deferred because it looked hard:

- **i18n is a week whose payoff cannot be measured yet.** 114 UI strings plus 693 emoji keywords.
  The useful order is extract to `en`, then translate the store listing, then add two or three
  languages that somebody can actually verify. Nothing in the dashboard yet says which language
  that would be, and a mistranslated "prefix", "regex" or "matcher" is worse than English because
  the user cannot tell it is wrong.
- **A second store is a second listing to keep in step for ever.** Not the submission, which is a
  day, but the ongoing duplication: two privacy disclosures, two review queues, two sets of
  release notes. Worth paying when there is a reason to be there, not by default.
- **Sync trades the product's central claim for a convenience that export and import already
  cover** for the "I set up a new laptop" case, which is the case people actually have.

**Consequences, stated so nothing is quietly assumed.** Non-English users see English. The
extension is Chrome and Chromium only in practice, even though Firefox has been verified to work.
Rules do not follow a user between devices, and the settings page's export and import remain the
answer. None of these is a defect and none should be filed as one.

**If reversed.** Each plan is written and current: ROADMAP R-22, R-23 and R-24 carry the design,
the open questions and the measurements, and [PUBLISHING.md](PUBLISHING.md) carries both store
submissions step by step with the listing copy drafted. Restarting one is picking up a plan, not
writing it. The trigger for R-22 is an install breakdown showing a language worth serving *and*
someone who can verify it; for R-23, a reason to want the second channel; for R-24, a user asking
for continuous sync rather than a manual export.

---

## ADR-019: Report what the page did, rather than what the storage write did
**Status**: Accepted · 2026-09-07

**Decision.** A save is reported on evidence from the page, not on the storage write resolving.
The content script's reply to `RulesUpdated` now carries an `ApplyReport` saying what it did, the
editor reads that reply for the one tab the rule targets, and the status line says only what is
known. "Favicon updated successfully!" is shown when a page confirms it applied **that** rule and
never otherwise. Everything else is an amber warning that names the reason.

**Why.** The message was printed as soon as `chrome.storage.local.set` resolved, which proves only
that the rule was stored. Four cases ended with a green tick and no visible change:

1. **The site is on the exclusion list.** The content script returns before applying, and nothing
   warned at save time. No reload would ever help, and there was no signal at all. This one is a
   defect, not a limitation.
2. **A pasted image address that does not load.** Validated for shape, never for existence.
3. **A tab with no live content script**, including every tab open across an extension update.
4. **A rule shadowed by a more specific one.** The pre-save conflict banner covers most of this,
   but it is advisory and the user can save anyway.

The reply already existed. `content.ts` answered `{ok: true}`, `sendMessageToTab` awaited it and
**threw it away**, and `notifyTabs()` was not awaited at all. So the honest answer was one message
hop away and was being discarded.

**What it does not claim.** Nothing here can see the tab strip repaint; `chrome.tabs.faviconUrl`
looks like the verifier and is omitted by Chrome whenever the tab icon is a `data:` URL, which is
the normal case. So the strongest available fact is "a rule matched and the DOM write happened",
and the copy says "updated" on the strength of that and no more.

**Consequences, stated so nothing is quietly assumed.**

- A save takes up to about 1.2s longer in the worst case (a tab with no content script, where
  `ensureContentScriptReady` pings and injects). The common case adds a few milliseconds. The
  Apply button stays in its loading state throughout, and the wait is bounded here rather than by
  the browser (`APPLY_REPORT_TIMEOUT_MS`).
- One extra `RulesUpdated` message to one tab per save, on top of the existing broadcast.
  `notifyTabs` is deliberately left alone: its fan-out policy is the one part of this with a
  measured cost (L-14, L-34) and it is the reliable path. `applyRule()` is idempotent, since
  `updateFavicon` skips a write whose href is already correct, so the extra message can change
  timing and never outcome.
- An `https:` icon address is fetched once at save time to see whether it loads. This is the same
  fetch the rule performs on every apply, to the same address the user typed, and it is disclosed
  as case 1 of [PRIVACY_POLICY.md](../PRIVACY_POLICY.md). An `http:` address is not probed at all:
  an extension page cannot load an insecure subresource under MV3, so the answer would always be
  "broken" whatever is there. See L-37.
- A tab still running the previous release's content script replies `{ok: true}`, which is not a
  report. That reads as unconfirmed, so the user is told to reload a page whose icon may already
  have changed. Deliberate: a conservative message beats a confirmation we did not receive. L-36.

**If reversed.** The four cases above go back to reporting success. The exclusion case in
particular is the one that cannot be diagnosed by the user: the rule is in the list, the site is
in the excluded list, and the two facts sit on different pages.

---

## ADR-020: Serialise every storage mutation, and write only the key that changed
**Status**: Accepted · 2026-09-07

**Decision.** All mutations of `chrome.storage.local` in a given context run one after another
through a single promise chain (`serialise` in [../utils/storage.ts](../utils/storage.ts)), and
each writes only the top-level key it actually changed. `saveRule` additionally treats
`(matchType, matcher)` as a rule's identity: saving over an existing pair collapses the two,
keeping the newer icon and the earlier `createdAt`.

**Why.** `chrome.storage` has no transactions, and every mutation here is a read-modify-write of
a whole map. Two of them at once means the second read happens before the first write, so the
first change is **lost**. Not duplicated, lost. Measured in a real browser: two saves started
together left one rule where there should have been two.

Three separate ways to reach it, all real:

1. **Two quick clicks in the editor.** Picking an emoji *is* the save, with no Apply button to
   disable, so two clicks start two saves. Either one rule vanishes, or two rules exist for one
   matcher, and `findBestRule` breaks an exact tie by keeping the **earlier** one, so the user's
   second choice silently loses.
2. **The popup and the settings page open together**, which the product supports and
   [TESTING.md](TESTING.md) lists as a case to walk.
3. **Writing keys nobody asked to change.** `persistData` wrote `rules` *and* `settings` on every
   mutation, from whatever it had read a moment earlier. So saving a rule could revert a
   concurrent settings change, and saving a setting could revert a rule, with no race between two
   *rule* writes needed at all.

**What it does not fix.** Two different contexts writing in the same few milliseconds. A queue is
per-context, and there is no lock, no compare-and-swap and no transaction in the API. The window
is now as small as the API allows: one read of one key, then one write of that key, with nothing
in between. Recorded as [L-38](LIMITATIONS.md).

**Consequences.**

- Mutations no longer overlap, so they are marginally slower in sequence and correct instead of
  fast and occasionally wrong. Nothing here is on a hot path: the content script only ever
  *reads*.
- A failed write, a full quota being the realistic case, rejects to its own caller and does not
  break the queue for later writers.
- The duplicate collapse is self-healing: it also removes duplicates already in storage from an
  import or an older build, the first time either of them is saved over.
- `(matchType, matcher)` is now effectively a unique key. Nothing else in the code assumed that,
  and [DOMAIN.md](DOMAIN.md) invariant 10 now says so out loud.

**If reversed.** The lost-update race comes back, and with it a bug whose symptom is a rule the
user is sure they created not existing. That is the hardest class of report to believe and the
hardest to reproduce, which is why this is written down rather than left as "be careful".
