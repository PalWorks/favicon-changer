# Favicon Changer

**Favicon Changer** is a powerful Chrome extension that allows you to customize favicons for any website. Whether you want to organize your tabs with emojis, upload your own images, or create custom badges, this extension gives you full control.

## Features

-   **Upload Custom Images:** Use any image from your computer as a favicon.
-   **Emoji Favicons:** Choose from a vast library of emojis to use as tab icons.
-   **Badge & Overlay Editor:** Add notification badges or color overlays to existing favicons.
-   **AI Generation:** (Coming Soon) Generate custom favicons using AI.
-   **Rule Management:** Create rules for specific URLs or entire domains.
-   **Import/Export:** Backup and share your favicon rules.

## Installation

1.  Clone this repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run build` to build the extension.
4.  Open Chrome and navigate to `chrome://extensions`.
5.  Enable **Developer mode** (top right).
6.  Click **Load unpacked** and select the `dist` folder from the project directory.

## Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run in development mode (hot reload):
    ```bash
    npm run dev
    ```

3.  Build for production:
    ```bash
    npm run build
    ```

## Permissions

This extension requires the following permissions:
-   `storage`: To save your custom rules.
-   `activeTab` & `scripting`: To change the favicon on the current tab.
-   `downloads`: To export your rules.
-   `<all_urls>`: To allow changing favicons on any website you visit.

## License

MIT
