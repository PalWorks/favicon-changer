# Store screenshots

Five listing screenshots at **1280x800**, 24-bit PNG with no alpha channel, which is what the
Chrome Web Store asks for and the one size Chrome and Edge both accept.

| File | Shows | Source |
|---|---|---|
| `01-tab-icons.png` | A real browser window with eight tabs carrying custom icons, plus the same tab strip magnified twice and labelled as such | X11 capture of the browser window |
| `02-match-scopes.png` | The four-way scope selector on a `Starts With` pattern, with the live "matches 1 of your 8 open tabs" count | Renderer capture of `index.html?expanded=1` |
| `03-emoji-library.png` | The emoji picker open, search field and category tabs | Renderer capture |
| `04-badges.png` | The notification badge editor with a red badge composited over GitHub's real favicon | Renderer capture |
| `05-rule-manager.png` | The settings page: exclusions, storage use, JSON import and export, and the rule list with eight rules | Renderer capture |

Table name: **store-screenshots**

## How they were made, and how to redo them

Every pixel of interface in these images is a real capture of the shipped build. Nothing is a
mock-up, and no interface was retouched. Only three things were staged, and each is worth knowing
before the next reshoot:

1. **A throwaway browser on a virtual display.** `Xvfb :77` at 1400x900, then Chrome with a fresh
   `--user-data-dir` and `--window-size=1280,800`. Nothing of the author's own browsing, profile
   or tabs can appear, which is the defect the previous screenshots had.
2. **Demo rules seeded into `chrome.storage.local`**, eight domain rules with emoji icons drawn
   the same way the product draws them. The sites are public pages opened logged out.
3. **Scrollbars hidden for the renderer captures** with a one-line injected style. A scrollbar is
   an artefact of the capture viewport, not part of the product.

The editor was pointed at each target page through the same `pendingEditorTarget` key the toolbar
click uses ([../../utils/handoff.ts](../../utils/handoff.ts)), so what is pictured is a real editor
session rather than a page forced into a pose.

Captures were taken at `deviceScaleFactor: 2` and composed in the browser at 2x, then downscaled
to 1280x800 with a Lanczos filter, so the type stays sharp. The captions live in the composer, not
in the interface.

**Rule for any future edit:** a caption must describe what the picture shows. The screenshots this
set replaced promised regular expression rules over an interface that had none, which is worse than
no screenshot.
