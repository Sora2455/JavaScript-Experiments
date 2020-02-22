import {_getTypeNumber, QRCodeModel, QRErrorCorrectLevel} from "../modules/QRCodeRenderer.js";

interface IhtOption {
    [key: string]: string | number | boolean | QRErrorCorrectLevel; // index defintion
    text?: string;
    colorLight: string;
    colorDark: string;
    typeNumber: number;
    correctLevel: QRErrorCorrectLevel;
    useSVG?: boolean;
}

onmessage = (ev) => {
    if (ev.data && typeof ev.data[0] === "string" && typeof ev.data[1] === "object") {
        const sText = ev.data[0] as string;
        const opts = ev.data[1] as IhtOption;
        const model = new QRCodeModel(_getTypeNumber(sText, opts.correctLevel), opts.correctLevel);
        model.addData(sText);
        model.make();
        postMessage(model);
    }
};
