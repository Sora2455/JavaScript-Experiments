import {AutoCompleteSearch} from "./modules/AutoComplete.js";
import "./modules/LazyLoad.js";
import "./modules/Localiser.js";
import {onBuyClicked} from "./modules/PaymentRequest.js";
import {PrintManager} from "./modules/PrintManager.js";
import {ReadyManager} from "./modules/readyManager.js";
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
