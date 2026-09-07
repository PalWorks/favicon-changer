# Domain Model

The business logic of this extension is small and almost entirely about one question:
**given a page, which favicon should it show?** Everything else is UI around that question.

---

## 1. Entities

### FaviconRule

Defined in [types.ts](../types.ts). One row of user intent: "on pages matching X, show icon Y".

| Field | Meaning | Notes |
|---|---|---|
| `id` | Storage key | `Date.now().toString(36) + Math.random()...`, not a real UUID |
| `matcher` | The pattern text | A hostname, a full URL, or a regex source string, per `matchType` |
| `matchType` | `'domain' \| 'exact_url' \| 'regex'` | Decides how `matcher` is interpreted **and** the rule's precedence |
| `faviconUrl` | What to display | Normally a `data:image/png;base64,…`; may be a remote `http(s)` URL |
| `originalUrl` | The site's own icon before editing | Kept so Badge/Overlay can re-composite from the clean source instead of stacking badges on badges |
| `sourceType` | `'emoji' \| 'upload' \| 'url' \| 'custom'` | Which editor section produced it; drives which accordion auto-opens on edit |
| `metadata` | Editor state to rehydrate | Emoji char, badge text/colours/position, overlay colour/opacity, image fit mode |
| `createdAt` | `Date.now()` | First save. Preserved across later edits |
| `updatedAt?` | `Date.now()` | Last save. Absent on rules written before this field existed |
| `enabled?` | `boolean` | Absent or `true` means active. An explicit `false` pauses the rule: it stops matching and stops being reported as a conflict, but keeps its icon and settings. Optional so no migration was needed, and so "enabled" is the default |

Table name: **favicon-rule-fields**

`sourceType: 'custom'` means badge-or-overlay, not "custom image", a naming wart worth knowing
when reading [FaviconEditor.tsx](../components/FaviconEditor.tsx).

### GlobalSettings

| Field | Meaning |
|---|---|
| `defaultFaviconUrl?` | Fallback icon applied to **every** page that has no matching rule. Empty by default. |
| `excludedDomains[]` | Hostnames the extension must never touch, checked before any matching, and before any DOM access. |

Table name: **global-settings-fields**

`defaultFaviconUrl` is a blunt instrument: when set, it applies to every unmatched page, so it
overrides the entire web's favicons. It is not "use this when a site has no icon of its own"
despite what the settings copy implies. See [LIMITATIONS.md](LIMITATIONS.md).

---

## 2. Match types and precedence

`findBestRule(currentUrl, currentDomain, rules)` in [utils/matcher.ts](../utils/matcher.ts)
**scores every matching rule and returns the highest.** The score is the match type's tier rank
multiplied past any possible matcher length, plus the matcher length itself as a within-tier
tie-break. So a more specific *kind* of match always beats a less specific one, and within one
kind the longer (more specific) matcher wins. An exact tie keeps the earlier rule, which makes
the result stable and insertion-ordered.

| Tier rank | `matchType` | Compared against | Semantics |
|---|---|---|---|
| 4 (highest) | `exact_url` | `window.location.href` | Byte-exact string equality, query string and hash included |
| 3 | `prefix` | `window.location.href` | `url.startsWith(matcher)`. Anchored by construction; an empty matcher never matches |
| 2 | `regex` | `window.location.href` | `new RegExp(matcher).test(url)`, unanchored, no flags |
| 1 (lowest) | `domain` | `window.location.hostname` | `hostname === matcher \|\| hostname.endsWith('.' + matcher)` |

Table name: **match-precedence**

Consequences that surprise people:

- **`exact_url` really is exact.** `https://site.com/a` and `https://site.com/a?x=1` are
  different rules, and `https://site.com/` does not match `https://site.com`. `prefix` exists
  because of this: it is the way to cover one document across its views.
- **`prefix` outranks `regex` deliberately**, so a document-scoped rule cannot lose to a
  site-wide pattern. See [DECISIONS.md](DECISIONS.md) ADR-013, which also explains why `prefix`
  exists at all when regex can express the same thing.
