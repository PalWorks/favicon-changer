# Privacy Policy for Favicon Changer Ultimate

**Last Updated: September 2, 2026**

## Introduction
Favicon Changer Ultimate ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how our browser extension handles your information.

## Data Collection and Usage
**We do not collect, store, or transmit any personal data, and we have no servers.**

- **Local Processing**: All favicon processing (compression, resizing, emoji rendering, badge and overlay generation) happens locally within your browser.
- **Storage**: Your custom rules and settings are stored in your browser's local storage (`chrome.storage.local`) on your device. This data is local-only and is not synced or sent anywhere.
- **No Analytics**: We do not use any analytics or tracking scripts.
- **Review prompt counter**: To decide whether to ask you once for a Chrome Web Store review, the
  extension keeps a count of how many separate days it has actually applied a favicon for you,
  plus the last such date and whether you have already answered. This is a number in your
  browser's local storage on your device. It is never sent anywhere, it records no addresses and
  no page information, and dismissing the prompt stops the counting for good.

## Network Requests
The extension makes no network requests of its own accord. There are exactly three cases in which your browser fetches something on the extension's behalf, all of them a direct result of something you did:

1. **A favicon image URL you entered.** If you set a favicon from an image URL (the "paste image URL" source, or the global fallback favicon setting), your browser fetches that image from the address you typed, every time the rule is applied. The request goes only to that address.
2. **The current page's own favicon.** When you use the Badge & Overlay tools, or export the original favicon, the extension fetches the favicon of the page you are on from that same site, so it can draw your badge on top of it. This request goes only to the site you are already visiting.
3. **Google's public favicon service, on the settings page only.** When you type a URL or domain into the rule editor on the extension's settings (options) page, the extension requests a preview icon for that domain from Google's public favicon endpoint (`https://www.google.com/s2/favicons?domain=<domain>`). This is done so the editor can show you which site you are about to configure.
   - **What is sent:** only the domain name you typed into that field, plus whatever your browser normally sends with an image request (such as your IP address and user agent). No rules, settings, page contents, browsing history, or personal data are included.
   - **When:** only while the settings page is open and only for text you type into that one field. This never happens in the toolbar popup, and never while you browse.
   - **Who receives it:** Google, under [Google's Privacy Policy](https://policies.google.com/privacy). We receive nothing.
   - **Avoiding it:** create your rules from the toolbar popup instead of the settings page, and no request to Google is made.

## Permissions
The extension requests the minimum permissions needed to function:
- **Storage**: To save your favicon rules and settings on your device.
- **Scripting**: To inject the new favicon into a page when the page's content script needs to be (re)loaded.
- **Host Permissions (`<all_urls>`)**: Required to read the current page and apply favicon changes on any website you visit. This is core to the extension's single purpose, changing favicons.

## Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be posted on this page.

## Contact
If you have any questions about this Privacy Policy, email **support@palworks.ai**, or use the
Chrome Web Store support page. Security reports go to the same address; see
[docs/SECURITY.md](docs/SECURITY.md).
