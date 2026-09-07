# Publishing

How to get a build into each store. Chrome is live; Edge and Firefox are ROADMAP R-23.

Every store requirement below was read off the vendor's own documentation on **2026-09-07** and is
quoted with its source. Store consoles change; re-check the numbers before a submission rather
than trusting this file a year from now.

---

## 0. The package, for every store

```bash
npm run check          # typecheck + 304 tests, the same gate the pre-push hook runs
npm run build          # two passes: pages/worker, then the content script
cd dist && zip -r ../favicon-changer-ultimate-v1.4.3.zip . && cd ..
unzip -l favicon-changer-ultimate-v1.4.3.zip | tail -3   # sanity check the contents
```

The zip must contain `manifest.json` at its **root**, not inside a folder. Both Chrome and Edge
take this same MV3 package unchanged. Firefox needs two manifest lines changed first, see §3.

Version numbers live in `public/manifest.json` and are mirrored in `package.json`. A store will
reject a re-upload of a version it already has, so bump before resubmitting.

---

## 1. Chrome Web Store (live)

Listing: `egedbdckafdbomehjaihjhbcgmngmlah`. Upload the zip in the developer dashboard, keep the
privacy disclosures in step with [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md), publish. Review has
historically taken a few days. Screenshots are still outstanding (R-39).

---

## 2. Microsoft Edge Add-ons

Chromium, so **there is no code work.** This is a Partner Center submission and a second listing
to keep in step. Budget a day, plus up to seven business days of certification.

### 2.1 Register (once)

**There is no registration fee for the Microsoft Edge program.**

1. You need a **Microsoft account** (an outlook.com, live.com or hotmail.com address), or a
   GitHub account, which Partner Center will convert into one. **A work or school account is not
   supported**, so palaniappan.tn@goldsecure.com.au cannot be the primary owner.
2. Go to Partner Center, `https://partner.microsoft.com/dashboard/microsoftedge/public/login`, and
   fill in the **Microsoft Edge Developer Account Registration** form.
3. **Account country/region.** Read-only after enrolment. Choose carefully.
4. **Account type.** Cannot be changed after enrolment, and switching company to individual is
   not supported.

| Account type | Verification | Use it when |
|---|---|---|
| **Individual** | Shorter. Microsoft checks only that the publisher display name is available | You are publishing as yourself or an unincorporated group |
| **Company** | Longer, "a few days to a few weeks", with calls to a named company approver and legal documents such as a utility bill or DUNS ID | You need the listing to carry a **registered** business name |

Table name: **edge-account-types**

**Recommendation: Individual**, with `PalWorks` as the publisher display name if it is available.
It is the difference between hours and weeks, and the name shown to users is the same either way.
Choose Company only if the listing must legally read as the registered entity.

5. Accept the App Developer Agreement, click **Finish**, wait for the confirmation mail. You can
   prepare the whole submission while verification is pending.

### 2.2 Submit

Partner Center walks eight steps. The answers you need are drafted below; paste and edit.

**Step 3, upload.** Drag the zip from §0.

**Step 4, availability.** Visibility `Public`. Markets: leave at all markets, which matches the
Chrome listing.

**Step 5, properties.**

| Field | What to put |
|---|---|
| Category | Pick the same one the Chrome listing uses, so the two stores describe the product identically |
| Website | `https://github.com/PalWorks/favicon-changer` |
| Support contact detail | `support@palworks.ai` |
| Mature content | Leave unchecked |

Table name: **edge-properties**

**Step 6, privacy.** This is the step that decides how long certification takes, so it is worth
being precise. Every answer below is true of the shipped code; do not soften them.

*Single Purpose Description:*

> Replaces the favicon shown in the browser tab for websites the user chooses, using an emoji, an
> uploaded image, an image URL, or a text badge drawn over the site's own icon. Rules are matched
> per site by domain, exact URL, URL prefix or regular expression, and are stored on the user's own
> device.

*Permission justification:*

| Permission | Justification |
|---|---|
| `storage` | Stores the user's favicon rules, the global fallback icon, the exclusion list and the generated icon images locally with `chrome.storage.local`. There is no server and nothing is transmitted. |
| `scripting` | Re-injects the content script into an already open tab when rules change, so a new or edited rule applies without the user reloading the page. Used only through `chrome.scripting.executeScript` on tabs the user is acting on. |
| `host_permissions: <all_urls>` | The extension's single purpose is replacing a site's favicon, which requires reading and modifying the icon `<link>` elements in the page head on whichever sites the user chooses. The user decides which sites get a rule, and an exclusion list exists for sites to leave alone. No page content is read, stored or transmitted. |

