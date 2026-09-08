# Playbook

Operational procedures: build, run, debug, release, roll back. Commands assume the repo root.

---

## 1. Local setup

```bash
npm install
```

Node 18+ (`@types/node` targets 22). No environment variables, no secrets, no services.
`vite.config.ts` still calls `loadEnv` but defines nothing, there is nothing to configure.

---

## 2. Commands

| Command | What it does | When |
|---|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:3000` | UI work only, React hot reload with a `localStorage` storage shim |
| `npm run build` | Two-pass production build into `dist/` | Before loading unpacked, and before every release |
| `npm test` | `vitest run`, unit tests, no watch | Before every commit |
| `npm run typecheck` | `tsc --noEmit` | Any time; also runs in the pre-push hook |
| `npm run check` | typecheck + tests | The quick gate before committing |
| `npx vitest` | Watch mode | While editing `utils/` |
| `npx tsc --noEmit` | Type check directly (the tsconfig is `noEmit`) | Same as `npm run typecheck`; **not** part of `npm run build` |

Table name: **commands**

### The pre-push gate

`npm install` points `core.hooksPath` at [.githooks/](../.githooks/) through the `prepare`
script, so [.githooks/pre-push](../.githooks/pre-push) runs on every `git push`: type check,
unit tests, the full two-pass build, then `npm audit` scoped to production dependencies. About
9 seconds in total. A failure blocks the push. Dev-only advisories are printed as a note and do
not block, and an audit that cannot reach the registry is reported as inconclusive rather than
failing, so an offline push still works.

This project has **no GitHub Actions workflow** by decision (ADR-012), so this hook is the only
automated gate. That means two things worth remembering: if you clone fresh and never run
`npm install`, you are not gated, and `git push --no-verify` skips it silently.

To install by hand: `git config core.hooksPath .githooks`.

### Dependency updates

Dependabot opens at most one production and one development pull request a week, and nothing
merges itself. Two things to expect when you merge them:

- **Merge them one at a time.** Both edit `package-lock.json`, so the second conflicts the moment
  the first lands. Comment `@dependabot rebase` on the second and it force-pushes a clean branch
  within a minute or two.
- **`npm install` afterwards may show a dirty lockfile with `libc` fields removed.** That is the
  local npm (10.9.8) disagreeing with the newer npm Dependabot runs, over metadata that only
  affects optional platform packages on musl. Keep the lockfile from the merge (`git checkout --
  package-lock.json`) rather than committing the churn back and forth.

### Checking that Actions usage is still nil

The Actions tab is not empty even with no workflow file, because GitHub lists its own Dependabot
updater there as a dynamic entry. To confirm nothing of ours runs, and that the updater costs
nothing:

```bash
find .github -name '*.yml' -o -name '*.yaml'          # dependabot.yml and nothing else
gh api repos/PalWorks/favicon-changer/actions/workflows --jq '.workflows[].path'
gh run list --limit 10                                 # every row should read "Dependabot Updates"
gh api repos/PalWorks/favicon-changer/actions/runs/<id>/timing --jq .billable
```

Last run 2026-09-07: one dynamic workflow, `dynamic/dependabot/dependabot-updates`, and
`billable.UBUNTU.total_ms` was **0** on each of the three most recent runs. A workflow path that is
a real file, or a non-zero billable figure, means something was added that ADR-012 does not allow.

---

The dev server binds to localhost only, on purpose (see [SECURITY.md](SECURITY.md)). Use
`npm run dev -- --host` if you need it from another device.

`npm run dev` **cannot test favicon behaviour.** There is no `chrome.*` API in a plain tab, so
`IS_DEV` flips storage to `localStorage`, `getCurrentTabInfo()` returns an `example.com` stub, and
the content script does not run at all. Anything touching rules-in-anger must be tested unpacked.

---

## 3. Run it for real (load unpacked)

```bash
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` directory (not the repo root).
4. Pin the extension to the toolbar.

After each rebuild, click the **reload** icon on the extension card. That reloads the service
worker and the popup, but **already-open tabs keep the old `content.js`**, reload those tabs
too, or the content script you are debugging is the previous build.

To test local files, enable **Allow access to file URLs** on the extension card; the editor shows
a prompt for this when the target is a `file:` URL.

---

## 4. Implement a feature

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) §1 and decide **which execution context** the change
   belongs in. Getting this wrong is the most expensive mistake available here.
2. Check [DECISIONS.md](DECISIONS.md) for a record covering the code you are about to change. If
   one exists and you are about to reverse it, stop and re-read why.
3. Check the invariants in [DOMAIN.md](DOMAIN.md) §5.
4. Keep pure logic in `utils/` so it can be unit-tested; keep DOM mutation in `content.ts`.
5. Add or extend tests in `utils/*.test.ts`. See [TESTING.md](TESTING.md).
6. `npm test && npx tsc --noEmit`.
7. `npm run build`, reload unpacked, and verify **all four** of: active tab, background tab,
   an SPA, and a page with no rule (which must stay untouched).

New tuning constants go in [constants.ts](../constants.ts) with a comment explaining the value,
never inline.

---

## 5. Debug

| Surface | How to open its console |
|---|---|
| Content script | F12 on the affected page, logs are prefixed `[Content]` |
| Service worker | `chrome://extensions` → the extension card → **service worker** link, prefixed `[BG]` |
| Popup | Right-click the toolbar icon → **Inspect popup** (it survives while DevTools is attached) |
| Options page | F12 on the options tab |

The popup dying on blur is the standard obstacle. Two ways around it: attach DevTools first
(which keeps it alive), or turn on **Enable Verbose Logging** in the options page and read the
persisted buffer after the fact. `logger.downloadLogs()` is exposed as a Download button there.

There is a VS Code task, **Start Chrome DevTools (port 9223)**, that runs on folder open and
launches Chrome with `--remote-debugging-port=9223` against a separate profile
(`~/.config/chrome-mcp-debug`) for MCP-driven browser automation.

---

## 6. Release to the Chrome Web Store

Step by step for every store, with the listing copy, is in
[PUBLISHING.md](PUBLISHING.md). Chrome is the only channel in use; Edge and Firefox are paused by
decision (ADR-018).

The shipped version number is **`public/manifest.json`**. Keep `package.json` equal to it.

```bash
# 1. Bump both files to the same version
#    public/manifest.json  "version"
#    package.json          "version"

# 2. Gate
npm test
npx tsc --noEmit

# 3. Build
npm run build

# 4. Package: zip the CONTENTS of dist/, not the dist/ folder itself
cd dist && zip -r ../favicon-changer-ultimate-v<VERSION>.zip . && cd ..

# 5. Verify the zip has manifest.json at its ROOT
unzip -l favicon-changer-ultimate-v<VERSION>.zip | head
```

A correct archive is 16 entries, 14 files plus two directory records, with `manifest.json` at the
top level. v1.4.4 is 163KB (v1.4.3 was 159KB):

```
index.html  options.html  manifest.json
popup.js  options.js  background.js  content.js
assets/ErrorBoundary.css  assets/ErrorBoundary-<hash>.js  assets/handoff-<hash>.js
icons/16.png  icons/48.png  icons/128.png  icons/logo.png
```

If `manifest.json` sits inside a `dist/` folder in the zip, the store rejects the upload.

**Verify the archive itself, not just `dist/`:** unzip it somewhere clean and load *that* unpacked,
so what is checked is the artefact being uploaded. The two are meant to be identical and a check
that assumes it proves nothing.

6. Upload at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for item
   `egedbdckafdbomehjaihjhbcgmngmlah`.
7. Re-check the store listing against [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md). The single
   purpose is "change favicons"; the justifications for `storage`, `scripting` and `<all_urls>`
   are in that file and must match what the dashboard says.
8. Tag the release: `git tag v<VERSION> && git push --tags`.

`*.zip` is gitignored, release archives are build output, not source. Store listing images live
in [../store-assets/](../store-assets/).

---

## 7. Roll back

The store keeps published versions. To revert a bad release:

1. Publish the previous version's archive again with a **higher** version number, Chrome will
   not accept a version that goes backwards, so `1.3.0` broken → ship `1.3.1` containing the
   `1.2.1` code.
2. In an emergency, **unpublish** the item in the dashboard; it disappears from the store but
   stays installed for existing users, which stops the bleeding but does not fix anyone.
3. Existing users update on Chrome's own schedule (hours to a day); there is no push mechanism.

Because rules live in `chrome.storage.local` and are never migrated destructively (the only
migration is additive and latched), a code rollback does not lose user data. **Preserve this
property**: any future migration must be forward-only and must not delete the shape it reads.

---

## 8. Handle a user bug report

See [RUNBOOK.md](RUNBOOK.md), it is written as a triage tree for "the favicon didn't change".
