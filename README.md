# Favicon Changer

Customize favicons for any website with AI, Emojis, or Uploads. Make your browser tabs organized and personalized.

## Features

- **🎨 Custom Uploads**: Upload any image (PNG, JPEG, SVG, WebP) to use as a favicon.
- **⚡ Auto-Compression**: Images are automatically optimized to ensure fast loading and sync.
- **🛡️ Validation**: Smart checks prevent invalid files or URLs from breaking your experience.
- **🏷️ Badges**: Add custom text badges to your favicons with configurable colors.
- **🤖 AI Generation**: (Coming Soon) Generate unique icons using AI.
- **😀 Emoji Support**: Use any emoji as a favicon.
- **🔄 Sync**: Rules are synced across your devices (if enabled).

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

We respect your privacy. This extension runs entirely locally on your device. No browsing data is sent to external servers. See our [Privacy Policy](PRIVACY_POLICY.md) for details.

## Development

1.  Clone this repository.
2.  Run `npm install`.
3.  Run `npm run dev` for hot reload.
4.  Run `npm run build` for production.

## Permissions

-   `storage`: To save your custom rules.
-   `activeTab` & `scripting`: To change the favicon on the current tab.
-   `downloads`: To export your rules.
-   `<all_urls>`: To allow changing favicons on any website you visit.

## License

MIT
