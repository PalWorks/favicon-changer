# Roadmap & Work Queue

**Single source of truth for what is left to do.** Audit date: 2026-09-02, against v1.3.0
(commit `b283a49`). Descriptions of each defect live in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md) as `L-xx`; this file is the prioritised queue and
carries the plan for each item. Nothing else in the repo tracks work, if it is not here, it is
not tracked.

Effort key: **S** ≤ half a day · **M** 1 to 3 days · **L** ≥ 1 week.

---

## Status at a glance

Every item in this document, with its state. `R-xx` ids are stable and never reused, so a
finding keeps its number for life. Detail for each is further down; defects are described in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md) as `L-xx`.

Legend: **done** shipped and verified · **next** the current work queue, in order ·
**paused** planned, then deliberately deferred, with the plan kept ready ·
**standing** a decision already taken, no action unless it changes.

| Bucket | Count | Where it stands |
|---|---|---|
| Done | 63 | Shipped and verified, latest 2026-09-09: the pre-release audit's 11, then R-61 and R-62, the master audit's R-64 to R-67, R-39's screenshots and R-63's http icon message |
| Next up | 0 | The queue is empty. What is built is verified, 1.4.4 is live, and the only unreleased change is R-63's save-time message |
| Paused | 3 | R-22, R-23 and R-24, each deferred by decision on 2026-09-07. Plans are written and ready to execute |
| Standing | 6 | Decided, revisit only if the reasoning changes |

Table name: **roadmap-buckets**

**Scope as of 2026-09-07: Chrome Web Store only, English only.** Internationalisation (R-22),
Firefox and Edge (R-23) and cross-device sync (R-24) are paused by decision, not abandoned. Each
already carries a full plan below, so restarting one is picking the plan up rather than writing
it. Recorded as [ADR-018](docs/DECISIONS.md).

### Done

Dated 2026-09-02 unless the row says otherwise.

| ID | Item | Effort | Outcome |
|---|---|---|---|
| R-00 | React type definitions | S | Types installed; `Button` gained the missing `size` prop 11 call sites already passed. `tsc` clean and meaningful |
| R-13 | Automated checks | S | `pre-push` hook: typecheck + tests + build in ~9 s. No Actions workflow, by decision (ADR-012) |
| R-03 | Regex rule corruption on edit | S | Editing a regex rule no longer downgrades and duplicates it |
| R-04 | Most specific match wins | M | Scoring replaces first-match-per-tier. 8 new tests |
| R-05 | Fallback field keystroke storm | S | Commits on blur. 20 chars: 0 writes, was 20 writes + 20 tab broadcasts |
| R-06 | Badge tool silent no-op | S | Explains an unbadgeable page, disables Apply, logs through `logger` |
| R-08 | Content script double-init | S | `window.__fcuContentLoaded` latch |
| R-10 | Duplicated OS detection | S | One `popupClosesOnFileDialog()` helper |
| R-11 | Inert conflict button | S | Acts, or opens Settings when the rule is a regex |
| R-18 | Verified dead code | S | Removed. `isValidBadgeText` held back for R-07 |
| R-19 | `chrome: any` shim | S | Removed from both files; `@types/chrome` now enforced |
| R-26 | `createdAt` overwritten | S | Preserved; `updatedAt` added |
| R-29 | Build config scar | S | Unused `loadEnv` and empty `define` gone |
| R-01 | `prefix` match type | M | "URL Starts With", ranked above regex (ADR-013). Prefilled from the current page; verified covering one Sheets document across its sheets |
| R-02 | Regex in the editor UI | S | Fourth scope option, not hidden behind an Advanced toggle. Live validation, escaped and anchored prefill, live open-tab match count |
| R-07 | Harden rules import | S | Every rule rebuilt field by field in `utils/importRules.ts`; 31 tests. Rejects reported per rule with a reason |
| R-12 | Icon and store-asset sizes | S | `128.png` is now truly 128x128; both promo tiles regenerated at the verified store sizes, with masters kept |
| R-28 | 231 KB logo for a 32px render | S | Replaced by a 160px `logo.png`; the master moved out of `public/`. Package down from 577 KB to 381 KB |
| R-35 | Conflict detector, same-tier shadowing | S | Rewritten to score the candidate and look for anything that outscores it, so it covers every shadowing case with one path |
| R-25 | Misleading fallback-favicon copy | S | Copy now says it applies to every unmatched site, with a warning while it is active. Behaviour unchanged; the promise was the bug |
| R-33 | Per-rule enable/disable | S | A pause switch per rule. Paused rules never match and never shadow |
| R-27 | Storage-usage meter | S | Bytes used against quota, warning band from 75%, self-refreshing |
| R-20 | Log-write races | S | Buffered and batched every 250 ms, flushes chained, forced on `pagehide` |
| R-16 | Dependency hygiene | S | `npm audit` in the pre-push hook, production scope blocking. Fixed 6 high-severity dev advisories (vite 6.4.1 to 6.4.3) |
| R-37 | Undecodable icon showed a broken glyph | S | `FaviconPreview` checks the element, not just the events (L-31) |
| R-38 | Dev server bound to `0.0.0.0` | S | Localhost only; `npm run dev -- --host` is the opt-in (L-32) |
| R-09 | `notifyTabs` fan-out | M | Skips discarded tabs, and only injects into the active tab. The rest are pinged and pick up rules on next load |
| R-14 | Close the test gaps | M | (2026-09-06) 183 tests across 8 files, up from 20 in one. Includes the jsdom identity lock on ADR-001 |
| R-41 | Scope selector layout | S | (2026-09-06) Moved above the URL field and onto one row of four, from review feedback |
| R-32 | Rules list search and sort | M | (2026-09-06) Search, type filter with counts, three sort orders, and multi-select with a batched bulk delete |
| R-21 | Emoji rendered at 64px | S | (2026-09-06) Now 128px like every other source, with headroom for tall glyphs |
| R-30 | Accessibility pass | S | (2026-09-06) Every control has an accessible name (30 of 30 audited), status messages are announced, switches expose state |
| R-45 | Live favicon change did nothing on pages that list `apple-touch-icon` first | S | (2026-09-06) `updateFavicon` mutated the wrong link and deleted the one Chrome paints from. Found by driving the loaded extension in a real browser; reproduced on en.wikipedia.org and fixed |
| R-43 | Our icon lost to any SPA that reasserts its own | S | (2026-09-06) The observer skipped every mutation on the element we had marked, which is the element such a page keeps rewriting. On screen 7% of the time before, wins within 150 ms now |
| R-42 | Prefix and regex prefill never followed the address field | S | (2026-09-06) Picking the scope before typing the URL, which is the normal order on the settings page, left the pattern empty or holding the previous rule's text |
| R-44 | The wrong icon was restored when a rule was deleted | S | (2026-09-06) An `apple-touch-icon` was captured as "the original"; sibling icon links are also no longer destroyed |
| R-17 | Security contact | S | (2026-09-06) support@palworks.ai published in docs/SECURITY.md and the privacy policy, with a three-working-day acknowledgement |
| R-40 | Dependabot | S | (2026-09-06) `.github/dependabot.yml`, grouped and weekly. Config only; the dynamic updater bills 0 ms per run, measured 2026-09-07 (ADR-012 holds) |
| R-36 | Icon artwork oversized | S | (2026-09-06) `128.png` regenerated from the 497px master at 94x96 inside the 128 canvas, the ~96x96 Chrome asks for. 22 KB to 15 KB |
| R-48 | Unit-test the observer's re-apply predicate | S | (2026-09-06) Extracted to `utils/faviconObserver.ts` and covered by 13 tests. Reintroducing the R-43 bug turns 5 of them red, verified by doing it |
| R-47 | Rating prompt | S | (2026-09-06) One ask after four days of real use, permanent dismissal, no sentiment gating (ADR-015). 18 tests. Verified in the loaded extension on both surfaces |
| R-46 | In-product support channel | S | (2026-09-07) "Get help" composes a `mailto:` carrying the version, browser, platform and rule count. No server, no key, no promise changed (ADR-017). 24 tests. Verified in the loaded extension, clipboard fallback included |
| R-50 | Excluding a site did nothing until the page was reloaded | S | (2026-09-07) Our icon stayed, and the observer and poller stayed live. Also the icon capture ran before the exclusion check, so an "untouched" page was read anyway. Both fixed; 8 live checks |
| R-51 | The fallback favicon field accepted anything | S | (2026-09-07) A typo became the icon on every site with no rule of its own, the widest blast radius in the product. Now held to the same guard as an imported icon, with the rejection announced |
| R-52 | An excluded site could be added in a form that never matches | S | (2026-09-07) The field stored whatever was typed, so a pasted address was compared against `location.hostname` and never matched. Now normalised to its host, or refused |
| R-53 | The icon URL field was weaker than the import validator | S | (2026-09-07) It asked only whether `new URL()` parsed, which is true of `javascript:`. The same value was rejected on import. Both now use `isAllowedFaviconUrl`; the weaker helper is gone |
| R-54 | Export was a `data:` URL, which is a size cliff | S | (2026-09-07) Icons are stored inline, so a heavy user's export is megabytes and a `data:` href that size is where a browser quietly refuses. Now a Blob. Verified with a 60KB icon |
| R-55 | The import summary said "1 of them use" | S | (2026-09-07) The one message every importing user reads, and `describeImport` had no test coverage at all. Fixed, and covered by 6 tests |
| R-56 | Two quick saves cleared the second message early | S | (2026-09-07) The status flash left its timer running and never cleared it on unmount. One timer now, replaced rather than stacked |
| R-57 | "Logs copied to clipboard!" was claimed before the write resolved | S | (2026-09-07) A refused clipboard still reported success. Awaited, and it now says what to do instead |
| R-58 | TypeScript was not in strict mode | S | (2026-09-07) The codebase already passed `strict`, so it cost nothing to enforce and stops a regression. Plus noUnusedLocals, noUnusedParameters, noImplicitReturns, noFallthroughCasesInSwitch |
| R-59 | The editor handoff key was declared twice | S | (2026-09-07) Once in `background.ts` and once in `utils/storage.ts`, so renaming one would have broken the Linux upload path silently and only on Linux. Now `utils/handoff.ts`, imported by both |
| R-60 | Documentation described behaviour the code no longer had | S | (2026-09-07) Four stale claims corrected, including a DOMAIN invariant that named the wrong mechanism and a resolution order missing the `prefix` tier |
| R-15 | Extract the editor's logic into a hook | M | (2026-09-07) 771 lines down to 213 of markup over a hook and a pure reducer. An unedited pattern is now derived, not stored (ADR-016), which removed two pieces of state, one effect, and a corruption bug in "Edit that rule instead" reproduced in a real browser against both builds. 52 new tests |
| R-49 | A junk domain rule could be saved | S | (2026-09-07) Chrome percent-encodes illegal host characters where Node throws, so "not a url at all" saved a rule that could match nothing. Hostname shape is checked now, and `localhost:3000` reads as a host and port rather than a scheme |
| R-61 | "Favicon updated successfully!" was claimed, never verified | M | (2026-09-07) The message was printed when the storage write resolved. Four cases ended with a green tick and no visible change, one of which no reload could fix. The page now reports what it did and the status line says only that. 64 unit tests, 25 of 25 mutants killed, and 28 live checks in a real Chrome (ADR-019) |
| R-64 | An exact-URL rule could be saved as text no page can produce | S | (2026-09-07) Typing a bare domain with This Page Only saved the matcher `example.com`, which no `location.href` can equal, so the rule sat in the list matching nothing. The matcher is canonicalised now, or refused with a message |
| R-65 | Two storage writes at once lost one of them | M | (2026-09-07) Every mutation was a read-modify-write of a whole map with no serialisation, so a rule could be **lost**, not duplicated. Reproduced in a real browser. Mutations now queue, write only their own key, and collapse a duplicate matcher. 15 new tests (ADR-020) |
| R-66 | A busy page was reported as unconfirmed | S | (2026-09-07) A page whose main thread is blocked cannot answer inside the budget, so a save that did apply was reported as needing a reload. Measured at 3s of block. One late retry now corrects the message |
| R-67 | The badge preview could be overtaken by an older fetch | S | (2026-09-07) The preview effect fetches the page's icon and had no ordering guard, so on a slow link a stale composition could win and be the one Apply saved, disagreeing with the controls beside it |
| R-62 | A long matcher filled the whole popup | S | (2026-09-07) The conflict warning quoted the winning rule's matcher inline with `break-all`. A real Facebook auth URL wrapped to 25 lines at popup width and pushed "Edit that rule instead" a screen below the fold, so the warning stated the problem and hid the fix. One line now, 15px instead of 375px, with the full value on hover and behind a toggle |

