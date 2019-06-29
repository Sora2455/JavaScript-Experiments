import {AutoCompleteSearch} from "./modules/AutoComplete.js";
import "./modules/LazyLoad.js";
import "./modules/Localiser.js";
import {onBuyClicked} from "./modules/PaymentRequest.js";
import {PrintManager} from "./modules/PrintManager.js";
import {ReadyManager, Requirement} from "./modules/readyManager.js";
// import {loadBytecode} from "./modules/LoadBytecode.js";

const readyManager = new ReadyManager();
/*manager.whenReady(() => {
    loadBytecode("/build/bytecode/demo.wasm", window, null, 1, exports => {
        console.log(exports._my_add(1, 2));
    });
});*/
readyManager.whenReady(() => {
    const buyTest = document.getElementById("buyTest");
    if (buyTest) {
        buyTest.onclick = onBuyClicked;
    }
});
readyManager.whenReady({
    action: () => {
        const autocompleteTextbox = document.getElementById("autocomplete");
        if (autocompleteTextbox instanceof HTMLInputElement) {
            const suggestions = [
                {key: "1", label: "First suggestion"},
                {key: "2", label: "Second suggestion"},
                {key: "3", label: "Third suggestion"},
                {key: "4", label: "Forth suggestion"},
                {key: "5", label: "Fifth suggestion"},
                {key: "6", label: "Fifth suggestion"},
                {key: "7", label: "Fifth suggestion"}
            ];
            const autoComplete = new AutoCompleteSearch(autocompleteTextbox, (_, callback) => {
                callback(suggestions);
            }, alert.bind(window));
            autoComplete.setResults(suggestions);
        }
    },
    fallbackAction: () => {
        const autocompleteTextbox = document.getElementById("autocomplete");
        if (autocompleteTextbox) {
            autocompleteTextbox.outerHTML = "<p>Your browser is too old. Update it.</p>";
        }
    },
    requirements: [Requirement.datalist]
});
const printManager = new PrintManager();
printManager.RunBeforePrint(() => {
    const visibleId = location.hash.substr(1) || "1";
    document.getElementById(visibleId).setAttribute("data-print-subject", "");
});
printManager.RunAfterPrint(() => {
    const visibleId = location.hash.substr(1) || "1";
    document.getElementById(visibleId).removeAttribute("data-print-subject");
});

// tslint:disable-next-line:interface-name
interface PerformanceServerTiming {
    /**
     * A DOMString value of the server-specified metric description, or an empty string.
     */
    description: string;
    /**
     * A double that contains the server-specified metric duration, or value 0.0.
     */
    duration: number;
    /**
     * A DOMString value of the server-specified metric name.
     */
    name: string;
}

if ("customElements" in self) {
    class TimingInformation extends HTMLElement {
        constructor() {
            // Always call super first in constructor
            super();

            const locales = [navigator.language, document.documentElement.lang];
            const getTimeInSecondsSecondsString = (timeInMilliseconds: number) => {
                if (typeof timeInMilliseconds !== "number") { return "unknown"; }
                const timeInSeconds = timeInMilliseconds / 1000;
                return timeInSeconds.toLocaleString(locales,
                    {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2
                    }) + " seconds";
            };

            const shadow = this.attachShadow({mode: "open"});
            const content = document.createElement("div");

            const pageTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
            const domReadyTime = pageTiming.domContentLoadedEventEnd - pageTiming.requestStart;

            const lastModifiedDate = new Date(document.lastModified);
            const lastModifiedLocaleString = lastModifiedDate.toLocaleString(locales);
            const lastModifiedIsoString = lastModifiedDate.toISOString();

            const serverTiming = (pageTiming as any).serverTiming as PerformanceServerTiming[];
            let generationTime = null;
            let databaseTime = null;
            if (Array.isArray(serverTiming)) {
                let totalTime = 0;
                let dataBaseTime = 0;
                serverTiming.forEach((t) => {
                    if (t.name === "t") {
                        totalTime = t.duration;
                    } else if (t.name === "d") {
                        dataBaseTime = t.duration;
                    }
                });
                if (totalTime) {
                    generationTime = totalTime - dataBaseTime;
                }
                if (dataBaseTime) {
                    databaseTime = dataBaseTime;
                }
            }

            content.innerHTML = "<dl>" +
                "<dt>Page load time</dt>" +
                "<dd>" + getTimeInSecondsSecondsString(domReadyTime) + "</dd>" +
                "<dt>Time spent in database</dt>" +
                "<dd>" + getTimeInSecondsSecondsString(databaseTime) + "</dd>" +
                "<dt>Time spent generating page</dt>" +
                "<dd>" + getTimeInSecondsSecondsString(generationTime) + "</dd>" +
                "<dt>Page last modified</dt>" +
                "<dd><time datetime=" + lastModifiedIsoString + ">" + lastModifiedLocaleString + "</time></dd>" +
            "</dl>";
            shadow.appendChild(content);
        }
    }

    customElements.define("timing-information", TimingInformation);
}