- **`domain` covers subdomains downward only.** A rule for `google.com` matches
  `www.google.com` and `docs.google.com`. A rule for `www.google.com` does **not** match
  `google.com`. There is no `www` normalisation.
- **`regex` matches the whole URL, unanchored.** `google` as a pattern matches any URL containing
  the substring. Invalid patterns, and patterns over 2000 characters, are skipped with a warning
  rather than throwing.
- **Within one tier, the longer matcher wins.** With domain rules for both `google.com` and
  `docs.google.com`, the `docs.google.com` rule wins on a docs URL, and `google.com` still
  applies to every other subdomain. Until 2026-09-02 this was creation order instead, so the
  oldest rule won and users read the result as random.
- **Tier rank always dominates length.** The multiplier is larger than any allowed matcher
  (regex patterns are capped at 2000 characters, hostnames at 253), so a long matcher can never
  promote a rule out of its tier.
- **An unrecognised `matchType` never matches**, rather than throwing. Hand-edited or imported
  storage can contain one.

### Resolution order at runtime

```
excluded domain?         -> touch nothing, and undo our own work if we had already
                            applied a rule in this page's lifetime
highest scoring rule?    -> use it. Score is tier first, matcher length second:
                              exact_url (4) > prefix (3) > regex (2) > domain (1)
global defaultFaviconUrl set? -> use it
otherwise                -> restore the page's original icon if we had changed it, else nothing
```

The four tiers are not scanned in order; every matching rule is scored and the highest wins, so a
longer matcher beats a shorter one of the same type. See `utils/matcher.ts`, and §2 above.

### Conflict warning

Note this detector was **not** widened when scoring landed: it still only looks for an
`exact_url` or `regex` rule shadowing a domain-scoped edit, so it does not warn when a longer
domain rule shadows a shorter one. Tracked as ROADMAP R-35.

`findConflictingRule(targetUrl, currentScope, rules)` powers the orange "Rule Conflict Detected"
banner. It only fires in one direction: when the user is editing a **domain**-scoped rule while
an `exact_url` or `regex` rule already matches the same page, i.e. when the rule being edited
will be shadowed by a higher tier. Editing an `exact_url` rule needs no warning because nothing
outranks it.

---

## 3. Icon sources

All four sources converge on the same output: a PNG `data:` URL stored in `faviconUrl`.

| Source | Produced by | Canvas size | Stored as |
|---|---|---|---|
| Emoji | [EmojiSection](../components/editor/EmojiSection.tsx), `fillText` at 84% of the canvas | 128×128 | `data:image/png` |
| Upload | [UploadSection](../components/editor/UploadSection.tsx), fit/fill/stretch, then `compressFaviconDataUrl` | 128×128 | `data:image/png` |
| Image URL | UploadSection URL field | none | the remote URL, verbatim |
| Badge / Overlay | [BadgeSection](../components/editor/BadgeSection.tsx), composited over the live site icon | 128×128 | `data:image/png` |

Table name: **icon-sources**

The **image URL** source is the one exception to local-only operation: the URL is stored as-is
and re-fetched from its origin every time the rule applies. Import flags how many incoming rules
do this (`remoteCount`) so a shared rules file cannot quietly add third-party requests.

**Fit modes** (upload only): `contain` pads to preserve aspect ratio, `cover` crops to fill,
`stretch` distorts to the square. `contain` is the default because favicons are viewed at 16px
where letterboxing reads better than a crop.

**MIME repair**: `normalizeImageDataUrl()` in [utils/canvas.ts](../utils/canvas.ts) sniffs the
decoded bytes of a `data:` URL and relabels it `image/svg+xml` when the payload is really SVG
markup. This exists because sites like GitHub serve an SVG favicon; downloading it lands a
`.png` filename, and re-uploading it produced `data:image/png;base64,<svg bytes>`, which no
browser can decode. Repair runs once up front and again as a retry on image load failure.

---

## 4. Vocabulary

