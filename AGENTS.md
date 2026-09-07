# AGENTS.md

Behaviour contract for AI agents and LLM-driven automation working in this repository. Read this
before your first edit. Human contributors should read it too, the constraints are not
agent-specific, they are just written down here.

**What this repo is**: a Chrome Manifest V3 extension that replaces site favicons from
user-defined rules. ~2,500 lines of TypeScript/React, no backend, 983 live users on the Chrome
Web Store. Shipping a regression is visible to strangers within a day and cannot be rolled back
quickly ([docs/PLAYBOOK.md](docs/PLAYBOOK.md) §7).

---

## 1. Read these first, in this order

| If you are about to… | Read |
|---|---|
| Change anything at all | This file, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §1 (execution contexts) |
| Touch `content.ts` | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3 and [docs/DECISIONS.md](docs/DECISIONS.md) ADR-001, ADR-002, ADR-003. **Non-negotiable** |
| Touch rule matching | [docs/DOMAIN.md](docs/DOMAIN.md) §2, then `utils/matcher.test.ts` |
| Touch storage or import/export | [docs/DECISIONS.md](docs/DECISIONS.md) ADR-004, ADR-005; [docs/SECURITY.md](docs/SECURITY.md) threats 1 to 3 |
| Touch the upload flow | [docs/DECISIONS.md](docs/DECISIONS.md) ADR-007 (the OS popup trap) |
| Add a network call, permission or CSP change | [docs/SECURITY.md](docs/SECURITY.md) and [PRIVACY_POLICY.md](PRIVACY_POLICY.md) |
| Pick up work | [ROADMAP.md](ROADMAP.md), the only tracked queue |
| Wonder whether a bug is known | [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| Find anything else | [CONTEXT_MAP.md](CONTEXT_MAP.md) |

Table name: **agent-reading-order**

---

## 2. Hard rules

Violating one of these is a defect even if the code compiles, the tests pass and the feature
works on your machine.

1. **Only `content.ts` may touch page DOM.** No other file, no exceptions.
2. **Never replace the favicon `<link>` element.** Mutate the tracked element's `href` in place.
   Remove-and-append silently breaks every background tab. ADR-001.
3. **Never touch a page that has no matching rule** and that we have not already modified.
   ADR-002.
4. **Never touch an excluded domain**, at all, before any matching runs.
5. **Never add a network request** without amending [PRIVACY_POLICY.md](PRIVACY_POLICY.md) in the
   same change. There are exactly three today and they are enumerated there.
6. **Never add analytics, telemetry, error reporting or any outbound ping.** This is the product's
   differentiation, not a preference.
7. **Never widen the CSP** (`script-src 'self'` stays) and never add a permission without writing
   its justification into [docs/SECURITY.md](docs/SECURITY.md).
8. **Never introduce a secret, key or token,** and never add a build-time `define` that inlines
   one. A published extension can be unzipped by anyone.
9. **Never break the storage read path.** Migrations are forward-only, latched, and must not
   delete the shape they read. A code rollback must not lose user data. ADR-005.
10. **Never reverse a decision in [docs/DECISIONS.md](docs/DECISIONS.md) without saying so.** If a
    change contradicts an ADR, say which one and why in your summary. Each ADR records what breaks
    when it is reversed; those failures are all things that already happened once.

---

## 3. Which context does your code run in?

Getting this wrong is the most expensive mistake available in an extension codebase, because the
symptom is usually silence rather than an error.

| Context | Files | `chrome.tabs` | Page DOM | Notes |
|---|---|---|---|---|
| Content script | `content.ts` | No | **Yes** | Built as IIFE, no ESM at runtime |
| Service worker | `background.ts` | Yes | No | Dies when idle; no `window`, no DOM |
| Popup / editor window | `App.tsx`, `index.tsx`, `components/**` | Yes | No | Popup dies on blur |
| Options page | `Options.tsx`, `components/options/**` | Yes | No | Long-lived |

Table name: **context-capabilities**

Shared code in `utils/` is imported by several contexts. `utils/matcher.ts` in particular is
imported by the IIFE content script **and** unit-tested in plain Node, keep it pure and free of
`chrome.*` calls, or both break.

---

## 4. Conventions to match

- **TypeScript, no `any`** for new code. The existing `declare const chrome: any` in `content.ts`
  and `utils/storage.ts` is debt (R-19), not a pattern to copy, `@types/chrome` is installed.
- **Named exports** for everything except `App.tsx`'s default. Single quotes. Semicolons.
- **Indentation is mixed** across the repo: `content.ts`, `utils/storage.ts` and `types.ts` use
  2 spaces; `utils/matcher.ts`, `utils/canvas.ts` and the components use 4. **Match the file you
  are editing**; do not reformat a file you are not otherwise changing.
- **Components**: `React.FC<Props>` with an explicit `interface Props` above it. Tailwind utility
  classes inline, no CSS modules, no styled-components.
- **Tuning values go in `constants.ts`** with a comment explaining the number. Never inline a
  magic timing constant.
- **Comment the *why*, not the *what*.** The valuable comments in this repo explain browser
  behaviour that cannot be inferred from the code (`updateFavicon`, `openExpandedEditor`,
  `normalizeImageDataUrl`). Preserve them. If you delete a comment like that, you are deleting
  the reason someone will not reintroduce the bug.
- **Logging**: `logger.*`, never bare `console.*`. `logger.error` for real failures (always
  printed), `logger.debug`/`info` for the rest (opt-in only). Prefix content-script lines with
  `[Content]` and service-worker lines with `[BG]`. Never log page content or form values.
- **No new dependencies** without asking. Two runtime dependencies is a feature.
- **Keep GitHub Actions usage minimal.** Checks run in a local pre-push hook by decision; do not
  add a workflow without asking. ADR-012. `.github/dependabot.yml` is not a workflow, it runs on
  GitHub's own infrastructure and consumes no Actions minutes, which is why it is allowed.
- **Editor logic does not go in `FaviconEditor.tsx`.** That file draws. Behaviour goes in
  `components/editor/useRuleEditor.ts`, and anything about what a rule *matches* goes in
  `utils/ruleScope.ts`, which is pure and tested. Never store a derived pattern in state; see
  ADR-016 for the three bugs that came from doing so.
- **`new URL()` not throwing does not mean the input was valid.** Chrome percent-encodes illegal
  host characters where Node throws, so a guard that leans on the parser passes the tests and
  fails in the product (R-49). Check the shape of what comes back.
- **Never trust the DOM alone when changing the favicon write path.** The DOM can hold your icon
  while the tab strip still shows the site's. Check the tab's `faviconUrl` over the DevTools
  protocol, and for anything load-bearing, screenshot the window. ADR-001, ADR-014,
  [docs/TESTING.md](docs/TESTING.md).

---

## 5. Definition of done

```bash
npm run check         # typecheck + 302 tests, both must pass; add tests for logic you added
npm run build         # must produce dist/ with both passes
```

All three run automatically on `git push` via [.githooks/pre-push](.githooks/pre-push), which
blocks the push on failure. There is no CI workflow (ADR-012), so do not rely on anything
catching a mistake later than that hook.

Then, for anything touching `content.ts`, matching, or the upload flow, **load the unpacked
build and walk the manual list** in [docs/TESTING.md](docs/TESTING.md), at minimum the active
tab, a **background** tab, an SPA, and a page with no rule. A green test suite does not tell you
whether background tabs still repaint; nothing automated does, yet.

Reload the extension at `chrome://extensions` after every build, **and reload the pages you are
testing**, open tabs keep the old `content.js`.

---

## 6. Ask before doing

- Publishing to the Chrome Web Store, or any change to the public listing.
- `git push`, tagging a release, or bumping the version in `public/manifest.json`.
- Adding a permission, a host permission, a dependency, or a network call.
- Deleting user-facing behaviour, or anything that changes stored data shape.
- Changing [PRIVACY_POLICY.md](PRIVACY_POLICY.md) substance (as opposed to accuracy fixes that
  follow a code change you were asked to make).

Committing locally in the course of requested work is fine. Pushing is not.

---

## 7. Reporting your work

- **Never present inferred behaviour as verified.** Browser behaviour here is genuinely
  counter-intuitive (see ADR-001) and this codebase punishes confident guessing. If you did not
  run it, say so and label it.
- **State what you actually verified** and by what means, tests, type check, unpacked build, or
  reasoning alone. "Should work" is not a report.
- **Raise a problem with options**: what the choices are, the trade-off of each, and a
  recommendation. A bare finding is not actionable.
- **Log new defects in [ROADMAP.md](ROADMAP.md)** with an `R-xx` id, and describe them in
  [docs/LIMITATIONS.md](docs/LIMITATIONS.md) with an `L-xx` id and a file reference. Do not leave
  a finding only in chat, and do not start a second tracking file.
- **Update the docs you invalidate.** If you change matching, `docs/DOMAIN.md` §2 is now wrong. If
  you reverse a decision, add an ADR. Stale docs are worse than no docs, because agents trust them.
