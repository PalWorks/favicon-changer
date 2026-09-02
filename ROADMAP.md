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
**pending** agreed but not started · **standing** a decision already taken, no action unless it
changes.

### Done (2026-09-02)

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

Table name: **roadmap-done**

### Next up

| ID | Item | Effort | Status | Why now |
|---|---|---|---|---|
| R-35 | Conflict detector, same-tier shadowing | S | **pending** | Partly done: the detector now spans all tiers, but same-tier is still uncovered |
| R-33 | Per-rule enable/disable | S | **pending** | Cheapest support-load reducer left; today you must delete a rule to test it |
| R-27 | Storage-usage meter | S | **pending** | "Storage full" still arrives with no warning |

Table name: **roadmap-next**

**v1.4.0 is code-complete and ready to package.** It contains prefix matching, a regex UI,
specificity-based precedence, hardened import, correctly sized store assets, a third smaller
package, and the Tier 2 bug batch. The one thing standing between it and the store is the manual
browser pass in [docs/TESTING.md](docs/TESTING.md), which cannot be automated (ADR-012 note).

### Pending

| ID | Item | Tier | Effort | Note |
|---|---|---|---|---|
| R-25 | Global fallback applies to every unmatched page | 2 | S | Copy says "if a site has no favicon"; it does not mean that |
| R-09 | `notifyTabs` fans out to every tab | 2 | M | One save pings every open tab, discarded ones included |
| R-20 | Log-write races | 2 | S | Read-modify-write per line loses entries when it matters most |
| R-14 | Test gaps | 3 | M | `validation`, the migration latch, `normalizeImageDataUrl`, `isRestrictedUrl`, a jsdom lock on ADR-001 |
| R-15 | Extract the editor's logic into a hook | 3 | M | ~520 lines and a `mode` × `context` matrix; R-01/R-02 add more |
| R-16 | Dependency hygiene | 3 | S | `npm audit` in the hook, Dependabot |
| R-32 | Rules list does not scale | 4 | M | No search, sort, filter or bulk delete |
| R-30 | Accessibility pass | 4 | S | Icon-only buttons lack `aria-label`; the logging switch lacks a label |
| R-21 | Emoji rendered at 64px | 4 | S | Everything else is 128px |
| R-22 | Internationalisation | 5 | L | No `_locales`; every string inline |
| R-23 | Firefox and Edge | 5 | L | Edge likely near-free; Firefox needs a namespace shim |
| R-24 | Cross-device sync | 5 | L | Not a storage-area swap: `storage.sync` cannot hold a PNG data URL |
| R-17 | Security contact | 5 | S | No inbound vulnerability channel |
| R-36 | Icon artwork fills 122x122 of its 128x128 canvas | 4 | S | Chrome suggests ~96x96 so icons look consistent side by side. A branding call, not a rejection risk |

Table name: **roadmap-pending**

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
| Version | 1.3.0 (manifest and `package.json` now aligned) |
| Store ID | `egedbdckafdbomehjaihjhbcgmngmlah` |
| Users | 983 |
| Rating | 4.4 ★ from 7 ratings |
| Category | Developer Tools |
| Tests | 20, one file, matcher only |
| `tsc --noEmit` | clean |
| Pre-push gate | typecheck + tests + build via `.githooks/pre-push` (no CI workflow, ADR-012) |
| CI | none |

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

### R-09 · Narrow the `notifyTabs` fan-out · **M**
One rule save pings every open tab and injects where silent (L-14). Skip discarded tabs, and
message only tabs whose URL could be affected by the changed rule, the matcher is already
available to decide that.

### R-10 · One OS-detection source of truth · **S** · ✅ done 2026-09-02
`getPlatformInfo()` versus a UA regex, in two files, able to disagree (L-15). Resolve once in the
service worker, store the verdict, and have the UI read it.

### R-25 · Make the global fallback mean what it says · **S**
Either restrict `defaultFaviconUrl` to pages that genuinely have no icon of their own (matching
the settings copy), or rewrite the copy to "apply to all sites without a rule" and add a
confirmation. The current mismatch reads as the extension going rogue (L-06).

### R-20 · Fix log-write races · **S**
Batch or queue the `debug_logs` read-modify-write (L-16). Lost lines are worst exactly when the
log matters.

