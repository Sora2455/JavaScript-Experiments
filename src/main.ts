import "./modules/LazyLoad.js";
import "./modules/Localiser.js";
import {onBuyClicked} from "./modules/PaymentRequest.js";
import {ReadyManager} from "./modules/readyManager.js";
// import {loadBytecode} from "./modules/LoadBytecode.js";

const manager = new ReadyManager();
/*manager.whenReady(() => {
    loadBytecode("/build/bytecode/demo.wasm", window, null, 1, exports => {
        console.log(exports._my_add(1, 2));
    });
});*/
manager.whenReady(() => {
    const buyTest = document.getElementById("buyTest");
    if (buyTest) {
        buyTest.onclick = onBuyClicked;
    }
});
