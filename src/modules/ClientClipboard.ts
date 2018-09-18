declare global {
    // tslint:disable-next-line:interface-name
    interface Window {
        /**
         * A IE-specific API for accessing the user's clipboard
         */
        clipboardData: IClipboardData;
    }
    // tslint:disable-next-line:interface-name
    interface Navigator {
        /**
         * A new promise-based API for accessing the user's clipboard
         */
        clipboard: IClipboardApi;
    }
}
interface IClipboardData {
    setData: (type: string, value: any) => void;
}
interface IClipboardApi {
    writeText: (text: string) => Promise<void>;
}

/**Copy text into the user's cliplboard
 * @param text The text to copy into the user's clipboard
 * @link Solution taken from https://stackoverflow.com/a/30810322/7077589
 */
export function copyTextToClipboard(text: string): void {
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else if (window.clipboardData && window.clipboardData.setData) {
        // IE specific code path to prevent textarea being shown while dialog is visible.
        window.clipboardData.setData("Text", text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (err) {
            console.error("Fallback: Oops, unable to copy", err);
        }

        document.body.removeChild(textArea);
    }
}