Table name: **roadmap-done**

### Next up

| ID | Item | Effort | State |
|---|---|---|---|
| R-63 | Say something useful about an `http:` icon address | S | ✅ done 2026-09-09. Option (b) built after measuring Chrome's actual behaviour: a distinct save-time warning when the page is https, a note otherwise |

Table name: **roadmap-next**

Nothing else is queued. Everything built is verified and packaged; everything still open is either
paused by decision (table **roadmap-paused**) or a standing decision not to act.

**How the queue got here.** 1.4.0 brought prefix matching, a regex UI, specificity-based
precedence, hardened import, correctly sized store assets, a third smaller package and the Tier 2
bug batch. Driving the loaded extension in a real browser then found R-42 to R-45, of which R-45
broke the product's core promise on a large class of sites. 1.4.2 and 1.4.3 added accessibility
names and announcements, the observer tests, the rating prompt, the editor split (R-15) and the
support channel (R-46). The pre-release audit then found R-50 to R-60, and R-61 replaced the save
confirmation with one earned from the page rather than asserted. A master audit of the whole
codebase on 2026-09-07 then found R-64 to R-67, of which R-65, two storage writes at once losing
one of them, is the most serious defect this project has found by looking rather than by being
told. Items 1 to 8 of the manual list in [docs/TESTING.md](docs/TESTING.md) now run under the
DevTools protocol against a real Chrome, so they are no longer a manual gate.

### Paused

Planned in full, then deferred on 2026-09-07 (ADR-018). Nothing here is blocked on research: each
has its plan and its open questions written down further below, so the cost of restarting is
reading it, not redoing it.

| ID | Item | Tier | Effort | Why it is paused, and what restarts it |
|---|---|---|---|---|
| R-22 | Internationalisation | 5 | M | **English only for now.** 114 UI strings plus 693 emoji keywords, and the useful order (extract to `en`, then the store listing, then two or three verified languages) is a week of work whose payoff cannot be measured yet. Restart when the dashboard's install breakdown shows a language worth serving *and* someone can verify that translation |
| R-23 | Firefox and Edge | 5 | S + M | **Chrome Web Store only for now.** The walkthrough is ready in [docs/PUBLISHING.md](docs/PUBLISHING.md), Edge needs a free account (the screenshots now exist, R-39), Firefox needs a source submission and a licence choice. Restart when a second channel is worth the second listing to keep in step |
| R-24 | Cross-device sync | 5 | L | **Deferred, revisit later.** The design (sync reproducible metadata, never rendered icons) and the trade (opt-in, off by default, policy changed in the same release) are both settled; the work is not started. Export and import already move rules between devices manually |
| R-39 | Store screenshots | 3 | S | **Built 2026-09-09.** Five 1280x800 captures of the shipped build are in [store-assets/screenshots/](store-assets/screenshots/), with the method recorded. Uploading them, and retiring the three 1.3.0-era images on the listing, is a dashboard step |

Table name: **roadmap-paused**

### Standing decisions

| ID | Item | Decision |
|---|---|---|
| R-34 | Options-page Google favicon lookup | Kept and disclosed (ADR-011). Revisit only if the zero-third-party claim outweighs the preview |
| n/a | Analytics of any kind | Never. It is the product's differentiation |
| n/a | `www` normalisation in domain matching | No. Silent host rewriting is worse than a documented asymmetry |
| n/a | `updateFavicon` as remove-and-append | No. Breaks background tabs (ADR-001) |
| n/a | Unconditional `<head>` reconciliation | No. Broke SPAs (ADR-002) |
| n/a | A build-time `define` holding a secret | No. A published extension cannot keep a secret |

Table name: **roadmap-standing**

---

## Where the product stands

| Signal | Value |
|---|---|
| Version | 1.4.4, **published on the Chrome Web Store 2026-09-08** and tagged `v1.4.4`. The served CRX was diffed against `dist/` and matches |
| Store ID | `egedbdckafdbomehjaihjhbcgmngmlah` |
| Users | 1,000 (listing, read 2026-09-07) |
| Rating | 4.5 from 8 ratings |
| Category | Developer Tools |
| Tests | 392 across 14 files, including jsdom locks on the favicon write path and the observer, a pure reducer for the editor's scope logic, the save-outcome describer, and a deliberately deferred storage stub that can see a lost update |
| `tsc --noEmit` | clean |
| Pre-push gate | typecheck + tests + build + production-scope `npm audit` via `.githooks/pre-push` (no CI workflow, ADR-012) |
| CI | none. Zero workflow files. The Actions tab shows only GitHub's dynamic `dependabot/dependabot-updates` entry, billing 0 ms per run (measured 2026-09-07); nothing runs on a push or a pull request |
| Runtime verification | Items 1 to 8 of docs/TESTING.md, and 102 checks across 13 suites driven over the DevTools protocol against a real Chrome on 2026-09-07 |
| Security contact | support@palworks.ai |

Table name: **product-snapshot**

**Remaining in Tier 1 for v1.4.0**: R-01 (prefix matching), R-02 (regex UI), R-07 (import
hardening), R-12 (icon and store-asset dimensions).

---

## Customer feedback driving this roadmap

**Dylan Chang, 5 ★, 1 September 2026** (Chrome Web Store review):

> I really like this extension! It works very well and the custom favicon text is clear and easy
> to recognize. One feature I'd love to see is more flexible URL matching, such as prefix,
> wildcard, or regex matching. For example, I want the same favicon to stay applied to the same
> Google Sheets document, but switching between sheets changes parts of the URL. Prefix matching
> would solve this by allowing one favicon rule to cover all URL variations under the same
> document. Thanks for the great extension!

**What this tells us, beyond the literal request:**

1. The gap is real and structural, not a preference. `exact_url` is byte-exact and `domain` is
   whole-site; there is nothing in between, so a document-scoped icon is impossible to express
   (L-01). Any app with `.../d/<id>/edit#gid=…`-shaped URLs hits it: Sheets, Docs, Notion, Jira,
   Linear, GitHub file views. This is most of the "many tabs, icons as labels" use case, which is
   the reason people install this extension at all.
2. **Regex matching already exists and works**, the engine supports it, it is unit-tested, and
   the rules list renders it, but it is unreachable from the UI (L-02). A paying-attention user
   asked for a feature that is 90% built. That is a shipping problem, not an engineering one, and
   it is the cheapest win available.
3. He asked for three things (prefix, wildcard, regex). Prefix is the one that solves his case,
   and longest-prefix-wins also fixes the unrelated specificity bug in L-04. Wildcard is mostly
   sugar over regex; it can wait.
4. The praise is specific ("custom favicon text is clear and easy to recognize"), the badge
   renderer is landing well. Do not regress `drawBadge`.

**Reply to leave on the review once R-01/R-02 ship**: name the release, say prefix matching and
regex are both available, and thank him by name. A 4.4 average on 7 ratings means one answered
review moves the number.

---

## Tier 0: do this first (half a day, and it changes what everything else costs)

### R-00 · Install React type definitions, then fix what they reveal · **S** · ✅ done 2026-09-02
`@types/react` and `@types/react-dom` are **not installed** (L-29). React 19 ships no bundled
types, and `allowJs: true` lets TypeScript quietly infer React from its JavaScript, so every
component, prop and hook in the project is effectively unchecked, and `npm run build` never runs
`tsc` at all.

```bash
npm i -D @types/react@^19 @types/react-dom@^19
npx tsc --noEmit
```

Measured: **1 error today, 11 with the types installed.** All 11 are one real defect, L-30:
`Button` accepts no `size` prop, yet eleven call sites pass `size="sm"`, so those buttons render
full-size and leak an invalid `size` attribute onto the DOM. Fix is to add a `size?: 'sm' | 'md'`
prop to [components/Button.tsx](components/Button.tsx) with the small variant's padding and text
scale, and stop spreading it onto the element.

Do this **before** Tier 1: R-01 through R-04 all add props and state to the editor components,
and doing that work with no type checking is how the next L-30 gets written.

**Acceptance**: `npx tsc --noEmit` is clean, and the small buttons in the popup and settings page
visibly render small.

**Outcome.** Both types installed. `Button` now takes `size?: 'sm' | 'md'`, defaulting to `md`
with the previously hardcoded padding, and destructures `size` out of the DOM spread so it stops
leaking onto the element. Padding and font size moved from `baseStyle` into the size map so a
size can actually override them. Verified on the options page: the four small buttons compute to
12px / 6px-12px instead of 14px / 8px-16px, with no `size` attribute in the DOM.

---

## Tier 1: flexible matching (ship as v1.4.0)

The customer request plus the two defects that stand in its way. Ship these together; they touch
the same code and are individually incoherent.

### R-01 · Add `prefix` match type · **M** · ✅ done 2026-09-02
`matchType: 'prefix'` where `currentUrl.startsWith(matcher)`. Directly answers the review.

- `types.ts`: extend `MatchType`. Additive, existing rules are untouched, no migration needed.
- `utils/matcher.ts`: new tier (see R-04, which should land as one rewrite).
- **Smart prefill** is what makes this a one-click feature rather than a text field: from
  `https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0`, suggest
  `https://docs.google.com/spreadsheets/d/ABC123`, strip query and hash, then strip the trailing
  path segment. That is exactly Dylan's Sheets case, solved by accepting a default.
- The suggestion must be editable, which means the popup needs a matcher input it does not
  currently have (it only has scope buttons).
- **Acceptance**: one rule survives navigating between sheets of the same document, and does not
  leak to a different document.

**Outcome.** Shipped as the "URL Starts With" scope, ranked above regex. The question of whether
it is redundant given regex is answered in [docs/DECISIONS.md](docs/DECISIONS.md) ADR-013: it is
a strict subset functionally, and worth keeping anyway because a pasted URL is a broken regex,
regex here is unanchored, matcher length is a meaningful specificity signal for prefixes but not
for patterns, and `startsWith` has no ReDoS surface. Wildcards were deliberately not added;
prefix covers the leading-wildcard case and regex covers the rest.

