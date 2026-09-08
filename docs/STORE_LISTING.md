# Chrome Web Store listing: every field, with the text to paste

Copy-paste content for the Chrome Web Store dashboard, field by field. Written for the **1.4.4**
upload against the existing item `egedbdckafdbomehjaihjhbcgmngmlah`.

Field names, limits and asset sizes were read off Google's own documentation on **2026-09-07**
and are cited below. Character counts in this file are **measured**, not estimated. The live
listing's current values were read off the public listing page on the same day.

Submission steps live in [PUBLISHING.md](PUBLISHING.md) §1; this file is only the content.

> **Status, 2026-09-08: 1.4.4 is published and live.** It passed review with the data usage
> disclosures submitted as recorded in §2, **Web history left unchecked**, so that answer is now a
> precedent as well as a decision. This file stands as the record of what was sent and as the
> source for the next submission.

---

## 0. What the live listing says today

| Field | Live value, read 2026-09-08 |
|---|---|
| Name | Favicon Changer Ultimate |
| Summary | Customize any site's favicon with emojis, image uploads, or badges & overlays. Per-site rules, local processing, no tracking. |
| Category | Developer Tools |
| Version | **1.4.4**, last updated **8 September 2026** |
| Package size the store reports | 165KiB |
| Users / rating | 1,000 users, 4.5 from 8 ratings |
| Screenshots | **3, all 1280x800**, and they show the 1.3.0 interface. Five replacements are ready in [../store-assets/screenshots/](../store-assets/screenshots/) |
| Language | English (United States) |
| Privacy policy | `https://github.com/PalWorks/favicon-changer/blob/main/PRIVACY_POLICY.md` |
| Developer | Palaniappan Meyyappan (palworks.ai), trader status declared |

Table name: **listing-current**

Read off the public listing page over the DevTools protocol, not from memory. The rating and the
screenshot count come from the page's own `aria-label` and `alt` text rather than from its layout,
because the carousel repeats each image and counting `<img>` elements gives seven for three
screenshots.

**So the store is five versions behind the code:** 1.4.0, 1.4.1, 1.4.2, 1.4.3 and 1.4.4 are all
unpublished at the time this file was written. **1.4.4 shipped all five on 2026-09-08**, so the
store and the code are level again for the first time since June.

---

## 1. Store listing tab

### Name

Comes from `public/manifest.json`, not from the dashboard. **Maximum 75 characters**, quoted from
Chrome's manifest reference: "a short, plain text string (maximum of 75 characters) that
identifies the extension".

```
Favicon Changer Ultimate
```

24 characters. **No change recommended.** It is the name 1,000 people already have installed.

### Summary (the short description)

Also from the manifest's `description` key, which Chrome documents as "no more than 132
characters". Shown under the name in the store and on `chrome://extensions`.

```
Customize any site's favicon with emojis, image uploads, or badges & overlays. Per-site rules, local processing, no tracking.
```

125 characters, inside the 132 limit. **No change recommended:** it is accurate for 1.4.4, it
fits, and rewriting a live summary re-enters search indexing for no gain.

### Detailed description

Required. Chrome's current dashboard documentation states no character limit for this field, only
that it must comply with the keyword spam policy, so this draft is written for a reader rather
than for a length. Plain text, no markup: the store renders line breaks and nothing else.

