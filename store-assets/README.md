# Store assets

Images for the Chrome Web Store listing. Nothing here is part of the extension build: the
packaged icons live in [../public/icons/](../public/icons/) and are copied into `dist/` by Vite.

## Upload these

| File | Size | Where it goes |
|---|---|---|
| `small-promo-tile-440x280.png` | 440x280 | Store listing, **required** |
| `marquee-promo-tile-1400x560.png` | 1400x560 | Marquee placement, optional |

Table name: **store-upload-assets**

Screenshots still need producing at 1280x800 or 640x400, minimum one and maximum five.

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

Our `public/icons/128.png` is a correct 128x128 but its artwork fills roughly 122x122, well
beyond the suggested 96x96. That is a branding call rather than a rejection risk; tracked as
ROADMAP R-36.

## masters/

The original design exports, kept because the uploads above are derived from them and will need
regenerating if the branding changes. They are **not** upload-ready: they predate the size check
and are off-spec (1200x896 and 1632x656).

| File | Size | Derived upload |
|---|---|---|
| `small-promo-tile-source.png` | 1200x896 | `small-promo-tile-440x280.png` |
| `marquee-promo-tile-source.png` | 1632x656 | `marquee-promo-tile-1400x560.png` |
| `logo-source-497px.png` | 497x502 | `public/icons/128.png` and `public/icons/logo.png` |

Table name: **store-master-assets**

The two tiles were produced by cropping each master to its artwork plus a proportional margin,
expanding that crop to the target aspect ratio, and resizing with Lanczos. The composition is
unchanged; nothing was restyled. The marquee needed almost nothing (its source is 2.488:1 against
a required 2.5:1); the small tile is a tighter crop of a source that carried a lot of empty space.
A designer pass would still beat a mechanical crop, particularly for the small tile where the
feature list is close to its readable limit.