Verified in the browser with the review's own case: typing the Sheets URL and picking the scope
prefills `https://docs.google.com/spreadsheets/d/ABC123` and reports "Matches 2 of your 4 open
tabs", being the two sheets of that document and not the other document on the same site.

### R-02 · Expose `regex` in the editor · **S** · ✅ done 2026-09-02
The engine is done ([utils/matcher.ts:11](utils/matcher.ts#L11)); only the UI is missing (L-02).

- Widen the `applyScope` union at [FaviconEditor.tsx:38](components/FaviconEditor.tsx#L38) to the
  full `MatchType`.
- Popup: keep **Entire Domain** / **This Page Only** as the two primary buttons, and put
  **URL starts with…** (R-01) and **Regex** behind an "Advanced" disclosure, so the common case
  stays two clicks.
- Validate live with the existing `isValidRegex()` and show the error inline; show which of the
  open tabs the pattern would match as a confidence check.
- **Acceptance**: a regex rule can be created, edited and deleted without touching a JSON file.

**Outcome.** Built as a fourth scope option rather than hidden behind an Advanced disclosure, on
the grounds that the audience is a Developer Tools extension. The scope control is a 2x2 grid so
labels stay readable in the 400px popup. The pattern field validates live (an invalid regex is
named as such and the preview is suppressed), prefills an escaped and anchored pattern from the
current page, and reports how many open tabs it matches, with the matching tab titles listed.
The prefix field additionally rejects a pattern that does not start at the beginning of an
address, which is the mistake that would otherwise silently match nothing.

### R-03 · Fix regex-rule corruption on edit · **S** · ✅ done 2026-09-02
Loading a regex rule into the options editor converts it to `exact_url` and saves a duplicate
(L-03). Fix the coercion at [FaviconEditor.tsx:94](components/FaviconEditor.tsx#L94) and the
existing-rule lookup at [line 190](components/FaviconEditor.tsx#L190), match on `id` when
editing a known rule rather than on `matcher` + `matchType`.
**Acceptance**: edit a regex rule's icon, and exactly one rule exists afterwards, still regex.

### R-04 · Most-specific match wins · **M** · ✅ done 2026-09-02
Replace the tier-by-tier `Array.find` (L-04) with a score-and-pick-max over all matching rules:

| Tier | Base score | Tie-break |
|---|---|---|
| `exact_url` | 400 | n/a (only one can match) |
| `prefix` | 300 | + `matcher.length` → longest prefix wins |
| `regex` | 200 | + `matcher.length` |
| `domain` | 100 | + `matcher.length` → `docs.google.com` beats `google.com` |

Table name: **proposed-match-scoring**

`prefix` is deliberately placed **above** `regex`: a document-specific prefix must not lose to a
site-wide regex, and a user who wants a regex to win can make it more specific. This one change
fixes both the review request and the "matching feels random" class of bug, and it is a pure
function, fully unit-testable.
**Acceptance**: new tests for every tier pair and for two same-tier rules of different
specificity; all 20 existing tests still pass unchanged.

### R-07 · Harden rules import · **S** · ✅ done 2026-09-02
`importRulesFromJson` ([storage.ts:154](utils/storage.ts#L154)) checks only that `id`, `matcher`
and `faviconUrl` are present. Before a new `matchType` exists in the wild, add: `matchType` in the
allowed set, `faviconUrl` scheme in `{data:image/*, https:, http:}`, a rule-count cap, a
per-icon size cap, and `isValidRegex()` for regex rules. Rejects should be reported per-rule, not
as a silent drop. Covers threats 1 to 3 in [docs/SECURITY.md](docs/SECURITY.md).

**Outcome.** Validation moved into a pure `utils/importRules.ts`, so the whole decision about
what may enter storage sits in one testable place (31 tests). Every rule is rebuilt field by
field rather than spread, so unknown top-level keys and unknown metadata keys never reach
storage. Enforced: known `matchType`, compiling regex, allow-listed icon scheme (inline images
or http(s) only, which rejects `javascript:`, `data:text/html` and `file:`), a 256KB icon cap, a
500 rule file cap, and the 3 character badge limit that previously existed only as an input
attribute. This is where `isValidBadgeText` finally gets wired up, as R-18 promised. Failures are
reported per rule with a reason instead of being dropped silently.

### R-12 · Fix icon and store-asset dimensions · **S** · ✅ done 2026-09-02
`icons/128.png` is 127×128 (L-25). Promo tiles are 1200×896 and 1632×656 against documented
sizes of 440×280 and 1400×560 (L-26), *verify current requirements in the dashboard before
re-exporting*. Needed for a clean listing update alongside the release.

**Tier 1 total: ~1 week.** Ship as v1.4.0, then answer the review.

---

## Tier 2: correctness bugs (no new features)

### R-05 · Stop the fallback-URL field writing on every keystroke · **S** · ✅ done 2026-09-02
[GlobalSettings.tsx:69](components/options/GlobalSettings.tsx#L69) persists and broadcasts to
every tab per character typed (L-07). The `onBlur` handler already does this correctly, make the
input local state and delete the `onChange` write.

### R-06 · Badge/Overlay must not fail silently · **S** · ✅ done 2026-09-02
When the page has no favicon, the preview never renders and **Apply** does nothing (L-09). Show
"This page has no icon to badge, set an emoji or upload one first", and disable Apply. Also
replace the two `console.error` calls in
[BadgeSection.tsx](components/editor/BadgeSection.tsx#L85) with `logger.error` so the failure
reaches the support log.

### R-08 · Guard the content script against double-init · **S** · ✅ done 2026-09-02
Add a `window.__fcu_loaded` latch at the top of [content.ts](content.ts) (L-13). Without it, a
ping that races a still-loading tab yields two observers, two intervals and two message
listeners in one context.

### R-11 · Finish or remove "Switch to Overriding Rule" · **S** · ✅ done 2026-09-02
The button is live and effectively inert (L-08). Either load the conflicting rule into the editor
properly, or delete the button. Do not leave a visible control that does nothing.

### R-09 · Narrow the `notifyTabs` fan-out · **M** · ✅ done 2026-09-02
One rule save pings every open tab and injects where silent (L-14). Skip discarded tabs, and
message only tabs whose URL could be affected by the changed rule, the matcher is already
available to decide that.

**Outcome.** `sendMessageToTab` grew an `inject` flag, and `notifyTabs` now sets it only for the
**active** tab of each window: that is the tab the user is looking at, where the change has to be
visible immediately. Discarded tabs are skipped entirely, since they have no live content script
and re-run it when next activated. Every other tab is pinged without injection and reads the new
rules on its next load.

Filtering by "could this rule affect this URL" was considered and rejected: it needs a diff of
the old and new rule sets to be correct (a deleted rule affects the tabs it *used* to match), and
the injection cost was the actual problem, not the message.

### R-10 · One OS-detection source of truth · **S** · ✅ done 2026-09-02
`getPlatformInfo()` versus a UA regex, in two files, able to disagree (L-15). Resolve once in the
service worker, store the verdict, and have the UI read it.

### R-25 · Make the global fallback mean what it says · **S** · ✅ done 2026-09-02
Either restrict `defaultFaviconUrl` to pages that genuinely have no icon of their own (matching
the settings copy), or rewrite the copy to "apply to all sites without a rule" and add a
confirmation. The current mismatch reads as the extension going rogue (L-06).

### R-20 · Fix log-write races · **S** · ✅ done 2026-09-02
Batch or queue the `debug_logs` read-modify-write (L-16). Lost lines are worst exactly when the
log matters.

---

### R-35 · Widen the conflict detector to same-tier shadowing · **S** · ✅ done 2026-09-02
Now that a longer domain matcher beats a shorter one, a domain rule can be shadowed by another
domain rule, which `findConflictingRule` does not detect: it still only looks for an `exact_url`
or `regex` rule shadowing a domain-scoped edit. Scoring the rule being edited against every
other rule would cover every shadowing case with one code path, and would let the banner name
the winner instead of describing its type.

### R-45 · Live favicon change did nothing on pages that list `apple-touch-icon` first · **S** · ✅ done 2026-09-06
The highest-value bug in this batch, and one only a real browser could find. `updateFavicon` took
`iconLinks[0]`, the first element matching `link[rel*='icon']`. On any page whose head lists
`<link rel="apple-touch-icon">` before its favicon, and Wikipedia is one of a great many, that is
not the element Chrome paints the tab from. We mutated that one and then deleted the real
`<link rel="icon">` on the next line, leaving Chrome tracking a node that no longer existed. The
result: adding a rule to an already-open page changed nothing at all until the page was reloaded,
which is exactly the failure ADR-001 exists to prevent. It went unnoticed because a reload always
worked, and because the local test pages all had a single icon link.

Fixed by choosing the link Chrome actually paints from: one we already own, else the first link
whose `rel` contains `icon` and is not `apple-touch-icon`, `apple-touch-icon-precomposed`,
`mask-icon` or `fluid-icon`, else the first icon-ish link, else a new one. The sibling sweep now
removes only competing tab favicons and leaves the rest alone, so a page keeps its home-screen and
pinned-tab artwork. Three new jsdom cases lock it in. Verified live on en.wikipedia.org in both an
active and a background tab: before, no repaint at all; after, both repaint without a reload.

### R-43 · Our icon lost to any SPA that reasserts its own · **S** · ✅ done 2026-09-06
The MutationObserver opened by skipping any mutation whose target carried our ownership mark. That
looks right and is exactly wrong: `updateFavicon` repurposes the link Chrome already tracks
(ADR-001) and marks *that* element, so on a page that reasserts its own icon the page keeps
rewriting the very element we marked, and every one of those writes was filtered out as if it were
ours. Only the 2 s backup poller ever noticed.

Measured against a page rewriting its icon every 300 ms: our icon was on screen for about 150 ms
out of every 2 s, roughly 7% of the time, with a visible flicker. The mark cannot answer "who
wrote this", so the href value does instead: if the icon link already points at our URL the write
was ours, otherwise the page changed it and we re-apply. That also makes a loop impossible, since
our own re-apply produces a mutation whose href matches and is ignored. After the fix, on a page
that reasserts eight times and stops (an ordinary SPA), our icon is restored within 150 ms of each
write and holds from then on. On a page that reasserts unconditionally for ever, the two alternate;
that is inherent, and the 100 ms debounce caps the cost. See LIMITATIONS L-33.

### R-44 · The wrong icon came back when a rule was deleted · **S** · ✅ done 2026-09-06
`readOriginalFaviconHref` returned the first unmarked `link[rel*='icon']`, so on Wikipedia it
captured the `apple-touch-icon` and restored that in place of the real favicon. `updateFavicon`
also deleted every other icon link, so the page could not recover them without a reload. Both are
fixed by the same preference used for R-45. Four new jsdom cases. Verified live: deleting a rule
on a background Wikipedia tab now restores `favicon/wikipedia.ico` in about a second, and the
`apple-touch-icon` link is still there afterwards.

## The 2026-09-07 pre-release audit

A full read of every source file, a dependency and secret scan, then 72 assertions driven against
the loaded extension in a real Chrome, in ten suites: core matching and repaint, the three
verification signals, exclusions, the settings page's inputs, the editor's save paths, import,
badge and file upload, export, surface health, and the packaged archive itself. R-50 to R-60 are what it found. Nine were defects in shipped
behaviour, and none of them had a failing test: seven were in code paths no unit test could reach
(a browser input, a download, a clipboard), and two were in code with no tests at all.

The two conclusions worth keeping:

1. **Every input the user can type into needs the same guard as data arriving from a file.** Three
   of the nine (R-51, R-52, R-53) were the same mistake in three places: the import path was
   hardened by R-07 and the typing paths were left as they were, so a value rejected from a file
   was accepted from a keyboard.
2. **A false failure costs as much as a real one.** Seven runs failed for harness reasons before
   the product was ever at fault, including a stale content script that survived a rebuild. They
   are all written down in [docs/TESTING.md](docs/TESTING.md), table **testing-harness-traps**.

### R-50 · Excluding a site did nothing until the page was reloaded · **S** · ✅ done 2026-09-07
Two faults in one branch of `applyRule()`, both contradicting DOMAIN invariant 1.

Excluding a domain while one of our rules was applied returned early, so **our icon stayed on the
page** and the MutationObserver and the 2s poller stayed live. The user's only recourse was a
reload, which the settings copy does not mention. And `captureOriginalFavicon()` ran *before* the
exclusion check, so an excluded page had its `<head>` read after all, which the same invariant says
never happens.

Now the exclusion check runs first, and it restores the page's own icon and tears everything down
if we had already acted. Verified live: excluding a site with a rule applied put `/red.png` back in
both the DOM and the tab strip with no reload, and it stayed put across two poll intervals.

### R-51 · The fallback favicon field accepted anything · **S** · ✅ done 2026-09-07
`commitFallback()` trimmed the input and saved it. Nothing else. That value becomes the icon on
**every site with no matching rule**, so a typo was the widest-reaching mistake available in the
product, and the only feedback was every tab quietly showing a broken image.

It is now held to `isAllowedFaviconUrl`, the same guard an imported rule's icon passes, and a
rejection is announced through `role="status"` rather than saved. Verified live: junk is refused
with a message and nothing is written; a real address saves on blur and on Enter.

### R-52 · An excluded site could be added in a form that never matches · **S** · ✅ done 2026-09-07
The field lower-cased what was typed and stored it. The content script compares that against
`window.location.hostname`, so pasting `https://analytics.google.com/reports` added an entry that
could never match anything, with no way for the user to tell.

Normalised through `hostnameFromInput()` now, which is the helper the rest of the editor already
uses, so a pasted address becomes `analytics.google.com`. Input with no readable host is refused
with a message instead of stored. Verified live for both cases.

### R-53 · The icon URL field was weaker than the import validator · **S** · ✅ done 2026-09-07
"Paste image URL" checked `isValidUrl`, which answered only whether `new URL()` parsed the string.
That is true of `javascript:alert(1)` and `data:text/html,...`. The very same value in an imported
file was rejected by `isAllowedFaviconUrl`, so the product was stricter about a file it was given
than about a value it was typed.

Both paths now use `isAllowedFaviconUrl`, and **`isValidUrl` has been deleted** rather than left
lying around for the next person to reach for, with a note in its place saying why. Verified live:
`javascript:alert(1)` is refused with a message and saves nothing; a real image address saves.

### R-54 · Export was a `data:` URL, which is a size cliff · **S** · ✅ done 2026-09-07
`exportRulesAsJson` built `data:text/json;charset=utf-8,` plus the whole encoded file and put it in
an anchor's href. Every icon is stored inline (ADR-004), so a user with a few dozen uploads has a
multi-megabyte export, and a `data:` href that size is where a browser refuses the navigation
without saying anything.

Now a Blob and an object URL, the same pattern `logger.downloadLogs()` already used. The download
also stopped carrying the pre-release codename: `favicon-changer-rules-<date>.json`. Verified by
driving the real button with a 60KB inline icon in storage and reading the file off disk: valid
JSON, both rules, the icon byte-for-byte, and a regex matcher intact.

### R-55 · The import summary said "1 of them use" · **S** · ✅ done 2026-09-07
Found by reading what a real import actually said, rather than by reading the code. `describeImport`
is the one thing every importing user sees, and it had **no test coverage at all**, so the plural
had nowhere to fail. Fixed to agree with its count, and covered by 6 tests including the cap that
stops a file of 500 bad rules producing 500 lines in a modal.

### R-56 · Two quick saves cleared the second message early · **S** · ✅ done 2026-09-07
`flashStatus` called `setTimeout` and kept no handle, so a second save inherited the first save's
countdown and its confirmation vanished early. Nothing cleared the timer on unmount either, and the
action popup is destroyed the moment it loses focus. One timer now, replaced on each flash and
cleared on unmount.

### R-57 · "Logs copied to clipboard!" was claimed before the write resolved · **S** · ✅ done 2026-09-07
`navigator.clipboard.writeText()` was called without `await` and the success alert fired
regardless, so a clipboard refused for want of focus or permission still reported success. Awaited
now, with a message that tells the user to use Download instead. The same mistake was avoided in
the new support section, which is what prompted the check here.

### R-58 · TypeScript was not in strict mode · **S** · ✅ done 2026-09-07
`tsconfig.json` had no `strict`, so `strictNullChecks` and `noImplicitAny` were both off, while
[AGENTS.md](AGENTS.md) asked for exactly that in prose. Measured before changing anything: the
codebase **already passed** `--strict` with zero errors, so this was free, and now it cannot
silently regress. `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` and
`noFallthroughCasesInSwitch` went on with it, after fixing the three things they found (an unused
React import, an unused catch binding, an effect with one path returning a cleanup and one not).

`exactOptionalPropertyTypes` (8 errors) and `noUncheckedIndexedAccess` (52) were measured and
deliberately left off, with the reasons recorded in the config: both would be churn against
patterns this codebase uses on purpose.

### R-59 · The editor handoff key was declared twice · **S** · ✅ done 2026-09-07
`pendingEditorTarget` was a string literal in `background.ts` and another in `utils/storage.ts`.
Renaming one would have broken the Linux upload path (ADR-007) silently, and only on Linux, which
is the hardest possible place to notice. Both now import `utils/handoff.ts`, which is its own tiny
module rather than a constant in `constants.ts` because the service worker is a separate bundle and
`constants.ts` carries the 693-keyword emoji catalogue. `background.js` stayed at 1.34 kB.

### R-60 · Documentation described behaviour the code no longer had · **S** · ✅ done 2026-09-07
Four stale claims, each found by reading the doc against the code rather than by trusting it:

- **DOMAIN invariant 5** said our own writes are ignored because the observer skips marked
  elements. That is the exact bug R-43 fixed; it compares the `href` value (ADR-014). The glossary
  entry for the change mark said the same wrong thing, and so did the top of `faviconDom.ts`.
- **DOMAIN's resolution order** listed exact_url, regex and domain, missing the `prefix` tier
  entirely, and implied the tiers are scanned in order rather than scored.
- **ARCHITECTURE's `updateFavicon` steps** still described taking the page's first icon link,
  which is what R-45 fixed, and its observer bullet repeated the marker claim.
- **LIMITATIONS L-20** still said Firefox needs a `browser` namespace shim, which R-23 disproved by
  installing the build in Firefox 154, and `store-assets/README.md` still called R-36 outstanding.

### R-49 · A junk domain rule could be saved · **S** · ✅ done 2026-09-07
Found while auditing R-15 in a real browser. Typing "not a url at all" on the settings page with
Entire Domain selected saved a rule whose matcher was `not%20a%20url%20at%20all`: a string no
`location.hostname` can ever equal, so the rule sat in the list matching nothing.

The cause is a genuine engine difference, and a hazard for this whole test suite.
`new URL('https://not a url at all')` **throws in Node and succeeds in Chrome**, which
percent-encodes the characters that are illegal in a host instead. `hostnameFromInput()` treated
"the parser did not throw" as "this is a hostname", so the guard held in the tests and not in the
product. Recorded in [docs/TESTING.md](docs/TESTING.md), since it applies to anything that leans
on `URL` parsing.

Fixed by checking the shape of the parsed hostname (`looksLikeHostname`) rather than inferring it:
no percent-encoding, and no empty labels, so `...`, `a..b` and `.com` are rejected too. Both cases
now produce the "Could not read a domain from that address." error the code already had ready, and
save nothing.

The same audit found a second parser trap in the other direction. "Has a scheme" was tested as
`scheme:`, so `localhost:3000/app` parsed as the `localhost:` scheme with an empty host and a path
of `3000/app`, and the prefix suggestion built from it was `localhost:///3000`, which then passed
prefix validation because it does contain `scheme://`. A scheme now means `scheme://`
(`hasExplicitScheme`), so a developer typing a local address gets `https://localhost:3000/app` as
a prefix and `localhost` as a domain. This extension is listed under Developer Tools; its users
type port numbers.

### R-42 · Prefix and regex prefill never followed the address field · **S** · ✅ done 2026-09-06
`selectScope` built the suggested pattern from whatever URL was known at the moment the scope
button was clicked, and nothing regenerated it afterwards. On the settings page the URL field
starts empty and the scope is normally picked first, so the pattern field stayed empty however
much the user then typed, and the save failed with a message about prefixes needing to start at
the beginning of the address. Worse, after saving one rule the field kept the previous rule's
text, so a prefix rule could be saved silently against the wrong site.

A `patternEdited` flag now separates a suggestion from the user's own text: a suggestion is
re-derived whenever the target URL changes, the user's text never is. Editing the field, loading a
saved rule, and the popup-to-window handoff all set it; switching scope, and the "Suggest from
this page" button, clear it. Verified live in the loaded extension: scope first then typing gives
`https://docs.google.com/spreadsheets/d/ABC123` from a full Sheets URL, changing the address
follows it, a hand-edited pattern survives a later address change, and switching to Regex
regenerates in the other syntax.

---

## Tier 3: engineering hygiene

### R-13 · Automated checks · **S** · ✅ done 2026-09-02
Implemented as a **local git hook, not a GitHub Actions workflow**, because minimising Actions
usage is a project constraint (ADR-012).

[.githooks/pre-push](.githooks/pre-push) runs the type check, the unit tests and the full
two-pass production build, and blocks the push on any failure (~9 s). It installs itself through
`package.json`'s `prepare` script (`git config core.hooksPath .githooks`) on `npm install`.
`npm run check` runs typecheck plus tests on demand; `npm run typecheck` runs tsc alone.
Bypass is `git push --no-verify`.

Verified in both directions: passes on a clean tree, and blocks with exit 1 on an introduced
type error.

**Known gap**: a hook protects only the machine it is installed on, and cannot gate a PR from
an outside contributor. If that becomes relevant, add a single-job workflow limited to PRs
against `main`. See ADR-012.

### R-14 · Close the test gaps · **M** · ✅ done 2026-09-06
In value order: `utils/validation.ts`; the storage migration latch; `normalizeImageDataUrl`;
`isRestrictedUrl`; then a jsdom test asserting `updateFavicon` mutates the **same element
instance**, which would lock ADR-001 into the suite where it belongs. See
[docs/TESTING.md](docs/TESTING.md).

**Outcome.** 165 tests across 7 files, up from 20 in one file. New: `validation.test.ts`,
`patterns.test.ts`, `importRules.test.ts`, `canvas.test.ts` (`normalizeImageDataUrl`),
`messaging.test.ts` (`isRestrictedUrl`), and `storage.test.ts` covering the v1 migration, its
latch, settings defaults and storage usage.

**Completed 2026-09-06 with the jsdom lock on ADR-001.** `jsdom` added as a devDependency and
the favicon write path extracted from `content.ts` into `utils/faviconDom.ts` so it could be
tested at all; the content script remains its only importer, and keeps the orchestration.

The test asserts on the **identity** of the mutated element rather than its final `href`, because
a replaced node ends up with the right `href` and still fails in a real browser. Proven by
rewriting the function as remove-and-append and confirming 8 cases go red, then restoring it.
183 tests across 8 files. Remaining gaps (messaging paths, logger batching, `content.ts`
orchestration, canvas drawing) are listed in [docs/TESTING.md](docs/TESTING.md).

### R-18 · Delete verified dead code · **S** · ✅ done 2026-09-02
The full verified inventory is table **verified-dead-code** in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md): `generateFavicon` + `GenerateFaviconOptions` +
`Shape`, `EXTENSION_WIDTH`/`HEIGHT`, `DEFAULT_EMOJIS`, the unused `TabInfo` import and the
duplicate `TabInfo` interface, and the `RESET_ICON` handler. **Two exceptions**: `isValidBadgeText`
is unused but should be *wired up* in R-07 rather than deleted, and `switchToConflictRule` is not
dead, it is R-11.

### R-19 · Restore type safety at the Chrome boundary · **S** · ✅ done 2026-09-02
Drop `declare const chrome: any` from [content.ts:3](content.ts#L3) and
[storage.ts:5](utils/storage.ts#L5); `@types/chrome` is already installed and configured (L-23).
Expect real errors to surface, that is the point.

### R-48 · Unit-test the observer's re-apply predicate · **S** · ✅ done 2026-09-06
ADR-014 is the second load-bearing decision in the content script and nothing in the suite
protects it. The bug it fixed, deciding ownership by the marker instead of by the href, would pass
every test in the repo today, exactly as R-43 did for months. It is verified only by having driven
a real browser, which is not a thing that runs on push.

Done by extraction rather than by stubbing `content.ts`, following the precedent
`utils/faviconDom.ts` set: `utils/faviconObserver.ts` now owns the predicate
(`displacesFavicon`) and the debounce, imports nothing from `chrome.*`, and runs under jsdom with
a real `MutationObserver`. 13 tests cover a page write on the element we own, our own write, a
re-write of the same value, an appended icon link, unrelated head churn, an `apple-touch-icon`
rewrite, coalescing a 20-write burst into one re-apply, settling rather than ping-ponging after we
take the icon back, and disconnect cancelling a pending re-apply. Reintroducing the exact R-43 bug
turns 5 of them red, verified by doing it. `content.ts` fell from 239 to 201 lines as a
side effect.

Still untested, and now cheaper than before: the do-nothing guard (ADR-002) and the self-stopping
poller, both of which need `chrome.storage` stubbed around `content.ts` itself.

### R-15 · Extract the editor's logic into a hook · **M** · ✅ done 2026-09-07
`FaviconEditor.tsx` was 771 lines of state, effects and markup in one scope, with a
`mode` x `context` matrix whose effects must not fire in the wrong combination (ADR-010). R-01,
R-02, R-41 and R-42 had each added state to it. It held the save path for every rule the product
creates and had no tests, because logic and markup could not be separated to test either.

It was framed as a refactor with no user-visible benefit. That turned out to be wrong: doing it
found and removed a real bug, described below.

**Shape.** Three layers instead of one file.

| Layer | File | Why |
|---|---|---|
| Scope and pattern rules | [utils/ruleScope.ts](utils/ruleScope.ts) | Pure reducer plus derivations. No React, no chrome.*. 52 tests |
| Plumbing | [components/editor/useRuleEditor.ts](components/editor/useRuleEditor.ts) | chrome.* calls, the mode/context lifecycle, the save path |
| Markup | [components/FaviconEditor.tsx](components/FaviconEditor.tsx) | 213 lines. Draws; decides nothing |

Table name: **r15-layers**

Presentational pieces came out too: `ScopeSelector`, `PatternField`, `EditorHeader` and
`ConflictBanner`, each taking plain props.

**The decision that made it worth doing (ADR-016).** An unedited pattern is now *derived* from the
current target rather than stored in state. Storing it meant synchronising it from five different
places, and that synchronisation is where every editor bug has come from. Deriving it removed two
pieces of state (`patternDraftFor`, `patternEdited`) and the sync effect R-42 had added.

**The bug it found.** The R-42 fix had broken "Edit that rule instead" on the conflict banner. The
button wrote the winning rule's matcher into the draft, the address field followed it, and the new
sync effect then replaced the matcher with the suggestion derived from it. For a prefix rule that
suggestion is strictly shorter, so clicking the button dropped the user into editing a *wider*
rule than the one they clicked, and saving it created a second rule rather than editing the first.
Reproduced in a real browser on both builds: the old one shows `https://other.test/a` in the
pattern field while the address field says `https://other.test/a/b`; the new one shows the matcher
unchanged. It is impossible now by construction, since a saved matcher is an override and nothing
but the user writes to that slot.

**Also fixed along the way.** Switching prefix to regex and back no longer discards the user's
prefix text, which the old single-slot draft did despite a comment promising otherwise. A bare
domain typed on the settings page now yields `https://google.com/` rather than a suggestion that
failed its own validation. "Suggest from this page" appears only when it would change something.

**Verified in the loaded extension**, not only by unit test: the pattern following the address and
holding the user's edits; all four save paths; loading and re-saving an existing rule (same id,
`createdAt` preserved, no duplicate); the conflict switch; every error path announcing assertively
and saving nothing; the popup at 400x600 with four 79px scope buttons and no clipping; and a
background tab's favicon still changing without a reload.

### R-29 · Clean the build config · **S** · ✅ done 2026-09-02
Remove the unused `loadEnv`/`env` and the empty `define: {}` in `vite.config.ts` (L-28).

### R-16 · Dependency hygiene · **S** · ✅ done 2026-09-02
Add `npm audit --production` to CI and enable Dependabot. Two runtime dependencies makes this
cheap to keep green (threat 5).

**Outcome.** `npm audit` runs in the pre-push hook. Production scope blocks the push; dev-only
advisories are printed without blocking, since they are frequent and do not reach users; an
audit that cannot reach the registry is reported as inconclusive so an offline push still works.

This immediately found something: production dependencies were clean, but **six high-severity
advisories were open against the pinned Vite**, all in its dev server (path traversal in
optimized-deps `.map` handling, arbitrary file read over the dev-server websocket, and an
`fs.deny` bypass). Fixed inside the existing `^6.2.0` range, 6.4.1 to 6.4.3.

Following that thread found R-38: `vite.config.ts` bound the dev server to `0.0.0.0`, so those
advisories were reachable from the whole LAN and any VPN interface while `npm run dev` ran. Now
localhost-only. Dependabot is not set up, tracked as R-40.

### R-26 · Add `updatedAt`, stop overwriting `createdAt` · **S** · ✅ done 2026-09-02
The rules list's "Created" column is really last-modified (L-10).

---

### R-37 · Undecodable icon showed a broken glyph · **S** · ✅ done 2026-09-02
A `data:` URL that is well-formed but not a decodable image leaves a 0x0 image and fires **load**,
not error, and a data URL can finish loading before React attaches the handlers, so neither fired.
`FaviconPreview` now also checks the element for `complete && naturalWidth === 0`. Reachable
through import, since decodability cannot be checked at import time. Found while verifying R-33
against deliberately broken test data. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) L-31.

### R-38 · Dev server bound to every network interface · **S** · ✅ done 2026-09-02
`vite.config.ts` set `host: '0.0.0.0'`, putting `npm run dev` on the LAN and on any VPN or
tailnet interface, while Vite's dev server had four open path-traversal and arbitrary-file-read
advisories. Now localhost-only, with `npm run dev -- --host` as the explicit opt-in. See
[docs/SECURITY.md](docs/SECURITY.md) threat 6 and L-32.

### R-36 · Icon artwork is larger than Chrome suggests · **S** · ✅ done 2026-09-06
`public/icons/128.png` was a correct 128x128 whose artwork filled about 122x122, where Chrome
asks for roughly 96x96 so icons line up with each other. Regenerated from
`store-assets/masters/logo-source-497px.png` at 94x96 centred in the 128 canvas, 16 to 17 px of
transparent padding on every side, and 22 KB down to 15 KB. `16.png` and `48.png` are deliberately
left filling their canvases: the padding guidance is for the 128 used by the store and
`chrome://extensions`, while those two are the toolbar and management icons, which should not
shrink.

### R-39 · Store screenshots · **S** · ✅ done 2026-09-09
This was previously written as an unknown: whether the live item carried any screenshots was
thought to be readable only in the dashboard. That was wrong. The public listing page labels each
one in `alt` text (`Item media N (screenshot)`), so it can be read remotely, and it was on
2026-09-08. **The item has three, all 1280x800**, and none of them are in this repo.

What they show, and why they are now misleading rather than merely old:

- All three picture the **two-button scope selector** of 1.3.0. The product has had four scopes
  since 1.4.0 (domain, exact URL, prefix, regex) in a different layout (R-41).
- The settings-page capture is captioned "based on a set of regex rules" while the interface
  behind the caption has no regex option. The screenshot **undersells** what now ships.
- The section rows show the emoji glyphs that 1.4.4 replaced with drawn icons, so the interface in
  the pictures no longer matches the one a new user opens.
- Each capture includes a full browser tab strip of real tabs, with readable page titles, and the
  rules list shows real addresses with only partial blurring. Nothing secret, but it is the
  author's own browsing on a public page, which is a reason to reshoot rather than retouch.

**What shipped.** Five captures at 1280x800, 24-bit PNG without alpha, in
[store-assets/screenshots/](store-assets/screenshots/): the tab strip with custom icons and a
labelled magnifier, the four-way scope selector with its live open-tab count, the emoji picker, a
badge over GitHub's real favicon, and the rule manager. Every pixel of interface is a capture of
the shipped build, driven over the DevTools protocol in a throwaway Chrome on an `Xvfb` display
with a fresh profile, so none of the author's own tabs, profile or browsing can appear, which was
the flaw in the images being replaced. The editor was pointed at each target through the same
`pendingEditorTarget` key the toolbar click uses, so each shot is a real editor session.
[store-assets/screenshots/README.md](store-assets/screenshots/README.md) records the method, the
three things that were staged, and the rule that a caption must describe what the picture shows.

**Left to do by hand:** upload them and delete the three 1.3.0-era images. Only the dashboard can
do that.

### R-40 · Dependabot · **S** · ✅ done 2026-09-06
The audit gate added by R-16 is local and only runs on push, so a new advisory was invisible until
someone next pushed. `.github/dependabot.yml` now raises weekly npm updates, grouped into at most
one production and one development pull request, capped at three open. It is compatible with
ADR-012 because there is no workflow file: GitHub runs the updater and lists it in the Actions tab
as a dynamic `dependabot/dependabot-updates` entry, whose billable time measured 0 ms per run on
2026-09-07, and nothing in the repository runs on a push or a pull request. The
pull requests are reviewed and merged by hand, and the pre-push hook is still what runs the type
check, the tests, the build and the audit.

---

### R-41 · Scope selector placement and layout · **S** · ✅ done 2026-09-06
From review feedback on the running extension. The selector now sits directly under the TARGET
PAGE header and above the URL field, since it decides how that text is read; in the popup, where
the target is the current tab, it follows the site line rather than splitting it from its
heading. One row of four instead of a 2x2 grid, with short button labels (Domain, This Page,
Starts With, Regex) so four fit the 400px popup: 79px each there, 118px on the options page, no
clipping. Full names kept for prose, tooltips and `aria-label`. Also removed the helper line
under the pattern field, which repeated the scope hint sitting just above it.

---

## Tier 4: product depth

### R-27 · Storage-usage meter · **S** · ✅ done 2026-09-02
Show used/available in settings, with a warning band, so "Storage full" is never a surprise
(L-12). `chrome.storage.local.getBytesInUse()` already exists.

### R-33 · Per-rule enable/disable toggle · **S** · ✅ done 2026-09-02
Today the only way to test whether a rule is the culprit is to delete it (L-11). A boolean on the
rule plus a switch in the list. Also the cheapest possible support tool.

### R-32 · Make the rules list scale · **M** · ✅ done 2026-09-06
Search, sort by matcher or date, filter by match type, bulk delete (L-11).

### R-30 · Accessibility pass · **S** · ✅ done 2026-09-06
Icon-only buttons carry `title` but no `aria-label`; the verbose-logging switch has no label
association. Keyboard traversal of the emoji grid is untested.

**Outcome.** Audited in the browser rather than by eye: every `input`, `select` and `button` on
the settings page, with all sections expanded, checked for an accessible name from `aria-label`,
an associated `<label>`, text content or `title`. Started at five unnamed controls plus two file
inputs, now 30 of 30 named and none unreachable by keyboard.

Specifically: visible labels associated with their fields via `htmlFor`/`id` rather than sitting
next to them; `aria-label` on the emoji search, emoji buttons, category jumps, colour pickers,
the opacity slider, badge text and both file inputs; `aria-label` on the icon-only header
buttons; and the verbose-logging switch, which had no name at all.

Status messages are now `role="status"` with `aria-live` (assertive for errors, polite for
confirmations), so a save result is announced rather than only drawn. The conflict banner is a
polite live region, and the debug log pane is `role="log"`.

### R-21 · Render emoji at 128px · **S** · ✅ done 2026-09-06
Emoji use a 64×64 canvas at 54px serif while every other source is 128×128, inconsistent
sharpness on high-DPI, and tall glyphs can clip.

### R-28 · Optimise the shipped logo · **S** · ✅ done 2026-09-02
`icons/FaviconChangerLogo.png` was 497x502 and 231 KB, about 40% of the package, for a 32px
render (L-27). Replaced by a 160px `logo.png`, with the master kept in `store-assets/masters/`.

### R-34 · Reconsider the options-page Google lookup · **S** · *decided for now*
ADR-011 keeps the `google.com/s2/favicons` preview and discloses it. If the zero-third-party
claim later matters more than the preview, the options are: drop the preview, or fetch
`https://<domain>/favicon.ico` directly (which leaks the domain to that site instead and fails on
many sites). No action unless that priority changes.

---

### R-46 · An in-product support channel · **S** · ✅ done 2026-09-07
Today a user with a problem has the Chrome Web Store support page and nothing else, and what
arrives has no version, no browser build and no reproduction. The extension already has the
missing half: opt-in verbose logging the user can download.

Two shapes. They are not the same product, and the difference is not effort but what the product
promises.

**Variant A, a prefilled mail. S.** A "Contact support" action composes to support@palworks.ai
with the subject and body already carrying the extension version, the browser and OS strings, the
rule count, whether verbose logging is on, and a line telling the user to attach the log file the
settings page can already download. It sends from the user's own mail client.

- No server, no key, no new network request, no change to the privacy policy, no change to the
  store's data disclosure, nothing to rate-limit, nothing to breach.
- It cannot capture attachments automatically, and it cannot be styled.
- One real constraint: keep the composed body under about 2000 characters, because longer
  `mailto:` URLs are truncated or refused by some clients. So it carries diagnostics, not logs.

**Variant B, a hosted form. M.** Name, email, description and attachments, posted to an endpoint
that sends the mail. It looks better, it captures attachments, and it costs the following.

1. **The Resend key cannot live in the extension.** A published extension is a public archive:
   anyone can unzip the CRX and read a key out of it, and then send mail as palworks.ai. This is
   already a standing decision in this document. The key belongs in a Cloudflare Worker secret,
   with the extension posting to the Worker.
2. **An unauthenticated send endpoint is a spam cannon.** It needs a rate limit keyed on IP (KV or
   a Durable Object), a body-size cap, and an attachment cap. Turnstile would be the obvious abuse
   control and it needs a third-party script, which means widening
   `content_security_policy.extension_pages` from `script-src 'self'`. Weakening the CSP to fight
   spam is a poor trade; prefer a Worker-side rate limit and no third-party script in the page.
3. **It breaks the central promise.** The listing, the README and the privacy policy all say there
   is no server and nothing is collected. A form that posts a name, an email address and
   attachments to infrastructure you run makes that untrue. The store's data disclosure would have
   to declare personally identifiable information and user communications, and that is material
   enough to expect a re-review.
4. **Retention.** The Worker should forward and forget. Anything it stores is a thing that can
   later leak, for no support benefit.
5. **Drop the phone number** in either variant. No support workflow here telephones anyone, it is
   the field most likely to stop someone submitting, and it is regulated personal data held for no
   purpose.

**Note on the local Resend CLI.** This machine has the Resend CLI authenticated for palworks.ai.
That is useful for sending mail *from here*; it is not a route to the extension sending mail. The
extension can never hold that credential, and there is no configuration in which it should.

**Variant A shipped, and B stays a separate decision taken on evidence.** If the mail that
arrives is still unusable, or the volume justifies a queue, build the Worker then, and write the
privacy policy change at the same time rather than after.

**What shipped.** [utils/support.ts](utils/support.ts) composes the subject and body and is free
of `chrome.*` and of the DOM, so what the mail says is tested rather than inspected (24 tests).
[components/options/SupportSection.tsx](components/options/SupportSection.tsx) renders a "Get
help" section on the settings page: a "Contact support" link, a "Copy diagnostics" button for
anyone on webmail or without a mail client, and a collapsed block showing exactly what the draft
contains. The body adapts to whether verbose logging is already on, so nobody is told to switch on
something that is on. Reasoning recorded as ADR-017, and the privacy policy now describes what the
draft carries.

Verified in the loaded extension: the section renders 560x220 with no horizontal overflow, the
composed URL is 877 characters against the 2000 cap, the subject reads "Support request: Favicon
Changer Ultimate 1.4.3 on Chrome 152", and the body carries the version, "Chrome 152", "Linux
x86_64", the full user agent and the rule count. Turning verbose logging on in the section below
flipped the draft to "already on" without a reload, and writing a rule moved "Rules saved" from 0
to 1, both through `storage.onChanged` rather than a poll. "Copy diagnostics" was clicked with real
input events and the clipboard was read back by pasting it into a scratch field: it holds exactly
the block shown on the page. The one step not driven is the click itself, because handing the URL
to the OS would have launched Thunderbird on the maintainer's desktop mid-session; the anchor is a
plain `mailto:` link and the URL is verified well formed.

### R-47 · Rating prompt after sustained use · **S** · ✅ done 2026-09-06
983 users and 7 ratings at the time, 1,000 and 8 now. Asking is reasonable; how you ask decides
whether it helps.

- **The trigger is successful use, not opens.** Count rules actually applied, and require both a
  count (10 or so) and elapsed time since install (3 days or so), so it reaches settled users
  rather than someone still deciding.
- **Ask once.** Persist the state in `chrome.storage.local`: asked, dismissed, or done. A
  dismissal is permanent. Nothing about this product justifies asking twice.
- **Never gate on sentiment.** "Enjoying it? yes goes to the store, no goes to a feedback form" is
  review gating, it is against store policy, and it is the reason store ratings are distrusted.
  One ask, one link to
  `https://chromewebstore.google.com/detail/<extension-id>/reviews`, one "no thanks" that sticks.
- **An inline banner, not a modal.** The popup is a 400px working surface; a dialog across it to
  ask for a favour is the wrong trade.
- **It pairs with R-46.** The people most likely to leave one star are the ones who hit a bug and
  had nowhere to go, so the support path is worth shipping first or alongside.

No privacy consequence: the counter is local, and the link is a normal navigation the user
chooses to make.

**Shipped as described.** `utils/rating.ts` holds the decision, free of `chrome.*` so it is
testable (18 tests); `components/RatingPrompt.tsx` renders an inline strip on the settings page
and above the popup editor, and never in the expanded upload window, where interrupting a file
upload to ask a favour would be rude. The threshold is four days on which a rule was actually
applied, counted by the content script on the storage read `applyRule` already makes, at most one
write a day, and not at all once the user has answered. The global fallback favicon deliberately
does not count, since it applies to every unmatched page and would count days the user did
nothing. Reasoning recorded as ADR-015 and the counter described in the privacy policy.

Verified in the loaded extension: the strip renders 1152x54 on the settings page and 400x47 above
the popup editor, leaving the editor its full 553px with no clipping and no horizontal overflow;
"No thanks" writes `dismissed` and the strip stays gone across a reload; the counter reached
`{activeDays: 1, lastActiveDay: "2026-09-06"}` on a real rule application and did not move on a
second page load the same day. The review link returns 200 and resolves to the listing's reviews
tab.

---

## Tier 5: reach (each is a project, not a task)

### R-22 · Internationalisation · **M**, not L · **paused** · *planned 2026-09-07, paused the same day (ADR-018)*
English only for now, by decision. The plan below stands and is what to pick up when this restarts.
Sized rather than guessed: **about 114 user-facing strings** across the UI, concentrated in six
files (BadgeSection 16, RulesList 15, FaviconEditor 14, UploadSection 14, GlobalSettings 9,
EditorHeader 9). That is a week's work, not a month's, which is why this moves from L to M.

Separately, `constants.ts` holds **693 emoji search keywords**. Those are the bulk of the strings
in the repo and a different question, below.

**Mechanism.** `_locales/<lang>/messages.json` plus `chrome.i18n.getMessage`, which is native,
dependency-free, works in every context including the content script, and is what the store reads
for a translated listing. Two limits matter here: it follows the browser UI language with no
in-product language picker, and it has no plural forms, so "Matches 1 of your 3 open tabs" needs
either separate singular and plural messages or the `n === 1 ? '' : 's'` the code already does,
repeated per language.

Wrap it in a `t()` helper in `utils/i18n.ts` that falls back to the English catalogue when
`chrome.i18n` is absent, because `npm run dev` runs without any chrome APIs (`IS_DEV`) and the UI
would otherwise render bare message keys. Import `_locales/en/messages.json` directly so there is
one source of truth rather than a second English copy to drift.

**Decision 1: which languages.** The Chrome Web Store dashboard breaks installs down by country;
that list should choose, not a guess. Note that "published in all countries" is the *availability*
setting and says nothing about who installed it. The real constraint is verification: a
mistranslated technical UI ("prefix", "regex", "matcher") is worse than English, and machine
translation cannot be spot-checked in a language nobody on the project reads.

**What comparable extensions carry**, counted from their repositories on 2026-09-07:

| Extension | Locales in `_locales` |
|---|---|
| uBlock Origin | 71 |
| Bitwarden | 63 |
| Dark Reader | 43 |
| Privacy Badger | 29 |

Table name: **r22-market-comparison**

Those counts are the wrong thing to imitate, and the reason is who wrote them. Privacy Badger
carries a Transifex configuration in its repository, and projects at that scale generally take
translations from volunteers or a translation platform rather than from the maintainer.
[Unverified] for the other three specifically. A single publisher shipping 60 machine-translated
locales is shipping 60 unverifiable surfaces, in a UI whose load-bearing words are "prefix",
"regex" and "matcher".

Also note that "top ten countries by internet users" is the wrong proxy if the dashboard number is
missing. What decides which catalogue a user sees is their **browser UI language**, not their
country, and the two diverge hardest exactly where the population numbers are largest: China is
barely a Chrome Web Store market at all, and a large share of Indian Chrome users run an English
UI.

**Recommended, in this order.** Extract to `en` and ship that alone, which is the whole refactor
and turns every later language into a data file. Then translate the **store listing** before the
UI, because it is what a prospective user reads before they install anything and it is done in the
dashboard rather than in the repository. Then add UI languages two or three at a time, each with a
reader who can check the twenty load-bearing strings, starting from the dashboard's install
breakdown.

**Decision 2: the 693 emoji keywords.** They exist so emoji search works. Either leave them English
and accept that search does not work in other languages (S, honest, and search is a convenience),
or generate catalogues from the CLDR emoji annotations, a maintained public dataset covering around
90 languages (M, and it adds a build step plus a data file per language). Recommended: leave them
English in the first pass and say so in the copy, then consider CLDR once the interface itself is
translated.

**Codebase specifics.**

| Thing | Why it needs care |
|---|---|
| `SCOPES` in `utils/ruleScope.ts` | The largest copy block outside components, already flagged there as the first thing to move behind the catalogue |
| `describeImport()` in `utils/importRules.ts` | Builds sentences from parts; needs placeholders, not concatenation |
| `role="status"` messages | Announced to screen readers, so an untranslated one is worse than silence |
| Dates in `RulesList` | Already localised via `toLocaleDateString()`; leave alone |
| RTL (Arabic, Hebrew) | Needs `dir` handling and Tailwind logical properties (`ps-`/`pe-` rather than `pl-`/`pr-`). Its own piece of work: exclude from the first pass or commit to it explicitly |
| The store listing | Translated in the dashboard, not the repo. Easy to forget, and it is what a prospective user actually reads |

Table name: **r22-specifics**

**Sequence.** Extract to `en` first and ship that alone. It is the whole refactor, it is verifiable
because the UI must look identical afterwards, and it turns every later language into a data file.

### R-23 · Firefox and Edge · **S for Edge, M for Firefox** · **paused** · *planned 2026-09-07, paused the same day (ADR-018)*
Chrome Web Store only for now, by decision. The submissions are written up step by step in
[docs/PUBLISHING.md](docs/PUBLISHING.md) and stay ready; what follows is what was measured.
This was written as "Edge likely near-free; Firefox needs a namespace shim". Firefox 154 was then
actually installed and driven, and **the shim assumption was wrong**. What follows is measured.

**Edge.** Chromium, so the same MV3 package. The work is a Partner Center submission and a second
listing to keep in step, not code. Do it separately and first: a day of paperwork for a second
distribution channel.

**Step by step for both stores, with the listing copy drafted and every requirement read off the
vendor's own docs on 2026-09-07: [docs/PUBLISHING.md](docs/PUBLISHING.md).** Registration for the
Edge program is free, an individual account verifies in hours where a company account can take
weeks, and certification runs up to seven business days. Nothing technical blocks an Edge
submission now that the screenshots exist (R-39); what it costs is a second listing to keep in
step, which is why it stays paused.

**Firefox 154, verified.** The built `dist/` was installed as a temporary add-on over WebDriver
BiDi and exercised end to end.

| Question | Result |
|---|---|
| Does the package install? | Only after the two manifest changes below. `invalid web extension` before them |
| Does the background script run? | Yes. `onInstalled` fired and opened the options page |
| Does the options page render? | Yes, including the four-way scope selector |
| Do the `chrome.*` APIs exist? | **All of them.** `storage.local`, `storage.sync`, `tabs.query`, `scripting.executeScript`, `action.setPopup`, `extension.isAllowedFileSchemeAccess`, `runtime.getManifest`, `i18n.getMessage`. No polyfill, no shim, no `browser.*` rewrite |
| Does the content script run and answer `RulesUpdated`? | Yes, on http pages |
| Does ADR-001 hold, i.e. does mutating the tracked link's href repaint a **background** tab? | **Yes.** Verified twice: with a plain URL (red to blue while backgrounded) and end to end through the extension |
| Do `data:` URL favicons render? | Yes. Every icon this extension makes is a data URL, so this was the make-or-break question |

Table name: **r23-firefox-verified**

**The two manifest changes.** Firefox MV3 has no `background.service_worker`, and an add-on needs
an id:

```json
"background": { "scripts": ["background.js"], "type": "module" },
"browser_specific_settings": { "gecko": { "id": "favicon-changer-ultimate@palworks.ai", "strict_min_version": "128.0" } }
```

That belongs in the build as a target flag in `vite.config.ts`, not as a second manifest file to
keep in sync by hand.

**Still unknown, and stated as such.** None of these were tested, and each must be before shipping:

- ~~**Host permissions.**~~ **Resolved 2026-09-07 from Mozilla's own documentation, not by
  reasoning.** The MV3 migration guide states that Firefox 127 and later show the host permissions
  from `host_permissions` and `content_scripts` in the install prompt and **grant them on
  installation**; a user can still revoke one ad hoc afterwards. So there is no per-site onboarding
  flow to build. What remains is that the extension should behave sanely on a host whose permission
  was revoked, where the content script does not run and the icon does not change. A line of copy,
  not a project.
- **A source-code submission is required.** AMO requires source when a package contains minified
  code, and Vite minifies everything in `dist/`. That means a source archive plus reproducible
  build instructions with every submission. Newly found, and the one thing that makes the Firefox
  submission heavier than the Edge one.
- **AMO makes you choose a licence**, and this repository has no `LICENSE` file. See
  [docs/PUBLISHING.md](docs/PUBLISHING.md) §3.4 for the options and a recommendation.
- **AMO review and signing**, and what `strict_min_version` to actually claim.
- **ADR-007**, the Linux file-dialog workaround. Firefox panel blur behaviour differs, so the
  `setPopup('')` trick may be unnecessary or may misbehave.
- **Canvas emoji rendering.** A different font stack, so glyphs will not match Chrome and may clip.
- **Popup sizing.** Firefox sizes the panel differently from Chrome's bubble.

**Revised estimate.** Firefox is a week, dominated by the permission model and store review rather
than by code. The `browser`-versus-`chrome` work that made this look like a project does not exist.

### R-24 · Cross-device sync · **L** · **paused** · *planned 2026-09-07, privacy trade decided, then paused (ADR-018)*
Deferred to revisit later, by decision. Both the design and the privacy trade are settled below,
so restarting is implementation rather than deliberation.
Not a storage-area swap, and the reason is arithmetic. `chrome.storage.sync` is documented at
roughly 100 KB total, **8 KB per item**, 512 items, and write quotas around 1800 an hour and 120 a
minute (verify against current docs before building). A 128x128 PNG data URL is 12 to 25 KB, so a
single rule's icon exceeds the per-item limit and four of them would exceed the whole quota. Icons
cannot go through `storage.sync`, full stop.

**The design that works: sync what is reproducible, not what is rendered.** Most icons this
extension makes are a *function* of stored metadata, not irreplaceable bytes:

| Source type | Icon reproducible on another device? | Syncs |
|---|---|---|
| `emoji` | Yes, from `metadata.emojiChar` | Fully |
| `url` | Yes, it is a remote address | Fully |
| `custom` (badge or overlay) | Yes, from the badge config plus the site's own favicon | Fully, though the base icon is refetched so it can differ |
| `upload` | **No.** The bytes are the only copy | Rule syncs, image does not |

Table name: **r24-syncability**

So sync the rule minus `faviconUrl`, and re-render on arrival. A rule then costs a few hundred
bytes instead of 25 KB, which fits several hundred rules inside the quota. Uploaded images stay on
the device that made them, and the rule arrives flagged so the UI can say "image not synced,
re-upload on this device" rather than showing a broken icon. That is honest and needs no server.

**The decision, and it is not a technical one.** Turning this on uploads the user's rule list to
their Google account, and a rule list is a list of sites they care about. Today the product's whole
claim is that nothing leaves the device. So: **off by default, opt-in, with copy that says plainly
what leaves and where it goes**, and a matching paragraph in the privacy policy and the store's
data disclosure. Shipping it on by default would be a breach of the promise the listing makes,
whatever the code does.

**Decided 2026-09-07: opt-in, off by default, policy changed in the same release.** So the
switch, its copy, the privacy policy paragraph and the store data disclosure are part of the work,
not a follow-up, and no build ships the storage change with the switch missing.

**The hard parts, in order of how much they will hurt.**

1. **Deletions.** Without tombstones, a rule deleted on device A comes back from device B on the
   next merge, for ever. Either store `deletedAt` markers with a TTL and reap them, or accept in
   v1 that deletes do not propagate and say so. Tombstones are the right answer and the fiddliest
   part of the work.
2. **The first merge.** Existing users have local rules on several devices already. The first sync
   must union them by `updatedAt`, never overwrite, and never delete. Get this wrong once and it
   is someone's whole configuration.
3. **Conflicts.** Last write wins on `updatedAt`, which every rule already carries since R-26.
   Good enough for a favicon rule; no need for anything cleverer.
4. **Write quotas.** 120 writes a minute is easy to blow. Saves already commit on blur rather than
   per keystroke (R-05), and bulk operations already batch (R-09, `deleteRules`), so the shape is
   right, but a 200-rule import must be one write and not two hundred.
5. **Storage-area plumbing.** `utils/storage.ts` assumes `chrome.storage.local` throughout. This
   needs a deliberate split between "local, the source of truth for icons" and "sync, the source
   of truth for rule metadata", not a find and replace.

**Cheaper alternative worth naming.** Export and import already exist and already move rules
between devices, manually. If the goal is "I set up a new laptop", that covers it today for zero
work and zero privacy change. Sync is worth building only if the goal is continuous.

### R-17 · Publish a security contact · **S** · ✅ done 2026-09-06
support@palworks.ai, published in [docs/SECURITY.md](docs/SECURITY.md) and in the privacy policy,
with the reporting expectations written down: private report first, extension version and browser
build, acknowledgement within three working days, no bug bounty. The store review queue is still
the floor on how fast a fix can reach installed copies, which the section says plainly.

### R-61 · "Favicon updated successfully!" was claimed, never verified · **M** · ✅ done 2026-09-07
The message was printed the moment `chrome.storage.local.set` resolved. That proves the rule was
stored and nothing else. `saveRule` called `notifyTabs()` **without awaiting it**, `notifyTabs`
called `sendMessageToTab` which returns `Promise<void>`, and `sendMessageToTab` awaited the
content script's reply and **discarded** it. The content script did reply `{ok: true}`. The honest
answer was one message hop away and was being thrown on the floor.

Four cases ended with a green tick and no visible change:

1. **An excluded site.** The worst of the four and a defect rather than a limitation: no reload
   ever helps, and the rule sits in the rules list while the site sits in the excluded list, on a
   different page. Nothing anywhere warned.
2. **A pasted image address that does not load.** Checked for shape, never for existence.
3. **A tab with no live content script**, which is every tab open across an extension update.
4. **A rule shadowed by a more specific one.** The pre-save conflict banner covers most of this,
   but it is advisory and the user can save over it.

**What was built.** The reply now carries an `ApplyReport` (`applied` / `fallback` / `excluded` /
`none` / `unavailable`, plus the winning rule's id and whether the DOM write happened), the editor
asks the one tab the rule targets and reads it, and `describeSaveOutcome` turns that into the line
the user sees. The branching that decides what to do moved out of `content.ts` into
`decideApply()`, so the action taken and the status reported come from **one** decision rather
than two copies that can disagree. An excluded site's warning carries a "Remove from excluded"
button, and pressing it re-checks rather than declaring victory. Design and consequences in
[ADR-019](docs/DECISIONS.md).

**What it deliberately does not claim.** Nothing in an extension can see the tab strip repaint.
`chrome.tabs.faviconUrl` looks like the verifier and Chrome omits it whenever the tab icon is a
`data:` URL, which is the normal case here (proved while writing [TESTING.md](docs/TESTING.md)'s
signal table). So "updated" rests on "a rule matched and the write happened", and no more is
implied.

**Verification.** 64 new unit tests, and 25 hand-written mutations of the new logic, all 25 killed
(the two that survived a first pass were both unobservable code, which was then removed rather than
tested around: a redundant `data:` guard and a `settled` latch). Then 28 checks in a real Chrome
over the DevTools protocol, driving the actual editor: confirmed, not-open, excluded, the fix
button, shadowed, a dead `https:` address, a live one, and a discarded tab. Four of those are on
the popup surface rather than the settings page, because `mode` and `context` differ there and the
popup is where most saves happen. Every pre-existing
suite was re-run against the refactored `content.ts` and the new editor: the favicon write path
(9), signals (4), exclusion (8), options (8), editor (10), import (6), popup (12), export (5) and
surface health (5), all passing. Three of the four failures in the first live run were the
harness's, and are now in **testing-harness-traps**; the fourth was real and is below. L-36 was reproduced on purpose by swapping
`dist/content.js` for the one shipped in 1.4.3.

**One defect in this work, found only by running it.** The icon probe was written to run in the
editor page, and an extension page cannot load an insecure subresource under MV3, so probing an
`http:` address returned "broken" for a working image. It would have shipped a confident warning
about a working address, which is the exact failure this item exists to remove. `http:` is now not
probed at all and gets no claim either way. Recorded as [L-37](docs/LIMITATIONS.md); what could be
said instead became R-63, now done.

### R-62 · A long matcher filled the whole popup · **S** · ✅ done 2026-09-07
Reported from a live Facebook auth page with two screenshots. The conflict warning quoted the
winning rule's matcher inline, with `break-all`, so a rule made for a login or OAuth URL wrapped
to dozens of lines: the banner filled the entire 400px popup and pushed "Edit that rule instead" a
full screen below the fold. The warning stated the problem and hid the fix.

Measured in the product, at the popup's usable content width, with a matcher of the reported shape
and length (about 1,300 characters): **25 lines and 375px before, 1 line and 15px after**, with
the whole banner at 148px and the button on the first screen. The full value is still on hover
(`title`) and behind a "Show the full pattern" toggle, which expands to 403px only when asked, so
nothing is hidden. `shortenPattern()` is pure and tested, display only, and never used for
matching. The same 10 measurements also cover the toggle round trip.

Two smaller things went with it, since the markup was open: the warning triangle emoji became an
inline SVG (as the support section already did), and the sentence was reworded to stop putting an
article in front of a scope name, which rendered as "a Entire Domain rule".

### R-63 · Say something useful about an `http:` icon address · **S** · ✅ done 2026-09-09
Raised by R-61 and described as [L-37](docs/LIMITATIONS.md). Option (b) was chosen: a distinct
message at save time rather than a probe result. Option (c), refusing `http:` outright, stays
rejected because it would break existing rules and existing exports for a case that genuinely
works on an intranet.

**The fact this waited on, now measured** in Chrome 152 on 2026-09-09 against a server that speaks
only http, watching the server's own log rather than trusting the documentation:

- On an **http** page the icon is fetched (`GET /icon-v2.png 200`) and the tab strip repaints with
  that address as its favicon.
- On an **https** page **no request reaches the server at all**. Chrome logs "Mixed Content: ...
  This request was automatically upgraded to HTTPS" and the upgraded request fails, so the tab
  silently keeps its old icon. The content script has still written the `href` and still reports
  `applied` with `painted: true`, because from the page's side nothing failed.

**What shipped.** `describeSaveOutcome` gained an `insecure-icon` outcome for the one combination
that is definitely wrong, an http address saved for a page that was checked and is https:

> Rule saved, but that image address starts with http and example.com is a secure page, so the
> browser will not load it. Use an https address, or upload the image.

Anything more actionable still wins: excluded, shadowed, unmatched, fallback, not-painted and a
failed probe all keep their own message, because a scheme note on top of those would bury the real
problem. Where the outcome is otherwise fine, the confirmation and the no-tab-open message carry
one appended sentence instead of a warning, since on an http page the address does work.

`isInsecureIconUrl` parses the scheme rather than searching the string, so `https://x/http://y`
is not mistaken for insecure. `findTabForRule` now returns one extra bit, `secure`, rather than the
tab's address, because that is all the caller needs. Eight new unit tests, and the message was
confirmed end to end in a real browser against a live https page with an http icon, alongside an
https control that still reads "Favicon updated successfully!".

### R-64 · An exact-URL rule could be saved as text no page can produce · **S** · ✅ done 2026-09-07
Found by reading `matcherFor` against what `exact_url` actually compares. The matcher goes into a
`===` against `location.href`, and on the settings page the target is free text that was stored
verbatim. So "This Page Only" plus `example.com` saved the matcher `example.com`: a string no
address bar can ever produce. The rule appeared in the list, looked right, and matched nothing.
`HTTPS://Example.com/Page` did the same, since a real visit lowercases the scheme and host.

Reproduced in the browser before the fix, and the save even reported "It will apply the next time
you open a matching page", which was true only in the sense that the day would never come.

`canonicalUrl()` now normalises the text through the URL parser (`example.com` becomes
`https://example.com/`) and returns '' for anything that cannot be an address, which routes into
the same "tell the user" path the domain scope has used since R-49. The hostname shape is checked
for the R-49 reason: Chrome percent-encodes illegal host characters rather than throwing, so
"not a url at all" would otherwise have canonicalised into a tidy matcher that still matched
nothing. `file:` is exempt, since a file URL has no host and the extension supports file pages.
In the popup it is a no-op: the target there is `tab.url`, already canonical. 11 new tests.

### R-65 · Two storage writes at once lost one of them · **M** · ✅ done 2026-09-07
The most serious finding of the audit, and the only one whose symptom is a rule the user is sure
they created simply not existing.

`chrome.storage` has no transactions and every mutation was a read-modify-write of a whole map,
unserialised. Two at once means the second read happens before the first write, so the first
change is gone. **Reproduced in a real browser**: two saves started together, one rule left where
there should have been two.

Three ways to reach it, all real:

- **Two quick clicks in the editor.** Picking an emoji IS the save; there is no Apply button to
  disable, so two clicks start two saves. Depending on the interleaving, either one rule vanished
  or two rules existed for one matcher, and `findBestRule` breaks an exact tie by keeping the
  **earlier** rule, so the user's second choice lost silently.
- **The popup and the settings page open together**, which the product supports.
- **Writes carrying keys nobody changed.** `persistData` wrote `rules` *and* `settings` on every
  mutation, from whatever it had read a moment earlier, so saving a rule could revert a
  concurrent settings change and saving a setting could revert a rule. No race between two rule
  writes was needed for that one at all.

Fixed in three parts, all in [utils/storage.ts](utils/storage.ts): a per-context queue every
mutation passes through, single-key writes, and `(matchType, matcher)` treated as a rule's
identity so a save over an existing pair collapses it (keeping the newer icon, the earlier
`createdAt`, and repairing duplicates already in storage). The emoji grid and the "paste image
URL" button are now disabled while a save is in flight, which stops the trigger as well as the
consequence. What is left, two *different* contexts inside the same few milliseconds, cannot be
fixed without a lock the API does not offer; it is L-38, with the two honest options written out.
Decision recorded as [ADR-020](docs/DECISIONS.md). 15 new tests, including one that asserts ten
simultaneous saves all survive, over a deliberately deferred storage stub, since a synchronous
one passes on the broken code.

### R-66 · A busy page was reported as unconfirmed · **S** · ✅ done 2026-09-07
A consequence of R-61 found by testing R-61's own weak point. A page whose main thread is blocked
cannot run its message handler, so it cannot answer the confirmation request inside the budget,
and the save was reported as "did not confirm the change. Reload it to see the new icon." while
the page went on to apply the rule the moment it was free. Measured with a deliberate 3s busy
loop: unconfirmed, then the icon changed anyway.

Raising the budget was the wrong lever: every genuinely dead tab would then make the user wait.
Instead the first answer is shown at once, and if the tab said nothing, it is asked **once** more
on a longer budget with nobody waiting on it; if that answers, the banner is corrected. Verified
end to end: the two messages appear in order, "did not confirm" and then "Favicon updated
successfully!". A run counter makes sure a late answer can never overwrite the result of a save
the user made after it.

### R-67 · The badge preview could be overtaken by an older fetch · **S** · ✅ done 2026-09-07
Found by looking for effects that set state after an `await` with no cancellation. The badge and
overlay preview fetches the page's own favicon, and its effect re-runs on every change to the
mode, colour, opacity, text and position. Nothing ordered the responses, so on a slow link an
older fetch could finish last and leave the preview showing a setting the controls no longer
show. Apply saves `previewUrl` and reads the metadata from current state, so the icon and the
metadata stored on the rule could disagree, and re-opening the rule would show controls that did
not describe its icon.

A `superseded` flag set by the effect's cleanup now discards a response whose settings are no
longer current. Found by reading rather than by reproducing: the fetch is normally cached and
instant, so a reproduction needs both a slow link and a fast hand.

---

## Deliberately not doing

- **Analytics of any kind.** The privacy position is the product's differentiation.
- **`www` normalisation in domain matching** (L-05). Silent host rewriting is worse than the
  documented asymmetry.
- **Refactoring `updateFavicon` into remove-and-append.** Breaks background tabs; see ADR-001.
- **Unconditional `<head>` reconciliation.** Broke SPAs; see ADR-002.
- **A `define` block that inlines any secret.** An extension cannot keep a secret; see
  [docs/SECURITY.md](docs/SECURITY.md).

---

## Suggested sequence

1. ~~**R-00** (React types) then **R-13** (checks)~~ ✅ both done 2026-09-02. Every item below is
   now type-checked and gated on push.
2. **v1.4.0**: R-03 → R-04 + R-01 → R-02 → R-07 → R-12. Ship, then reply to Dylan Chang's review.
3. **v1.4.1**: the Tier 2 bug batch, R-05, R-06, R-08, R-11, R-10, R-25.
4. **v1.5.0**: R-33 and R-27 (the two cheapest support-load reducers), plus R-14 and R-18.
5. Re-plan Tier 4 and 5 against store reviews after v1.5.0.
