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
| 5 | Does a higher-precedence rule exist for the page? | `exact_url` > `prefix` > `regex` > `domain`, and within one type the longer matcher wins (ADR-013). The editor shows an orange conflict banner before the save, and the save itself now says "another rule wins on this page" afterwards. Check the rules list in settings. |
| 6 | Two rules of the **same** type both match? | The longer, more specific matcher wins (R-04). Two rules with the *identical* type and matcher can no longer exist: a save collapses them (ADR-020). A pair from an older build is repaired the next time either is saved. |
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

## "It says it saved but the icon did not change"

Since 1.4.4 the save reports what the page actually did, so the message *is* the triage. In order
of what it can say:

| Message | Meaning |
|---|---|
| Favicon updated successfully | The page confirmed it applied that exact rule. If the tab strip still looks wrong, it is a rendering question, not a rule question: go to the table above, item 9. |
| ...is on your excluded list | Exclusion beats every rule. The message carries a button to remove it. |
| ...another rule wins on... | A different rule owns that page. The rules list in settings shows which. |
| ...did not confirm the change | We got no answer from the page. Usually a tab open since before an update (reload it), a busy page (the message corrects itself if the page frees up), or a page we may not script. |
| ...will apply the next time you open a matching page | No matching tab was open, so nothing could be checked. Not an error. |
| ...that image address did not load | A pasted `https:` image address that does not resolve. An `http:` address is never probed at all and cannot be previewed either, see L-37. |
| ...starts with http and ... is a secure page | The rule's icon address is plain `http:` and it was saved for an `https:` page. Chrome upgrades the request and never fetches it, so nothing changes there. An https address, or an upload, fixes it. The same address does work on an `http:` page, and then the confirmation carries a note rather than a warning (R-63). |
| ...reports that no rule matches it / showing your fallback icon | The rule was saved but does not cover the page it was made for. Check the pattern. |

Table name: **runbook-save-messages**

## "Badges don't work on this site"

The badge tool fetches the site's current favicon to composite onto. If the site has no favicon
at all, the preview never renders and **Apply silently does nothing**, a known UX defect. Tell
the user to set a base icon first (emoji or upload), then add the badge.

## "It slowed my browser down" / fan spinning on a site

Look for a rapid repeat of `[Content] Detected external change, re-applying`, a mutation war
with a page that reasserts its own icon. Get the URL; it needs a site-specific look. Immediate
mitigation for the user: add the domain to **Excluded Sites**.

## "All my rules disappeared" or "the rule I just made is not there"

- **One rule missing rather than all of them** was a real defect until 1.4.4. Two storage writes
  at once lost one of them outright, reachable by clicking twice quickly or by having the popup
  and the settings page open together. Fixed by ADR-020; if a report predates 1.4.4, this is very
  likely the cause and the answer is to update and re-create the rule. A residual cross-context
  window remains (L-38) and needs two surfaces and two actions in the same instant.
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
