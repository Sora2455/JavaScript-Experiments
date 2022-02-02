import {AutoCompleteSearch} from "./modules/AutoComplete.js";
import {postJson} from "./modules/EnsureSendJson.js";
import "./modules/LazyLoad.js";
import "./modules/Localiser.js";
import {loadBytecode} from "./modules/LoadBytecode.js";
import {onBuyClicked} from "./modules/PaymentRequest.js";
import {PrintManager} from "./modules/PrintManager.js";
import {ReadyManager} from "./modules/readyManager.js";
import "./modules/SafeComments.js";
import "./modules/TimingInformationELem.js";

const readyManager = new ReadyManager();
readyManager.whenReady(() => {
    loadBytecode("/bytecode/demo.wasm", null, 1, (exports) => {
        // tslint:disable-next-line:no-console
        console.log(exports.my_add(1, 2));
    });
});
readyManager.whenReady(() => {
    const buyTest = document.getElementById("buyTest");
    if (buyTest) {
        buyTest.onclick = onBuyClicked;
    }
});
readyManager.whenReady(
    () => {
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
    () => {
        const autocompleteTextbox = document.getElementById("autocomplete");
        if (autocompleteTextbox) {
            autocompleteTextbox.outerHTML = "<p>Your browser is too old. Update it.</p>";
        }
    }
);
if (navigator.serviceWorker) {
    navigator.serviceWorker.register("serviceWorker.js");
}
readyManager.whenReady(() => {
    const jsonSendButton = document.getElementById("testSendJson");
    const jsonSendResult = document.getElementById("testSendJsonResult");
    if (jsonSendButton && jsonSendResult) {
        jsonSendButton.onclick = () => {
            const jsonData = {a: Math.random(), b: Math.random().toString(36).substring(7)};
            const jsonString = JSON.stringify(jsonData);
            jsonSendResult.innerText = "";
            postJson("/reflect.json", jsonString, (result, statusCode) => {
                const success = statusCode === 200 &&
                    typeof result === "object" &&
                    result.a === jsonData.a &&
                    result.b === jsonData.b;
                jsonSendResult.innerText = success ?
                    "matches" :
                    `Status code: ${statusCode}, result: ${JSON.stringify(result)}`;
            });
        };
    }
});
const printManager = new PrintManager();
printManager.RunBeforePrint(() => {
    const visibleId = location.hash.substr(1) || "1";
    document.getElementById(visibleId)?.setAttribute("data-print-subject", "");
});
printManager.RunAfterPrint(() => {
    const visibleId = location.hash.substr(1) || "1";
    document.getElementById(visibleId)?.removeAttribute("data-print-subject");
});
