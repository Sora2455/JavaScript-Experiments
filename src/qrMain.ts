import {copyTextToClipboard} from "./modules/ClientClipboard.js";
import {ReadyManager} from "./modules/readyManager.js";

/**
 * Returns the equivalent of 1rem in px
 */
function getRootElementFontSize(): number {
    if (typeof getComputedStyle !== "function") {
        return 16;
    }
    // returns a number
    return parseFloat(
        // of the computed font-size, so in px
        getComputedStyle(
            // for the root <html> element
            document.documentElement
        ).fontSize
    );
}

interface IHtOption {
    [key: string]: string | number | boolean | QRErrorCorrectLevel; // index defintion
    text?: string;
    colorLight: string;
    colorDark: string;
    typeNumber: number;
    correctLevel: QRErrorCorrectLevel;
    useSVG?: boolean;
}

interface IQRCodeModel {
    modules: boolean[][];
    moduleCount: number;
}

enum QRErrorCorrectLevel {
    L = 1,
    M = 0,
    Q = 3,
    H = 2
}

class TableDrawer {
    private static isDark(row: number, col: number, model: IQRCodeModel): boolean {
        if (row < 0 || model.moduleCount <= row || col < 0 || model.moduleCount <= col) {
            throw new Error(row + "," + col);
        }
        return model.modules[row][col];
    }
    private el: HTMLElement;
    private htOption: IHtOption;

    constructor(el: HTMLElement, htOption: IHtOption) {
        this.el = el;
        this.htOption = htOption;
    }

    /**
     * Draw the QRCode
     * @param {QRCode} oQRCode
     */
    public draw(oQRCode: IQRCodeModel): void {
        const nCount = oQRCode.moduleCount;

        // empty element first
        this.clear();

        const table: HTMLTableElement = document.createElement("table");
        table.style.border = "0";
        table.style.borderCollapse = "collapse";
        table.style.tableLayout = "fixed";
        table.style.width = table.style.height = "100%";
        table.setAttribute("aria-hidden", "true");

        for (let row = 0; row < nCount; row++) {
            const rowEl = document.createElement("tr");
            for (let col = 0; col < nCount; col++) {
                const cell = document.createElement("td");
                if (TableDrawer.isDark(row, col, oQRCode)) {
                    cell.setAttribute("class", "b");
                }
                rowEl.appendChild(cell);
            }
            table.appendChild(rowEl);
        }
        this.el.appendChild(table);
    }

    /**
     * Clear the QRCode
     */
    public clear(): void {
        while (this.el.hasChildNodes()) {
            this.el.removeChild(this.el.firstChild);
        }
    }
}

new ReadyManager().whenReady(() => {
    const QRCodeInput = document.getElementById("QRCodeInput") as HTMLInputElement;
    const QRCodeResult = document.getElementById("QRCodeResult") as HTMLDivElement;
    if (QRCodeInput && QRCodeResult) {
        const urlInputValue = new URL(location.href).searchParams.get("QRCode");
        if (urlInputValue) {
            // Fallback was used - handle as gracefully as we can
            QRCodeInput.value = urlInputValue;
            const qrCodeImage = document.createElement("img");
            qrCodeImage.src = "qrCode.png";
            qrCodeImage.alt = `The QR Code for the value '${urlInputValue}'`;
            qrCodeImage.title = urlInputValue;
            qrCodeImage.height = 360;
            qrCodeImage.width = 360;
            QRCodeResult.parentElement.insertAdjacentElement("beforeend", qrCodeImage);
        }
        const htOption = {
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRErrorCorrectLevel.H,
            typeNumber: 4
        } as IHtOption;
        const drawer = new TableDrawer(QRCodeResult, htOption);
        const qrCodeWorker = new Worker("workers/QRCodeRenderer.js", {
            type: "module"
        });
        let lastQrValue = QRCodeInput.value;
        if (QRCodeInput.value) {
            QRCodeResult.title = QRCodeInput.value;
            QRCodeResult.setAttribute("aria-label", `The QR Code for the value '${QRCodeInput.value}'`);
            qrCodeWorker.postMessage([QRCodeInput.value, htOption]);
        } else {
            QRCodeResult.setAttribute("aria-label", "A blank QR Code");
        }
        const onChange = () => {
            // Don't do anything if the value hasn't changed
            if (QRCodeInput.value === lastQrValue) { return; }
            lastQrValue = QRCodeInput.value;
            if (QRCodeInput.value) {
                QRCodeResult.title = QRCodeInput.value;
                QRCodeResult.setAttribute("aria-label", `The QR Code for the value '${QRCodeInput.value}'`);
                qrCodeWorker.postMessage([QRCodeInput.value, htOption]);
            } else {
                QRCodeResult.title = "";
                QRCodeResult.setAttribute("aria-label", "A blank QR Code");
                drawer.clear();
            }
        };
        const replaceServerGenerationWithClientSide = () => {
            QRCodeInput.oninput = onChange;
            QRCodeInput.onchange = onChange;
            QRCodeResult.onclick = () => {
                copyTextToClipboard(QRCodeInput.value);
            };
            const twentyRem = (20 * getRootElementFontSize()).toString() + "px";
            QRCodeResult.style.width = QRCodeResult.style.height = twentyRem;
            // let screen readers know this is an image
            QRCodeResult.setAttribute("role", "img");
    
            // hide the generate button
            document.getElementById("QRCodeGenerate").style.display = "none";
            // don't reload the iFrame on form submission (like the enter key, for example)
            document.getElementById("QRCodeFrom").onsubmit = () => {
                return false;
            };
        };

        qrCodeWorker.onmessage = (ev: MessageEvent<IQRCodeModel | "polo">) => {
            if (ev.data === "polo") {
                // The worker's confirmed that its ready, set everything up
                replaceServerGenerationWithClientSide();
            } else {
                drawer.draw(ev.data);
            }
        };
        qrCodeWorker.postMessage("marco");
    }
});