---

### R-35 · Widen the conflict detector to same-tier shadowing · **S** · *new, from R-04*
Now that a longer domain matcher beats a shorter one, a domain rule can be shadowed by another
domain rule, which `findConflictingRule` does not detect: it still only looks for an `exact_url`
or `regex` rule shadowing a domain-scoped edit. Scoring the rule being edited against every
other rule would cover every shadowing case with one code path, and would let the banner name
the winner instead of describing its type.

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

### R-14 · Close the test gaps · **M**
In value order: `utils/validation.ts`; the storage migration latch; `normalizeImageDataUrl`;
`isRestrictedUrl`; then a jsdom test asserting `updateFavicon` mutates the **same element
instance**, which would lock ADR-001 into the suite where it belongs. See
[docs/TESTING.md](docs/TESTING.md).

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

### R-15 · Extract the editor's logic into a hook · **M**
[FaviconEditor.tsx](components/FaviconEditor.tsx) is ~520 lines with a `mode` × `context` matrix
and effects that must not fire in the wrong combination (ADR-010). R-01 and R-02 both add state
to it. Extract `useFaviconRuleEditor()` **before** Tier 1 if it can be done cheaply, or
immediately after, not in the middle.

### R-29 · Clean the build config · **S** · ✅ done 2026-09-02
Remove the unused `loadEnv`/`env` and the empty `define: {}` in `vite.config.ts` (L-28).

### R-16 · Dependency hygiene · **S**
Add `npm audit --production` to CI and enable Dependabot. Two runtime dependencies makes this
cheap to keep green (threat 5).

### R-26 · Add `updatedAt`, stop overwriting `createdAt` · **S** · ✅ done 2026-09-02
The rules list's "Created" column is really last-modified (L-10).

---

## Tier 4: product depth

### R-27 · Storage-usage meter · **S**
Show used/available in settings, with a warning band, so "Storage full" is never a surprise
(L-12). `chrome.storage.local.getBytesInUse()` already exists.

### R-33 · Per-rule enable/disable toggle · **S**
Today the only way to test whether a rule is the culprit is to delete it (L-11). A boolean on the
rule plus a switch in the list. Also the cheapest possible support tool.

### R-32 · Make the rules list scale · **M**
Search, sort by matcher or date, filter by match type, bulk delete (L-11).

### R-30 · Accessibility pass · **S**
Icon-only buttons carry `title` but no `aria-label`; the verbose-logging switch has no label
association. Keyboard traversal of the emoji grid is untested.

### R-21 · Render emoji at 128px · **S**
Emoji use a 64×64 canvas at 54px serif while every other source is 128×128, inconsistent
sharpness on high-DPI, and tall glyphs can clip.

### R-28 · Optimise the shipped logo · **S**
`icons/FaviconChangerLogo.png` is 497×502 and 231 KB, about 40% of the package, for a 32px
render (L-27).

### R-34 · Reconsider the options-page Google lookup · **S** · *decided for now*
ADR-011 keeps the `google.com/s2/favicons` preview and discloses it. If the zero-third-party
claim later matters more than the preview, the options are: drop the preview, or fetch
`https://<domain>/favicon.ico` directly (which leaks the domain to that site instead and fails on
many sites). No action unless that priority changes.

---

## Tier 5: reach (each is a project, not a task)

### R-22 · Internationalisation · **L**
`_locales` + `chrome.i18n`, every string currently inline in TSX (L-21). The store listing needs
translating too. Highest-volume languages first.

### R-23 · Firefox and Edge · **L**
Edge is likely near-free. Firefox needs the `browser` namespace, a background-script shim and a
second manifest (L-20). Worth scoping only after Tier 1 and 2 land, because it doubles the manual
test matrix in [docs/TESTING.md](docs/TESTING.md).

### R-24 · Cross-device sync · **L**
Not a storage-area swap: `storage.sync`'s ~8 KB per-item limit cannot hold a PNG data URL
(ADR-004, L-22). Requires either syncing rules while keeping icons local, or an icon store that
is not inline data URLs. Design before estimating.

### R-17 · Publish a security contact · **S**
No inbound vulnerability channel exists beyond the store support page
([docs/SECURITY.md](docs/SECURITY.md)).

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
