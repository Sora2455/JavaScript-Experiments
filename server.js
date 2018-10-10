const connect = require('connect');
const compression = require('compression');
const serveStatic = require('serve-static');
const Canvas = require('canvas');
const qrCode = require("./build/noModules/modules/QRCodeRenderer");

let ieVersion = "edge";

const server = connect()
// gzip/deflate outgoing responses
.use(compression())
// serve dynamic images
.use(handleDynamicImages)
// serve static files
.use(serveStatic(__dirname + "/build", {
    maxAge: 1000 * 60 * 60 * 24,
    immutable: true,
    setHeaders: setHeaders
})).listen(8080, function(){
    console.log('Server running on 8080...');
});

function setHeaders(res, path){
    if (path.endsWith(".html")) {
        res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; " +
            "base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("Feature-Policy", "sync-xhr 'none'; document-write 'none'; vertical-scroll 'none'; " +
            "sync-script 'none'; image-compression 'none'; legacy-image-formats 'none'; " +
            "max-downscaling-image 'none'; unsized-media 'none'; accelerometer 'none'; " +
            "ambient-light-sensor 'none'; camera 'none'; gyroscope 'none'; magnetometer 'none'; " +
            "microphone 'none'; fullscreen 'none';");
        res.setHeader("X-Frame-Options", "sameorigin");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-UA-Compatible", `IE=${ieVersion}`);
        res.setHeader("TK", "N");
    }
    addMimeTypes(res, path);
}

function addMimeTypes(res, path){
    if (path.endsWith(".wasm")) {
        res.setHeader('content-type', 'application/wasm');
    }
}

function handleDynamicImages (req, res, next) {
    // req is the Node.js http request object
    // res is the Node.js http response object
    // next is a function to call to invoke the next middleware
    if (req.url === "/qrCode.png") {
        res.setHeader('Vary', 'referer');
        res.setHeader('content-type', 'image/png');

        const referrerGetParamaters = readGetParamaters(req.headers["referer"]);
        const qrCode = referrerGetParamaters["QRCode"];
        if (!qrCode) {
            return1x1pxPng(res);
        } else {
            drawQrCode(res, qrCode);
        }
    } else {
        next();
    }
}

function return1x1pxPng(res) {
    const image = new Canvas(1, 1);
    const stream = image.pngStream();
    stream.pipe(res);
}

function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
}

function drawQrCode(res, codeString) {
    const model = new qrCode.QRCodeModel(qrCode._getTypeNumber(codeString, 2), 2);
    model.addData(codeString);
    model.make();

    const nCount = model.moduleCount;

    const imageSize = 360;
    const cellSize = imageSize / nCount;

    const image = new Canvas(imageSize, imageSize);
    const ctx = image.getContext("2d");

    for (let row = 0; row < nCount; row++) {
        for (let col = 0; col < nCount; col++) {
            ctx.strokeStyle = ctx.fillStyle = model.isDark(row, col) ? "black" : "white";
            const y = row * cellSize;
            const x = col * cellSize;
            ctx.fillRect(y, x, cellSize, cellSize);
        }
    }

    const stream = image.pngStream();
    stream.pipe(res);
}

function readGetParamaters(url) {
    const result = {};
    if (!url) return result;
    const refererUrlQuery = url.split("?")[1];
    if (refererUrlQuery) {
        const queryStringParts = refererUrlQuery.split("&");
        queryStringParts.forEach(part => {
            let parts = part.split('=');
            result[parts[0]] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
        });
    }
    return result;
}

process.on("message", (m) => {
    if (m === "shutdown") {
        //A parent process has asked us to stop
        server.close();
    } else if (typeof m === "object") {
        if (m.set === "ieVersion" && typeof m.value === "string") {
            ieVersion = m.value;
        }
    }
});