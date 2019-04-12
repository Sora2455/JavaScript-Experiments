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
                cell.style.backgroundColor = TableDrawer.isDark(row, col, oQRCode) ?
                    this.htOption.colorDark : this.htOption.colorLight;
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
        const htOption = {
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRErrorCorrectLevel.H,
            typeNumber: 4
        } as IHtOption;
        const drawer = new TableDrawer(QRCodeResult, htOption);
        const qrCodeWorker = new Worker("workers/QRCodeRenderer.min.js");
        qrCodeWorker.onmessage = (ev) => {
            const qrCode = ev.data as IQRCodeModel;
            drawer.draw(qrCode);
        };
        if (QRCodeInput.value) {
            QRCodeResult.title = QRCodeInput.value;
            QRCodeResult.setAttribute("aria-label", `The QR Code for the value '${QRCodeInput.value}'`);
            qrCodeWorker.postMessage([QRCodeInput.value, htOption]);
        } else {
            QRCodeResult.setAttribute("aria-label", "A blank QR Code");
        }
        const onChange = () => {
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
    }
});
