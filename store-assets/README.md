# Store assets

Images for the Chrome Web Store and Microsoft Edge Add-ons listings. Nothing here is part of the
extension build: the packaged icons live in [../public/icons/](../public/icons/) and are copied
into `dist/` by Vite. The submission walkthroughs are in [../docs/PUBLISHING.md](../docs/PUBLISHING.md).

## Upload these

| File | Size | Where it goes |
|---|---|---|
| `small-promo-tile-440x280.png` | 440x280 | Chrome listing **required**, Edge optional |
| `marquee-promo-tile-1400x560.png` | 1400x560 | Chrome marquee placement, Edge "large promotional tile", both optional |
| `edge-store-logo-300x300.png` | 300x300 | Edge listing **required** (1:1, 300x300 recommended, 128x128 minimum). Chrome takes its icon from the package instead |

Table name: **store-upload-assets**

No screenshots exist in this repo (R-39); whether the live listing carries any from an earlier submission can only be seen in the dashboard. **Capture them at 1280x800**, which is the one size both
stores accept: Chrome takes 1280x800 or 640x400, Edge takes 1280x800 or 640x480. Chrome allows one
to five, Edge up to six.

## Requirements

Verified against [Chrome's image guidelines](https://developer.chrome.com/docs/webstore/images)
on 2026-09-02:

| Asset | Required size | Note |
|---|---|---|
| Extension icon | 128x128 PNG | Chrome asks that the **artwork occupy about 96x96** inside it, leaving a ~16px transparent margin, so icons look consistent beside each other |
| Screenshots | 1280x800 or 640x400 | 1 to 5, at least one required |
| Small promo tile | 440x280 | Required |
| Marquee promo tile | 1400x560 | Only needed for marquee placement |

Table name: **store-image-specs**

`public/icons/128.png` was regenerated for this on 2026-09-06 (R-36): the artwork is now 94x96
centred in the 128 canvas, as Chrome asks. `16.png` and `48.png` deliberately still fill their
canvases, because a margin at those sizes costs legibility for nothing.

## masters/

The original design exports, kept because the uploads above are derived from them and will need
regenerating if the branding changes. They are **not** upload-ready: they predate the size check
and are off-spec (1200x896 and 1632x656).

| File | Size | Derived upload |
|---|---|---|
| `small-promo-tile-source.png` | 1200x896 | `small-promo-tile-440x280.png` |
| `marquee-promo-tile-source.png` | 1632x656 | `marquee-promo-tile-1400x560.png` |
| `logo-source-497px.png` | 497x502 | `public/icons/128.png`, `public/icons/logo.png` and `edge-store-logo-300x300.png` |

Table name: **store-master-assets**

The two tiles were produced by cropping each master to its artwork plus a proportional margin,
expanding that crop to the target aspect ratio, and resizing with Lanczos. The composition is
unchanged; nothing was restyled. The marquee needed almost nothing (its source is 2.488:1 against
a required 2.5:1); the small tile is a tighter crop of a source that carried a lot of empty space.
A designer pass would still beat a mechanical crop, particularly for the small tile where the
feature list is close to its readable limit.

The Edge store logo is the master fitted to 300x300 on a transparent canvas
(`convert masters/logo-source-497px.png -resize 300x300 -background none -gravity center -extent
300x300 -strip edge-store-logo-300x300.png`), so it is the same artwork as the packaged icon at a
size the Edge listing accepts.
