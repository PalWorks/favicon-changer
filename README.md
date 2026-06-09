# Favicon Changer Ultimate

Customize favicons for any website with emojis, image uploads, or badges & overlays. Make your browser tabs organized and personalized.

## Features

- **🎨 Custom Uploads**: Upload any image (PNG, JPEG, SVG, WebP) to use as a favicon.
- **⚡ Auto-Compression**: Images are automatically optimized to stay within storage limits.
- **🛡️ Validation**: Smart checks prevent invalid files or URLs from breaking your experience.
- **🏷️ Badges & Overlays**: Add custom text badges or color overlays to your favicons.
- **😀 Emoji Support**: Use any emoji as a favicon.
- **📂 Per-Site Rules**: Match by exact URL, whole domain, or regex; exclude sites you want left alone.
- **🔁 Import / Export**: Back up and share your rules as JSON.

## Installation

1. Install from the [Chrome Web Store](https://chrome.google.com/webstore/detail/your-extension-id).
2. Pin the extension to your toolbar.
3. Click the icon to start customizing!

## Usage

1. **Open the Popup**: Click the extension icon on any page.
2. **Choose Source**:
   - **Upload**: Select an image file.
   - **Emoji**: Pick an emoji.
   - **Badge**: Create a text badge on top of the current icon.
3. **Apply**: Click "Apply" to change the favicon instantly.
4. **Manage Rules**: Right-click the extension and select "Options" to manage all your saved rules.

## Privacy Policy

We respect your privacy. Favicon processing happens entirely locally on your device, and your rules and settings are stored in `chrome.storage.local` (they never leave your device). See our [Privacy Policy](PRIVACY_POLICY.md) for details.

## Development

1.  Clone this repository.
2.  Run `npm install`.
3.  Run `npm run dev` for hot reload.
4.  Run `npm run build` for production.

## Permissions

-   `storage`: To save your custom rules and settings.
-   `scripting`: To inject the favicon into pages when needed.
-   `<all_urls>` (host permission): To apply favicons on any website you visit.

## License

MIT
