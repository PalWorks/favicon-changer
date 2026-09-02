# Runbook

Triage for user-reported problems. There is no server, so "production" means an installed
extension on someone else's machine and the only telemetry is what the user sends you.

---

## First move, always: get the logs

Ask the user to:

1. Open the extension's **settings** page (right-click the toolbar icon → Options).
2. Scroll to **Debug Logs & Support** → **Show Logs** → turn on **Enable Verbose Logging**.
3. Reproduce the problem.
4. Click **Download** (or **Copy**) and send the file.

Logging is off by default and only `ERROR` reaches the console until it is on, so a log taken
*before* reproducing is worthless. Ask them to reproduce after enabling.

Prefixes tell you the context: `[Content]` = content script, `[BG]` = service worker,
unprefixed = popup or options page.

---

## "The favicon didn't change"

Work down this tree; each step is cheap and rules out a whole class.

| # | Check | Meaning if it matches |
|---|---|---|
| 1 | Is the site on **Excluded Sites** in settings? | Exclusion beats every rule, silently by design. Log line: `Domain is excluded`. |
| 2 | Is the URL `chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, or the Web Store? | Chrome forbids content scripts there. Unfixable, not a bug. |
| 3 | Is it a `file://` URL? | Needs **Allow access to file URLs** on the extension card. |
| 4 | Was the rule scoped **This Page Only**? | `exact_url` is byte-exact including `?query` and `#hash`. The single most common cause. Re-scope to **Entire Domain**. |
| 5 | Does a higher-precedence rule exist for the page? | `exact_url` > `regex` > `domain`. The popup shows an orange conflict banner for the domain case. Check the rules list in settings. |
| 6 | Two rules of the **same** type both match? | The oldest wins, not the most specific, a known defect. Delete the broader rule. |
| 7 | Was the tab open **before** the rule was created? | It should update without a reload. If it does not, get the `[Content]` logs, this is ADR-001 territory and a real bug. |
| 8 | Is a **global fallback favicon** set in settings? | It applies to every page with no matching rule, which users mistake for "the extension went rogue". |
| 9 | Did the icon change and then revert a second later? | The page is fighting us. Look for repeated `Detected external change, re-applying` lines. |

Table name: **favicon-not-changing-triage**

---

## "The upload does nothing" / "the window closed when I picked a file"

Almost always the OS popup-blur problem, see [DECISIONS.md](DECISIONS.md) ADR-007.

- Confirm the OS. On **Linux/ChromeOS/OpenBSD** clicking the toolbar icon should open a
  **standalone window**, and the upload button should read **Open**, not **Browse**.
- If they get the bubble instead, `configureActionForOS()` did not run, ask them to reload the
  extension at `chrome://extensions`, which restarts the service worker. Look for
  `[BG] linux: bubble disabled` in the logs.
- **Workaround to give them immediately**: drag the image file onto the upload box. Drag-and-drop
  opens no OS dialog and works everywhere.
- On Windows/macOS the bubble is expected and correct.

## "The image looks broken / blank after upload"

- File type must be PNG, JPEG, SVG or WebP, under 5 MB. ICO is **not** accepted.
- A favicon downloaded from a site and re-uploaded is the classic case: many sites serve SVG under
  a `.png` name. `normalizeImageDataUrl()` should repair it. If the log shows
  `Retrying image with corrected MIME type` followed by another failure, get the file.
- A transparent PNG previewed against the checkerboard is correct, not broken.

## "Badges don't work on this site"

The badge tool fetches the site's current favicon to composite onto. If the site has no favicon
at all, the preview never renders and **Apply silently does nothing**, a known UX defect. Tell
the user to set a base icon first (emoji or upload), then add the badge.

## "It slowed my browser down" / fan spinning on a site

Look for a rapid repeat of `[Content] Detected external change, re-applying`, a mutation war
with a page that reasserts its own icon. Get the URL; it needs a site-specific look. Immediate
mitigation for the user: add the domain to **Excluded Sites**.

## "All my rules disappeared"

- Check whether they are signed into a different Chrome profile, storage is per-profile and
  **not** synced across devices, by design (ADR-004).
- `chrome.storage.local` is cleared if the extension is removed and reinstalled.
- If rules exist but do not apply, it is a matching problem, not a storage problem, go back to
  the triage table.
- Recovery is only possible from a rules JSON they exported earlier. Encourage export as backup.

## "Storage full" error on save

`chrome.storage.local` quota is reached; every icon is stored inline as a data URL (ADR-004). The
error message already says to delete unused rules. Each rule is roughly 5 to 30 KB. Deleting a few
image-upload rules frees the most.

---

## What you cannot do

- There is no remote kill switch, no feature flags and no way to reach an installed copy. The only
  lever is publishing a new version, which reaches users over hours to a day.
- There is no crash reporting. If the React tree throws, the user sees the ErrorBoundary panel
  with a **Reload Extension** button and the stack is written to the log buffer, but only if
  verbose logging was already on.
- There is no way to see how many users hit a bug. Store reviews and ratings are the only signal.

---

## Escalation

A reproducible content-script failure on a named site is the highest-priority class: it is
user-visible, it looks like the extension is broken, and it is usually a real defect. Capture the
URL, the OS, the Chrome version and the `[Content]` log, then file it against
[../ROADMAP.md](../ROADMAP.md).