```
Favicon Changer Ultimate replaces the icon in your browser tab for any site you choose, so a wall of identical tabs becomes something you can read at a glance.

FOUR WAYS TO MAKE AN ICON

Upload a PNG, JPEG, SVG or WebP, with fit, fill or stretch framing.
Paste an image address.
Choose an emoji from a searchable, categorised library, rendered straight to an icon.
Draw a text badge or a colour wash over the site's own favicon.

FOUR WAYS TO CHOOSE WHERE IT APPLIES

An entire domain, subdomains included.
One exact address, query string and all.
A URL prefix, so one document keeps its icon across every view of it.
A regular expression, for everything else.

The most specific rule wins. Prefix and regular expression rules are prefilled from the page you are on, and the editor shows how many of your open tabs a pattern would match before you save it. If another rule already wins on that page, the editor says so and offers to edit that one instead. An exclusion list leaves chosen sites completely alone.

IT TELLS YOU WHAT ACTUALLY HAPPENED

When you save a rule, the extension asks the page what it did and reports that, instead of assuming. If the icon did not change, it tells you why: the site is on your exclusion list, another rule wins there, the image address does not load, or that tab needs a reload.

EVERYTHING STAYS ON YOUR DEVICE

No account, no server, and no analytics of any kind. Icons are generated in your browser and stored in local extension storage, compressed automatically to fit the quota. Your rules are never synced and never sent anywhere. Export and import them as JSON whenever you like.

Open tabs update the moment you save, including tabs sitting in the background, without a reload.

Built for people who keep a lot of tabs open: separate your work and personal mail, tell three environments of the same app apart, or mark the one document you keep losing.

Questions or problems: support@palworks.ai. Verbose logging can be switched on in settings and downloaded, so a bug report can start with evidence instead of guesswork.
```

2,070 characters over 31 lines.

**One deliberate omission.** Nothing in this copy mentions the extension being free, being
lightweight, or being the best, and no keyword is repeated for search. That is the keyword spam
policy, and it is also why the copy leads with what the thing does.

### Primary category

Required. Live value: **Developer Tools**.

| Option | Case for it |
|---|---|
| **Developer Tools** (current) | Where the 1,000 existing users found it, and genuinely where its power users are: telling three deploys of one app apart is a developer problem, and the extension accepts `localhost:3000` and regular expressions for exactly that reason |
| Functionality & UI | Arguably the better literal fit for "changes how tabs look", and a wider audience |

Table name: **listing-category-options**

**Recommendation: leave it on Developer Tools for this upload.** Changing the category on a live
item changes which store surfaces it appears in, and doing it in the same release as five
versions' worth of code changes means you cannot tell which change moved the numbers. If you want
to test Functionality & UI, do it as its own change a few weeks after this one.

### Language

Required. Live value: **English (United States)**. Keep. The extension has no `_locales` and every
string is English (ADR-018, R-22 paused), so any other language claim would be false.

### Graphic assets

| Asset | Requirement, quoted from Chrome's docs | What to use |
|---|---|---|
| Store icon | "128x128 px" | Taken from the uploaded package: `icons/128.png`, verified genuinely 128x128 (R-12) |
| Screenshots | "At least one 1280x800 px screenshot, up to 5 total" | Five, in [../store-assets/screenshots/](../store-assets/screenshots/), 24-bit PNG with no alpha. Upload all five |
| Small promo tile | "440x280 px" | `store-assets/small-promo-tile-440x280.png` |
| Marquee promo tile | Optional, "1400x560 px" | `store-assets/marquee-promo-tile-1400x560.png` |
| YouTube video | Optional | None. Leave empty |

Table name: **listing-assets**

**Screenshots, and what to do with the three already on the listing.** The item carries three,
read off the public page on 2026-09-08, and all three show the 1.3.0 interface: two scope buttons
where the product now has four, emoji glyphs 1.4.4 replaced, and one caption promising regular
expression rules over an interface that has none. Replace all three. Upload these five in order:

| # | File | What it shows |
|---|---|---|
| 1 | `01-tab-icons.png` | A real window of tabs carrying custom icons, with the tab strip magnified and labelled |
| 2 | `02-match-scopes.png` | The four-way scope selector with the live open-tab match count |
| 3 | `03-emoji-library.png` | The emoji picker |
| 4 | `04-badges.png` | A badge composited over a site's real favicon |
| 5 | `05-rule-manager.png` | The settings page: rule list, exclusions, storage, import and export |

Table name: **listing-screenshots**

How they were captured, and how to redo them, is in
[../store-assets/screenshots/README.md](../store-assets/screenshots/README.md). The dashboard
replaces screenshots one at a time; delete the three old ones after the new ones are in, so the
listing is never left with none.

