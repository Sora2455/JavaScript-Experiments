import {_getTypeNumber, QRCodeModel, QRErrorCorrectLevel} from "../modules/QRCodeRenderer.js";

onmessage = (ev) => {
    if (ev.data && typeof ev.data[0] === "string" && typeof ev.data[1] === "number") {
        const sText = ev.data[0] as string;
        const correctLevel = ev.data[1] as QRErrorCorrectLevel;
        const model = new QRCodeModel(_getTypeNumber(sText, correctLevel), correctLevel);
        model.addData(sText);
        model.make();
        postMessage(model);
    } else if (ev.data === "marco") {
        // Confirming that we loaded successfully
        postMessage("polo");
    }
};