Table name: **edge-permission-justifications**

*Are you using remote code?* **No, I am not using remote code.** True: MV3 forbids it, the CSP is
`script-src 'self'`, and nothing is eval'd or fetched as script. The three image fetches the
extension makes (an image URL the user typed, the current page's own favicon, and Google's public
favicon service on the settings page only) are images, not code, and all three are described in
the privacy policy.

*Data usage.* Tick **nothing** in "what user data do you plan to collect". No analytics, no
telemetry, no accounts, no server. Then tick the certification checkboxes.

*Privacy Policy URL.* Use the **same URL the Chrome listing uses** so the two cannot drift. It
must be reachable and current. [Unverified] the Chrome listing's exact value is not recorded in
this repo; read it off the Chrome dashboard rather than guessing.

**Step 7, store listing.** One `Details for <language>` page per language.

| Field | Required | Constraint | Ours |
|---|---|---|---|
| Extension name | For one language | Comes from the manifest, read-only here | Favicon Changer Ultimate |
| Description | **Each language** | **Minimum 250 characters**, maximum 10,000 | Draft below |
| Extension logo | **Each language** | 1:1, 300x300 recommended, 128x128 minimum | [`../store-assets/edge-store-logo-300x300.png`](../store-assets/edge-store-logo-300x300.png) |
| Small promotional tile | Optional | Exactly 440x280 | `../store-assets/small-promo-tile-440x280.png` |
| Large promotional tile | Optional | Exactly 1400x560 | `../store-assets/marquee-promo-tile-1400x560.png` |
| Screenshots | Optional | Up to 6, exactly 640x480 or 1280x800 | **Outstanding, R-39.** Capture at 1280x800, the one size Chrome and Edge both accept |
| Short description | For one language | Comes from the manifest `description`, read-only here | Already set |
| Search terms | Optional | Up to 7 terms, 21 words total, 30 characters each | favicon, favicon changer, custom favicon, tab icon, emoji favicon, site icon, tab organizer |

Table name: **edge-listing-fields**

*Description draft, 1,180 characters, comfortably over the 250 minimum:*

> Favicon Changer Ultimate replaces the icon in your browser tab for any site you choose, so a wall
> of identical tabs becomes something you can read at a glance.
>
> Pick an icon four ways: upload a PNG, JPEG, SVG or WebP with fit, fill or stretch framing; paste
> an image URL; choose an emoji from a searchable, categorised library rendered straight to an icon;
> or draw a text badge or colour wash over the site's own favicon.
>
> Target it four ways: a whole domain including its subdomains, one exact address, a URL prefix so
> one document keeps its icon across all its views, or a regular expression for anything else. Most
> specific rule wins. Prefix and regex rules are prefilled from the page you are on, and the editor
> shows how many of your open tabs a pattern would match before you save it. An exclusion list
> leaves chosen sites alone entirely.
>
> Everything happens on your device. There is no account, no server and no analytics of any kind:
> icons are generated in your browser and stored in local extension storage, automatically
> compressed to fit the quota. Rules export and import as JSON, and opt-in verbose logging can be
> downloaded and sent to support when something breaks.

**Step 8, certification notes.** Say what changed since the last version, and tell the tester how
to see it work in one line, for example: open the toolbar icon on any site, choose an emoji, press
Apply, and watch the tab icon change. Then **Publish**. Certification takes **up to seven business
days**.

### 2.3 What blocks an Edge submission today

Only the screenshots (R-39). Everything else in this section is ready.

---

## 3. Firefox (addons.mozilla.org)

Verified working on Firefox 154 by installing the built `dist/` over WebDriver BiDi and driving it
end to end. See ROADMAP R-23 for the measurements, table **r23-firefox-verified**.

### 3.1 The two manifest lines

Firefox MV3 has no `background.service_worker`, and AMO requires an add-on id:

```json
"background": { "scripts": ["background.js"], "type": "module" },
"browser_specific_settings": { "gecko": { "id": "favicon-changer-ultimate@palworks.ai", "strict_min_version": "128.0" } }
```

Implement as a **build target flag in `vite.config.ts`**, not a second `manifest.json` to keep in
sync by hand. `npm run build` keeps producing the Chrome package; a target flag produces the
Firefox one.