### URLs

| Field | Value |
|---|---|
| Homepage URL | `https://github.com/PalWorks/favicon-changer` |
| Support URL | `https://github.com/PalWorks/favicon-changer/issues` |
| Official URL | Only fillable if `palworks.ai` is already verified in Google Search Console. Leave empty if it is not; the field is optional and adds nothing but a verified badge |
| Mature content | Leave unchecked |

Table name: **listing-urls**

A support **address** already exists (`support@palworks.ai`, ADR-017) and the extension composes a
prefilled mail to it from the settings page. The Support URL above is offered because the store
field wants a URL rather than an address; if you would rather not point users at GitHub issues,
leave it empty and the store falls back to the developer contact address.

---

## 2. Privacy tab

Nothing the extension handles changed in 1.4.4, so the answers already on file from 1.3.0 were
left untouched and **1.4.4 passed review with them**. The text below is what they should say, so
the next submission can be checked against it rather than retyped.

### Single purpose description

```
Favicon Changer Ultimate replaces the favicon shown in the browser tab for websites the user chooses. The replacement icon is an emoji, an uploaded image, an image address the user provides, or a text badge or colour wash drawn over the site's own icon. Rules are matched per site by domain, exact URL, URL prefix or regular expression, and both the rules and the generated icons are stored on the user's own device.
```

416 characters.

### Permission justifications

One is required for every permission in the manifest. The manifest declares exactly three.

| Permission | Justification to paste |
|---|---|
| `storage` | Stores the user's favicon rules, the global fallback icon, the exclusion list and the generated icon images locally through chrome.storage.local. There is no server and none of it is transmitted. |
| `scripting` | Re-injects the content script into a tab that is already open when rules change, so a new or edited rule applies without the user reloading the page. Used only through chrome.scripting.executeScript, and only on the tab the user is acting on. |
| Host permissions (`<all_urls>`) | The extension's single purpose is replacing a site's favicon, which requires reading and modifying the icon link elements in the page head on whichever sites the user chooses. The user decides which sites get a rule, and an exclusion list exists for sites to leave alone. Page content is not read, stored or transmitted. |

Table name: **listing-permissions**

**Why `<all_urls>` rather than `activeTab`:** a rule has to keep working in a tab the user is not
looking at, and `activeTab` only grants access on a click. This answer is worth having ready,
because it is the one reviewers push back on.

### Remote code

**Answer: No, I am not using remote code.**

True and checkable: `public/manifest.json` sets `script-src 'self'`, the build bundles everything
including the emoji library (which is a TypeScript array precisely so that it is not fetched), and
Manifest V3 forbids remotely hosted code in any case.

### Data usage disclosures

This is a judgment call you certify, so here is the ground truth and then the call that was
made.

Google's user data FAQ states plainly: "Extensions are required to disclose how they handle user
data, even when data is processed or stored locally on a user's device and is not transmitted to
external servers or third parties." So "we never send anything" is **not** by itself a reason to
leave every box unchecked.

What the extension actually holds, all of it in `chrome.storage.local` on the device:

| What | Contains | Leaves the device? |
|---|---|---|
| Rules | A matcher the user chose (a domain, an exact address, a prefix or a regular expression) and an icon, normally generated locally as an inline image | No. Except that a rule whose icon is an address the user typed causes the browser to fetch that address when the rule applies |
| Badge and overlay rules | Additionally, a copy of the site's own favicon image, as the base the badge is drawn on | No |
| Settings | The fallback icon address and the exclusion list of hostnames | No |
| Review prompt counter | A count of days on which a rule was applied, the last such date, and whether the user has answered | No |
| Debug logs | Off by default. When switched on, log lines that include the addresses of pages visited while it ran | No, unless the user downloads them and attaches them to a mail themselves |

Table name: **listing-data-held**

