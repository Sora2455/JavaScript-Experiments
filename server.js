"use strict";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fastify from 'fastify';
import compression from 'fastify-compress';
import serveStatic from 'fastify-static';
import { make, encodePNGToStream } from 'pureimage';
import { QRCodeModel, _getTypeNumber } from "./build/modules/modules/QRCodeRenderer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = fastify({
    http2: true,
    https: {
        allowHTTP1: true, // fallback support for HTTP1
        pfx: readFileSync(join(__dirname, 'https', 'testingCert.pfx')),
        passphrase: "testingCert"
    }
});
// gzip/deflate outgoing responses
server.register(compression);
// serve dynamic images
server.get("/qrCode.png", handleDynamicImages);
// test reflection endpoint
server.post("/reflect.json", reflectJson);
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
        res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; " +
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';");
            //"trusted-types; require-trusted-types-for 'script';"); TODO implement after cleaning up LazyLoad, SafeComments
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("Permissions-Policy", "sync-xhr=(), sync-script=(), legacy-image-formats=(), " +
            "accelerometer=(), ambient-light-sensor=(), camera=(), gyroscope=(), " +
            "magnetometer=(), microphone=(), fullscreen=(), encrypted-media=(), " +
            "document-domain=(), autoplay=(), geolocation=(), payment=(self), " +
            "xr-spatial-tracking=(), usb=(), midi=(), interest-cohort=()");
        res.setHeader("Document-Policy", "no-unsized-media, no-document-write, no-vertical-scroll, " +
            "image-compression;bpp=2");
        res.setHeader("X-Frame-Options", "sameorigin");
        res.setHeader("Cross-Origin-Window-Policy", "Allow-PostMessage");
        res.setHeader("X-UA-Compatible", "IE=edge");
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
    reply.header("Cross-Origin-Resource-Policy", "same-site");
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
    const image = make(1, 1);
    encodePNGToStream(image, reply.raw);
}

function drawQrCode(reply, codeString) {
    const model = new QRCodeModel(_getTypeNumber(codeString, 2), 2);
    model.addData(codeString);
    model.make();

    const nCount = model.moduleCount;

    const imageSize = 360;
    const cellSize = imageSize / nCount;

    const image = make(imageSize, imageSize);
    const ctx = image.getContext("2d");

    for (let row = 0; row < nCount; row++) {
        for (let col = 0; col < nCount; col++) {
            ctx.strokeStyle = ctx.fillStyle = model.isDark(row, col) ? "black" : "white";
            const y = row * cellSize;
            const x = col * cellSize;
            ctx.fillRect(y, x, cellSize, cellSize);
        }
    }

    encodePNGToStream(image, reply.raw);
}

function reflectJson(req, reply) {
    reply.header("Cross-Origin-Resource-Policy", "same-site");
    reply.type('application/json');
    reply.send(req.body);
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
        server.close().catch((err) => {
            console.error(err);
            // in case it hasn't started yet:
            server.addHook("onReady", () => {
                server.close();
            })
        });
    }
});