**`strict_min_version` is a claim, and 128.0 is not yet a tested one.** Either test the package on
128 ESR before claiming it, or claim `154.0`, which is what was actually verified, and lower it
later. Claiming a floor you have not run is how a one-star review arrives from a version you never
saw.

### 3.2 Host permissions: the risk is smaller than R-23 assumed

R-23 recorded "a signed AMO install may present `<all_urls>` as opt-in per site" as the largest
remaining risk. Mozilla's own MV3 migration guide says otherwise: **Firefox 127 and later show the
host permissions from `host_permissions` and `content_scripts` in the install prompt and grant them
on installation.** Users can still grant or revoke any host permission ad hoc afterwards.

So there is no per-site onboarding flow to build. What is left is smaller: the extension must
behave sanely on a host whose permission was revoked, where the content script simply does not run
and the favicon does not change. Worth a line of copy eventually, not a blocker.

### 3.3 Submitting

1. Create a **Mozilla account** and sign in to `addons.mozilla.org`. No fee.
2. Choose **listed on AMO** rather than self-distribution. Self-distribution needs an
   `update_url` in `browser_specific_settings` and gives up store discovery for nothing here.
3. Upload the Firefox zip. Accepted extensions are `.zip`, `.xpi` or `.crx`, up to 200 MB.
4. **You will have to submit source code.** AMO requires it when a submission contains minified
   or obfuscated code, and Vite minifies everything in `dist/`. Supply a source archive plus build
   instructions precise enough for a reviewer to reproduce the artefact:

   ```
   Node 22.x, npm 10.x
   npm ci
   npm run build      # output: dist/
   ```

   The repository is public, so this is a packaging chore rather than a disclosure.
5. Fill in the listing: name, URL slug, summary, description, up to **two** Firefox categories,
   support contact (`support@palworks.ai`), a **licence**, and a privacy policy.
6. Submit. Review then signing; Mozilla does not publish a typical review time, and a listed
   add-on can be reviewed again after publication.

### 3.4 The licence question AMO forces

There is **no `LICENSE` file in this repository**, and AMO makes you choose one at submission. In a
public repo with no licence, no rights are granted, which is legally clear and practically
confusing for anyone who reads the code.

| Option | Trade-off |
|---|---|
| **All Rights Reserved** | AMO offers it. Keeps the product proprietary, matches the current absence of a licence, and closes the door on outside contributions |
| MIT or Apache 2.0 | Invites contributions and reuse, including someone shipping a competing listing built from this code |
| GPL 3.0 | Permits reuse but requires derivatives stay open, which makes a competing closed fork harder |

Table name: **firefox-licence-options**

**Recommendation: All Rights Reserved on AMO, and add a matching `LICENSE` file to the repo** so
the two agree and readers are not left inferring. It is reversible in the permissive direction and
not in the other.

### 3.5 Still untested on Firefox

Each of these must be checked before a Firefox listing goes public, and none of them is code that
does not exist yet:

- **ADR-007**, the Linux file-dialog workaround. Firefox panel blur behaviour differs, so the
  `setPopup('')` trick may be unnecessary or may misbehave.
- **Canvas emoji rendering.** A different font stack, so glyphs will not match Chrome and may clip.
- **Popup sizing.** Firefox sizes its panel differently from Chrome's bubble.
- **AMO review** itself, and what it asks about `<all_urls>`.

---

## 4. Sequence, and what each store is waiting on

| Store | Waiting on | Effort left |
|---|---|---|
| Chrome | Screenshots (R-39) | S |
| Edge | Screenshots (R-39), and a Partner Center account | S, plus up to 7 business days of certification |
| Firefox | The manifest target flag, a source submission, a licence decision, and the four checks in §3.5 | A week, dominated by review rather than code |

Table name: **publishing-queue**

**Do Edge first.** It is the same package, the account is free, the listing copy is drafted above,
and it doubles the distribution channels for a day of form filling. Firefox is worth doing next,
and is far cheaper than this project assumed until it was measured, but it is still a week with a
store review inside it.

---

## Sources

Read on 2026-09-07:

- [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)
- [Firefox manifest v3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
- [Submitting an add-on to AMO](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Chrome Web Store image guidelines](https://developer.chrome.com/docs/webstore/images) (verified 2026-09-02, recorded in [../store-assets/README.md](../store-assets/README.md))
