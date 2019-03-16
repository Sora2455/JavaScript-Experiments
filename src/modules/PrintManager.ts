export class PrintManager {
    private runTheseBeforePrint = [] as Array<() => void>;
    private runTheseAfterPrint = [] as Array<() => void>;

    constructor() {
        this.OnMediaChange = this.OnMediaChange.bind(this);
        this.OnPrintBegin = this.OnPrintBegin.bind(this);
        this.OnPrintEnd = this.OnPrintEnd.bind(this);

        if (typeof onbeforeprint !== "undefined") {
            // Before/After print is what we're actually after
            // startpolyfill (compiler directive)
            if ("addEventListener" in window) {
            // endpolyfill
                addEventListener("beforeprint", this.OnPrintBegin);
                addEventListener("afterprint", this.OnPrintEnd);
            // startpolyfill (compiler directive)
            } else {
                onbeforeprint = this.OnPrintBegin;
                onafterprint = this.OnPrintEnd;
            }
            // endpolyfill
        } else {
            // ...but Safari doesn't support them, so we use matchMedia instead
            matchMedia("print").addListener(this.OnMediaChange);
        }

        if (Object.freeze) {
            Object.freeze(this);
        }
    }

    /**
     * Queue an action to run before the page is printed
     * @param action The action to run before the page is printed
     */
    public RunBeforePrint(action: () => void): void {
        this.runTheseBeforePrint.push(action);
    }

    /**
     * Queue an action to run after the page is printed or the print attempt is canceled
     * @param action The action to run before the page is printed
     */
    public RunAfterPrint(action: () => void): void {
        this.runTheseAfterPrint.push(action);
    }

    /**
     * Handles the case where the "printing" status changes
     */
    private OnMediaChange(ev: any) {
        if (ev.matches) {
            this.OnPrintBegin();
        } else {
            this.OnPrintEnd();
        }
    }

    /**
     * Handle the begining of a print attempt
     */
    private OnPrintBegin() {
        for (let i = this.runTheseBeforePrint.length; i--;) {
            this.runTheseBeforePrint[i]();
        }
    }

    /**
     * Handle the completion or calcelation of a print attempt
     */
    private OnPrintEnd() {
        for (let i = this.runTheseAfterPrint.length; i--;) {
            this.runTheseAfterPrint[i]();
        }
    }
}
