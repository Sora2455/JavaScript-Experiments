"use strict";
const fs = require('fs');
const path = require('path');
const fastify = require('fastify');
const compression = require('fastify-compress');
const serveStatic = require('fastify-static');
const Canvas = require('canvas');
const qrCode = require("./build/noModules/modules/QRCodeRenderer");

let ieVersion = "edge";

const server = fastify({
    http2: true,
    https: {
        pfx: fs.readFileSync(path.join(__dirname, 'https', 'testingCert.pfx')),
        passphrase: "testingCert"
    }
});
// gzip/deflate outgoing responses
server.register(compression);
// serve dynamic images
server.get("/qrCode.png", handleDynamicImages);
// serve static files
server.register(serveStatic,
{
    root: __dirname + "/build",
    maxAge: 1000 * 60 * 60 * 24,//Cache for a day at least
    setHeaders: setHeaders,
    lastModified: true,
    etag: true
});
server.listen(8080, function (err, address) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server running on ${address}...`);
});

function setHeaders(res, path, stat){
    if (path.endsWith(".html")) {
        res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; object-src 'none'; " +
            "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("Feature-Policy", "sync-xhr 'none'; document-write 'none'; vertical-scroll 'none'; " +
            "sync-script 'none'; image-compression 'none'; legacy-image-formats 'none'; " +
            "max-downscaling-image 'none'; unsized-media 'none'; accelerometer 'none'; " +
            "ambient-light-sensor 'none'; camera 'none'; gyroscope 'none'; magnetometer 'none'; " +
            "microphone 'none'; fullscreen 'none'; encrypted-media 'none'; document-domain 'none';" +
            "autoplay 'self'; geolocation 'none'; payment 'self'; vr 'none';");
        res.setHeader("X-Frame-Options", "sameorigin");
        res.setHeader("Cross-Origin-Window-Policy", "Allow-PostMessage");
        res.setHeader("X-UA-Compatible", `IE=${ieVersion}`);
    }
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("TK", "N");
    addMimeTypes(res, path);
}

function addMimeTypes(res, path){
    if (path.endsWith(".wasm")) {
        res.setHeader('content-type', 'application/wasm');
    }
}

function handleDynamicImages (req, reply) {
    reply.header('Vary', 'referer');
    reply.type('image/png');

    const referrerGetParamaters = readGetParamaters(req.headers["referer"]);
    const qrCode = referrerGetParamaters["QRCode"];
    if (!qrCode) {
        return1x1pxPng(reply);
    } else {
        drawQrCode(reply, qrCode);
    }
}

function return1x1pxPng(reply) {
    const image = new Canvas(1, 1);
    const stream = image.pngStream();
    reply.send(stream);
}

function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-store, private, must-revalidate');
}

function drawQrCode(reply, codeString) {
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
    reply.send(stream);
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