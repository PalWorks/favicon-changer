# Security

## Threat model

The extension has no server, no accounts, no secrets and no credentials. There is nothing to
exfiltrate from us. What it *does* have is `<all_urls>` host permission and a content script on
every page, which makes it a high-value target and a high-consequence mistake surface. The
realistic threats, in order of likelihood:

| # | Threat | Vector | Current mitigation | Residual |
|---|---|---|---|---|
| 1 | A malicious **rules JSON** import | User is socially engineered into importing a shared "rule pack" | Every rule is rebuilt field by field in `utils/importRules.ts`: `matchType` must be known, regex patterns must compile, `faviconUrl` scheme is allow-listed to inline images and http(s), icons are size-capped, metadata is rebuilt from known keys only, and the file is capped at 500 rules. Rejects are reported per rule with a reason | An accepted `https:` icon URL is still a third-party request the user agreed to |
| 2 | **Tracking via remote favicon URLs** | An imported rule points `faviconUrl` at an attacker host, which then receives a request (with IP and UA) every time the user visits the matched site | The import summary counts them and says they are fetched from their own address on every apply | The user is told a count, not the hosts. A per-host list would be better |
| 3 | **ReDoS** from a regex rule | A catastrophic-backtracking pattern runs against every URL on every page load | Patterns over 2000 chars rejected (`MAX_REGEX_LENGTH`), and imported patterns must compile before they are stored. The editor offers `prefix` as the safe default for the common case, which cannot backtrack (ADR-013) | JavaScript has no regex timeout; a short evil pattern still hangs the page. Patterns are self-authored or self-imported |
| 4 | A **hostile page** attacking the content script | Page script manipulating the DOM we observe | The content script exposes no API to the page, holds no secrets, and only ever writes an attribute and an `href` | A page can fight us for the icon (a nuisance, not a compromise) |
| 5 | **Supply chain** | A compromised npm dependency reaching the shipped bundle | Only two runtime deps (`react`, `react-dom`); everything else is devDependencies; `package-lock.json` is committed; `.githooks/pre-push` blocks a push on any high-severity **production**-scope advisory and reports dev-only ones without blocking; Dependabot raises version bumps weekly (`.github/dependabot.yml`, config only, it runs on GitHub's own infrastructure and consumes no Actions minutes) | Dev-only advisories are a judgement call each time. A Dependabot pull request is still reviewed and merged by hand |
| 6 | **The dev server as a file-read surface** | Vite's dev server has a recurring class of path-traversal and arbitrary-file-read advisories, and `vite.config.ts` used to bind it to `0.0.0.0`, exposing it to the whole LAN and any VPN interface while `npm run dev` ran | Bind removed: the dev server is localhost-only, and `npm run dev -- --host` is an explicit opt-in. Vite kept current through the audit gate | Only as safe as the machine running it |

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

## The dev server

`npm run dev` is a development tool, not part of the shipped extension, but it runs on a machine
with the source tree on it. It is bound to localhost deliberately: it previously listened on
`0.0.0.0`, which put it on every network interface, and Vite's dev server has repeatedly had
path-traversal and arbitrary-file-read advisories. If you need it reachable from another device,
`npm run dev -- --host` makes that a deliberate act rather than the default.

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

Email **support@palworks.ai** with "security" in the subject. Include the extension version, the
browser build, and the steps to reproduce. Please report privately first rather than opening a
public issue, so a fix can ship before the details are public.

Expect an acknowledgement within three working days. There is no bug bounty.

On receiving a report: confirm whether it requires a malicious import (threats 1 and 2 both do,
user action is required, which lowers severity), fix forward, and ship a patch version. There is
no way to reach installed copies faster than a store update, so the store review queue is the
real floor on response time.
