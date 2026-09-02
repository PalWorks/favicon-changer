# Security

## Threat model

The extension has no server, no accounts, no secrets and no credentials. There is nothing to
exfiltrate from us. What it *does* have is `<all_urls>` host permission and a content script on
every page, which makes it a high-value target and a high-consequence mistake surface. The
realistic threats, in order of likelihood:

| # | Threat | Vector | Current mitigation | Residual |
|---|---|---|---|---|
| 1 | A malicious **rules JSON** import | User is socially engineered into importing a shared "rule pack" | Shape check on `id`/`matcher`/`faviconUrl`; remote-URL rules are counted and disclosed in the confirmation | `matchType` and the `faviconUrl` **scheme** are not validated; no count or size cap. See ROADMAP R-07 |
| 2 | **Tracking via remote favicon URLs** | An imported rule points `faviconUrl` at an attacker host, which then receives a request (with IP and UA) every time the user visits the matched site | The import dialog reports how many rules use remote URLs | The user is told a count, not the hosts. R-07 |
| 3 | **ReDoS** from a regex rule | A catastrophic-backtracking pattern runs against every URL on every page load | Patterns over 2000 chars rejected (`MAX_REGEX_LENGTH`) | JavaScript has no regex timeout; a short evil pattern still hangs the page. Patterns are currently self-authored or self-imported. R-07 |
| 4 | A **hostile page** attacking the content script | Page script manipulating the DOM we observe | The content script exposes no API to the page, holds no secrets, and only ever writes an attribute and an `href` | A page can fight us for the icon (a nuisance, not a compromise) |
| 5 | **Supply chain** | A compromised npm dependency reaching the shipped bundle | Only two runtime deps (`react`, `react-dom`); everything else is devDependencies; `package-lock.json` is committed | No `npm audit` gate, no Dependabot. R-16 |

Table name: **threat-model**

---

## Content Security Policy

`public/manifest.json` sets, for extension pages:

```
script-src 'self'; object-src 'self'; img-src 'self' data: blob: https:;
```

- `script-src 'self'`, no CDN, no `eval`, no inline scripts. Everything is bundled at build
  time. This is why the emoji library is a TypeScript array rather than a fetched JSON file.
- `img-src` allows `data:` and `blob:` because every generated icon is a data URL and the badge
  compositor works through object URLs, plus `https:` for the "paste image URL" source and the
  options-page preview.
- **Never add** `'unsafe-inline'` or `'unsafe-eval'`, and never widen `script-src`. Both are
  rejected in review and would make an XSS in the options page catastrophic.

---

## Permissions: why each one

Reviewers ask, and the answers must match [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md):

| Permission | Justification | Could it be narrower? |
|---|---|---|
| `storage` | Persist rules and settings on the device | No |
| `scripting` | Inject `content.js` into tabs opened before install/update, where the manifest declaration does not reach (ADR-008) | Not without breaking existing tabs |
| `<all_urls>` host | The user may want a custom favicon on any site; the extension cannot know which in advance | `activeTab` would break the whole model, rules must apply to background tabs the user never clicks. **This is the permission most likely to be challenged in review**; the justification is in the privacy policy |

Table name: **permission-justification**

Not requested, deliberately: `tabs` (the `tabs.query` calls work under host permissions),
`unlimitedStorage`, `downloads` (exports use an anchor click), `activeTab`, `webRequest`,
`declarativeNetRequest`.

---

## Data handling rules

1. **Nothing leaves the device** except the three cases enumerated in
   [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md#network-requests). Adding a fourth is a privacy
   policy amendment and a store-listing change, not a code change.
2. **No analytics, ever.** Not "anonymous" analytics, not error reporting, not a ping. The store
   listing's promise and the extension's differentiation both rest on this.
3. **Page content is never read** beyond `link[rel*='icon']` elements and `location.href`.
4. **The log buffer must stay boring.** It records rule matchers and URLs, which is already
   sensitive enough; never add page content, form values or headers to it. It is off by default,
   capped at 1000 lines, and lives only in local storage, but users are asked to send it to
   support, so treat every line as something a stranger may read.
5. **Never send the user's email, profile, or any identifier anywhere.** There is no code that
   handles identity; do not add any.

---

## Secrets

There are none, and there must never be any. No API keys, no tokens, no endpoints. An earlier
iteration carried Gemini API key plumbing in `vite.config.ts`; it was removed and only an empty
`define: {}` remains as a scar. **Do not reintroduce a `define` block that inlines a secret**
anything injected at build time is trivially readable in the shipped bundle, which any user can
unzip from the store. An extension cannot keep a secret.

---

## Review checklist for a change

- Does it add a network request? → privacy policy amendment required.
- Does it widen the CSP or add a permission? → justify it in the store listing, expect scrutiny.
- Does it write to page DOM outside `content.ts`? → invariant violation.
- Does it accept data from outside (import, remote URL, page)? → validate the scheme, the shape
  and the size.
- Does it log anything new? → check it against data-handling rule 4.
- Does it store anything unbounded? → the storage quota is shared with the user's icons.

---

## Reporting a vulnerability

There is no `SECURITY.md` contact channel published on the store listing yet (R-17). Until there
is, the Chrome Web Store support page is the only inbound path. If you receive a report: confirm
whether it requires a malicious import (threat 1 and 2 both do, user action is required, which
lowers severity), fix forward, and ship a patch version. There is no way to reach installed
copies faster than a store update.