And the three cases where something does leave, all enumerated in
[../PRIVACY_POLICY.md](../PRIVACY_POLICY.md): a fetch of an image address the user typed, a fetch
of the current page's own icon, and, **on the settings page only**, a request to Google's public
favicon service carrying the domain the user typed into the rule editor.

**Decision, 2026-09-07: every data-type box left unchecked, Web history among them.** That is how
1.4.4 was submitted. The reasoning is kept below because the same call has to be made again on the
next submission, and because a reviewer may ask for it.

- **The case for leaving Web history unchecked:** the extension records no history of anything. It
  stores a configuration the user authored. A list of sites someone chose to give an icon is not a
  record of where they have been, any more than a bookmark folder is.
- **The case for checking it:** the stored matchers are domains and addresses, the opt-in debug log
  does contain addresses of pages visited while it ran, and the settings-page preview does send one
  typed domain to Google. Google's definition of collection is broad and explicitly covers local
  handling.

**The ground for the decision taken:** the privacy policy already describes every one of those
items explicitly and in more depth than a checkbox can, which is what the disclosure requirement is
actually for, and it matches what the live listing already declares. Checking Web history remains
defensible on the debug-log and favicon-preview grounds, and would cost a line of small print and
nothing else, so it stays the fallback if a reviewer disagrees.

**If review pushes back on this specific answer**, the options are: tick **Web history** and
resubmit the same package with no code change, which is the cheapest fix and the one to take; or
argue the current answer with the policy as evidence, which costs another review cycle and may not
land; or remove the two features that make the argument arguable, the opt-in debug log's page
addresses and the settings-page favicon preview, which is a real product loss for a paperwork
problem. **Recommendation: tick the box and resubmit.**

### Certifications

Tick all three. Each is true of the shipped code:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

There is no analytics, no telemetry, no error reporting and no outbound ping of any kind in this
codebase, and AGENTS.md hard rule 6 exists to keep it that way.

### Privacy policy URL

```
https://github.com/PalWorks/favicon-changer/blob/main/PRIVACY_POLICY.md
```

Already the live value. **It must be pushed before you submit**, because the 1.4.4 policy adds one
sentence: the image address you paste is now also fetched once when the rule is saved, so the
extension can tell you whether it loads. Same address, same request, no new destination.

---

## 3. Distribution tab

| Field | Value |
|---|---|
| Visibility | Public |
| Distribution | All regions. The dashboard already shows the item published in all countries |
| Pricing | Free |
| Trader status | Already declared. Leave as is |

Table name: **listing-distribution**

---

## 4. Release notes for 1.4.4

The dashboard's release notes field is short and users read it in the "What's new" panel. Full
detail is in [../CHANGELOG.md](../CHANGELOG.md).

```
Fixed: a rule could go missing when two were saved at almost the same moment, and saving a rule could undo a settings change made a moment earlier.
Fixed: two rules for the same site no longer compete, and the newest one wins.
Fixed: "This Page Only" now completes a site name into a full address instead of saving a rule that could never match.
Changed: saving a rule now tells you what actually happened. It confirms the change only when the page confirms it, and otherwise says why the icon did not change, such as the site being on your exclusion list.
Changed: a long rule pattern no longer fills the popup and hides the button underneath it.
Changed: interface icons are drawn rather than typed as emoji, so they look the same on every system and read correctly in a screen reader.
```

787 characters.

---

## Sources

- Store listing fields and asset sizes: `https://developer.chrome.com/docs/webstore/cws-dashboard-listing`
- Image requirements: `https://developer.chrome.com/docs/webstore/images`
- Privacy tab fields: `https://developer.chrome.com/docs/webstore/cws-dashboard-privacy`
- Name limit: `https://developer.chrome.com/docs/extensions/reference/manifest/name`
- Description limit: `https://developer.chrome.com/docs/extensions/reference/manifest/description`
- Local-handling disclosure requirement: `https://developer.chrome.com/docs/webstore/program-policies/user-data-faq`

All read 2026-09-07. Store consoles and policies change; re-read them before a submission rather
than trusting this file a year from now.
