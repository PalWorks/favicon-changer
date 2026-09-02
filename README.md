# Favicon Changer Ultimate

Customize favicons for any website with emojis, image uploads, or badges and overlays. Make your
browser tabs organized and personalized.

A Chrome Manifest V3 extension. No backend, no accounts, no analytics, every icon is generated
and stored on your own device.

[**Chrome Web Store**](https://chromewebstore.google.com/detail/egedbdckafdbomehjaihjhbcgmngmlah) ·
983 users · 4.4 ★

---

## Features

- **🎨 Custom uploads**: any PNG, JPEG, SVG or WebP, with fit / fill / stretch framing.
- **😀 Emoji**: a searchable, categorised emoji library rendered straight to an icon.
- **🏷️ Badges and overlays**: text badges and colour washes composited over a site's real icon.
- **📂 Per-site rules**: match a whole domain or one exact URL, and exclude sites you want left
  alone. (Regex matching exists in the engine but has no UI yet, see
  [ROADMAP.md](ROADMAP.md) R-02.)
- **⚡ Auto-compression**: icons are downscaled and compressed to fit the browser storage quota.
- **🔁 Import / export**: back up or share your rules as JSON.
- **🐞 Support logs**: opt-in verbose logging you can download and send when something breaks.

---

## Install

**From the store**: [Favicon Changer
Ultimate](https://chromewebstore.google.com/detail/egedbdckafdbomehjaihjhbcgmngmlah) → pin it to
your toolbar → click the icon on any page.

**From source**:

```bash
npm install
npm run build
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.

---

## Usage

1. **Open the editor**, click the toolbar icon on the page you want to change. On
   Linux/ChromeOS/OpenBSD this opens a small window instead of a bubble, so that file uploads
   survive the OS file dialog.
2. **Choose a scope**, *Entire Domain* applies to the whole site (subdomains included);
   *This Page Only* applies to that exact URL, query string and all.
3. **Pick a source**, upload or drop an image, paste an image URL, choose an emoji, or build a
   badge over the site's existing icon.
4. **Apply**, the tab icon changes immediately, including tabs in the background.
5. **Manage everything**, right-click the icon → **Options** for the full rule list, the global
   fallback icon, the exclusion list, import/export and debug logs.

---

## Architecture in one minute

Four programs in four sandboxes that share only `chrome.storage.local`:

```
content.ts      injected into every page · the ONLY code that touches page DOM
background.ts   service worker · platform detection, toolbar routing
index.html      toolbar popup and standalone editor window (React)
options.html    settings page (React)
```

A rule is `{matcher, matchType, faviconUrl}`; the icon is normally an inline PNG `data:` URL, so
nothing is fetched at page load. On every page the content script reads the rules, picks the best
match (`exact_url` > `regex` > `domain`), and mutates the `href` of the `<link rel=icon>` element
Chrome is already tracking, which is the only DOM change that repaints a **background** tab's
icon.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Development

```bash
npm install
npm run dev        # Vite dev server, React UI only, with a localStorage storage shim
npm run build      # two-pass production build into dist/
npm test           # 20 unit tests (vitest)
npx tsc --noEmit   # type check, not part of the build (see ROADMAP R-00: React types missing)
```

`npm run dev` cannot test favicon behaviour: there is no `chrome.*` API in a plain tab, so the
content script does not run. Anything touching rules must be tested with an unpacked build.

**Working on this codebase (human or agent): read [AGENTS.md](AGENTS.md) first.** Several pieces
of this code look wrong and are not, most of all the favicon write path, which is documented in
[docs/DECISIONS.md](docs/DECISIONS.md) ADR-001 along with what breaks when it is "cleaned up".

### Documentation

| | |
|---|---|
| [AGENTS.md](AGENTS.md) | Contract for anyone editing this repo, hard rules, conventions, definition of done |
| [CONTEXT_MAP.md](CONTEXT_MAP.md) | Which document answers which question |
| [ROADMAP.md](ROADMAP.md) | The only tracked work queue |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Contexts, build pipeline, data flow, storage, messaging |
| [docs/DOMAIN.md](docs/DOMAIN.md) | Rules, match precedence, vocabulary, invariants |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why the code is shaped this way, and what breaks if reversed |
| [docs/PLAYBOOK.md](docs/PLAYBOOK.md) | Build, debug, release, roll back |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and the manual checklist |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Triaging user reports |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, CSP, permission justifications |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Known defects and technical debt |

Table name: **documentation-index**

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your rules and settings on your device |
| `scripting` | Inject the content script into tabs that were open before install or update |
| `<all_urls>` | Apply favicons on any site you choose, rules must work in background tabs, so `activeTab` is not sufficient |

Table name: **permissions**

## Privacy

Favicon processing happens entirely on your device, and your rules live in
`chrome.storage.local`, they are never synced or sent anywhere. There are exactly three cases
where a network request happens, all of them enumerated in
[PRIVACY_POLICY.md](PRIVACY_POLICY.md#network-requests), including one third-party call (Google's
public favicon service) used only for previews on the settings page.

No analytics. No tracking. No servers.

## License

MIT
