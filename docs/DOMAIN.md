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
| `createdAt` | `Date.now()` | Display only. **Overwritten on every save**, so it is really "last saved at" |

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
evaluates in a fixed order and returns the **first** rule found at the highest-priority tier
that has any match. Tiers are tried strictly in sequence; a hit at a tier ends the search.

| Priority | `matchType` | Compared against | Semantics |
|---|---|---|---|
| 1 (highest) | `exact_url` | `window.location.href` | Byte-exact string equality, query string and hash included |
| 2 | `regex` | `window.location.href` | `new RegExp(matcher).test(url)`, unanchored, no flags |
| 3 (lowest) | `domain` | `window.location.hostname` | `hostname === matcher \|\| hostname.endsWith('.' + matcher)` |

Table name: **match-precedence**

Consequences that surprise people:

- **`exact_url` really is exact.** `https://site.com/a` and `https://site.com/a?x=1` are
  different rules, and `https://site.com/` does not match `https://site.com`. This is the root
  of the most-requested feature; see the prefix-matching item in [../ROADMAP.md](../ROADMAP.md).
- **`domain` covers subdomains downward only.** A rule for `google.com` matches
  `www.google.com` and `docs.google.com`. A rule for `www.google.com` does **not** match
  `google.com`. There is no `www` normalisation.
- **`regex` matches the whole URL, unanchored.** `google` as a pattern matches any URL containing
  the substring. Invalid patterns, and patterns over 2000 characters, are skipped with a warning
  rather than throwing.
- **Within one tier, the first rule wins**: in `Object.values(rules)` order, which is insertion
  order, i.e. the oldest rule. Specificity is *not* considered inside a tier, so with both
  `google.com` and `docs.google.com` as domain rules, whichever was created first wins on
  `docs.google.com`. This is a known defect, tracked in [LIMITATIONS.md](LIMITATIONS.md).

### Resolution order at runtime

```
excluded domain?         -> do nothing at all (highest authority of any setting)
exact_url rule hit?      -> use it
regex rule hit?          -> use it
domain rule hit?         -> use it
global defaultFaviconUrl set? -> use it
otherwise                -> restore the page's original icon if we had changed it, else nothing
```

### Conflict warning

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
| Emoji | [EmojiSection](../components/editor/EmojiSection.tsx), `fillText` at 54px serif | 64×64 | `data:image/png` |
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
| **Scope** | The popup's word for `matchType`, exposed as only two buttons: "Entire Domain" (`domain`) and "This Page Only" (`exact_url`). `regex` has no UI. |
| **Target / target page** | The page a rule is being written for; in the popup, the active tab. |
| **Active rule** | The rule matching the current target at the current scope, drives the Active/Inactive pill. |
| **Conflict** | A higher-precedence rule that will shadow the rule being edited. |
| **Original favicon** | The page's own icon, captured before first mutation, restored when a rule is deleted. |
| **Exclusion** | A hostname on `excludedDomains`. Stronger than any rule. |
| **Hand-off** | Passing the edit target from the popup to the standalone window via `pendingEditorTarget`. |
| **Change mark** | The `data-fc-modified` attribute marking the `<link>` we own, so the observer ignores our own writes. |

Table name: **glossary**

---

## 5. Invariants

Things that must stay true. Breaking one of these is a bug even if tests pass.

1. **An excluded domain is never touched.** No DOM read or write, no observer, no interval.
2. **A page with no matching rule and no prior modification by us is never touched.**
3. **Only `content.ts` mutates page DOM.** No other file may.
4. **The tracked `<link>` element is mutated in place, never replaced**, or background tabs stop
   updating. See [ARCHITECTURE.md](ARCHITECTURE.md) §3.
5. **Our own DOM writes never trigger a re-apply**, they carry `data-fc-modified` and the
   observer skips marked elements.
6. **Every rule has a unique `id`, and `rules` is keyed by that same `id`.**
7. **Nothing leaves the device** except a fetch of a URL the user typed, the current site's own
   icon, and the options-page preview call to Google's favicon service. All three are documented
   in [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md); adding a fourth means amending that file.
8. **Stored icons stay small.** Uploads are capped at 128px and compressed, because
   `chrome.storage.local` has a hard quota and there is no `unlimitedStorage` permission.
