/**Copy text into the user's cliplboard
 * @param text The text to copy into the user's clipboard
 * @link Solution taken from https://stackoverflow.com/a/30810322/7077589
 */
export function copyTextToClipboard(text: string): void {
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(textArea);
        }
    }
}
