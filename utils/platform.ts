import { POPUP_CLOSES_ON_FILE_DIALOG } from '../constants';

/**
 * True on OSes where Chrome destroys the toolbar action popup the moment a
 * native file dialog takes focus, which silently aborts uploads. See
 * docs/DECISIONS.md ADR-007 for the workaround this drives.
 *
 * Single source of truth for that verdict. It used to be decided twice, two
 * different ways: chrome.runtime.getPlatformInfo() in the service worker and a
 * navigator.userAgent regex in the editor UI, which could disagree and leave
 * the button label describing behaviour the service worker had not configured
 * (LIMITATIONS L-15).
 *
 * Returns false when the platform cannot be determined, which preserves the
 * nicer bubble behaviour. The only realistic case is dev mode (a plain page
 * with no chrome APIs), where there is no action popup to worry about.
 */
export const popupClosesOnFileDialog = async (): Promise<boolean> => {
    try {
        const { os } = await chrome.runtime.getPlatformInfo();
        return POPUP_CLOSES_ON_FILE_DIALOG.has(os);
    } catch (e) {
        return false;
    }
};