| Term | Means |
|---|---|
| **Rule** | One `FaviconRule`. A user-visible row in the options list. |
| **Matcher** | The pattern text of a rule. Not a function, the string. |
| **Scope** | The editor's word for `matchType`, exposed as four buttons: "Entire Domain" (`domain`), "This Page Only" (`exact_url`), "URL Starts With" (`prefix`) and "Regex" (`regex`). |
| **Pattern** | The matcher for the two scopes the user types by hand, `prefix` and `regex`, as opposed to the two derived from the target page. |
| **Suggestion** | The prefilled pattern built from the current URL by `utils/patterns.ts`: query and fragment dropped, then the last path segment when there are at least two. |
| **Target / target page** | The page a rule is being written for; in the popup, the active tab. |
| **Active rule** | The rule matching the current target at the current scope, drives the Active/Inactive pill. |
| **Conflict** | A higher-precedence rule that will shadow the rule being edited. |
| **Original favicon** | The page's own icon, captured before first mutation, restored when a rule is deleted. |
| **Exclusion** | A hostname on `excludedDomains`. Stronger than any rule. |
| **Paused** | A rule with `enabled: false`. Invisible to matching, still listed and editable. |
| **Hand-off** | Passing the edit target from the popup to the standalone window via `pendingEditorTarget`. |
| **Change mark** | The `data-fc-modified` attribute marking the `<link>` we own. It is how we find our own link again and which links to remove on restore. It is **not** how the observer tells our writes from the page's; that is a value comparison (ADR-014). |

Table name: **glossary**

---

## 5. Invariants

Things that must stay true. Breaking one of these is a bug even if tests pass.

1. **An excluded domain is never touched.** No DOM read or write, no observer, no interval. The
   check runs before the icon capture for exactly this reason. The one exception is deliberate: if
   a domain is excluded *while* a rule of ours is applied, the page's original icon is restored and
   everything torn down, rather than leaving our icon behind until the next reload.
2. **A page with no matching rule and no prior modification by us is never touched.**
3. **Only the content script context mutates page DOM.** In practice that means `content.ts` and
   `utils/faviconDom.ts`, which it alone imports. No other file and no other context may.
4. **The tracked `<link>` element is mutated in place, never replaced**, or background tabs stop
   updating. See [ARCHITECTURE.md](ARCHITECTURE.md) §3.
5. **Our own DOM writes never trigger a re-apply.** The observer decides that by comparing the
   `href` it sees against the one we asked for, **not** by looking for our marker: the element an
   SPA rewrites is usually the very element we marked, so skipping marked elements skipped the
   case that matters (ADR-014, ROADMAP R-43).
6. **Every rule has a unique `id`, and `rules` is keyed by that same `id`.**
7. **A paused rule never matches and never shadows.** Both fall out of one check in
   `scoreRule`; do not add a second path that bypasses it.
8. **Nothing leaves the device** except a fetch of a URL the user typed, the current site's own
   icon, and the options-page preview call to Google's favicon service. All three are documented
   in [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md); adding a fourth means amending that file. The
   first of the three happens on every apply *and* once when such a rule is saved, so the editor
   can say whether the address loads (ADR-019); same address, same request, no new destination.
9. **Stored icons stay small.** Uploads are capped at 128px and compressed, because
   `chrome.storage.local` has a hard quota and there is no `unlimitedStorage` permission.
10. **One rule per `(matchType, matcher)`.** Two rules with the same scope and matcher are
    meaningless, since only one of them could ever apply, and `findBestRule` breaks an exact tie
    by keeping the earlier one, so the newer of a pair loses silently. `saveRule` collapses the
    pair rather than allowing it (ADR-020).
11. **A matcher is canonical for its scope.** A `domain` matcher is a hostname the browser could
    report, and an `exact_url` matcher is a URL the browser could produce, which means the
    settings page's free text is normalised (`hostnameFromInput`, `canonicalUrl`) or refused. A
    matcher that cannot match anything is a rule the user cannot debug: it looks right in the
    list and does nothing. See R-49 and R-64.
12. **Mutations of storage do not overlap.** Every write goes through one queue per context, and
    writes only its own key, or a concurrent change is lost outright (ADR-020, L-38).
