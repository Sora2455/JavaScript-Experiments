const {Builder, By, Key, until} = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const chrome = require("selenium-webdriver/chrome");
const ie = require('selenium-webdriver/ie');
const edge = require("selenium-webdriver/edge");
const firefoxDriverPath = require("geckodriver").path;
const chromeDriverPath = require("chromedriver").path;
const ieDriverPath = require('iedriver').path;
const edgeDriverPath = require("edgedriver").path;
const { fork } = require('child_process');
const {promisify} = require('util')
const fs = require("fs");
const fs_WriteFile = promisify(fs.writeFile);
const {describe, before, after, it} = require("mocha");
const {assert} = require("chai");

const siteUrl = "http://localhost:8080/";
const browsers = ["Firefox", "Chrome", "Internet Explorer", "Edge", "noscript"];
let server;

describe("Cross-browser testing", async function() {
    before(async function() {
        server = fork("server.js");
    });

    after(async function() {
        server.send("shutdown", function() {
            server.disconnect();
        });
    });

    for (let i = 0; i < browsers.length; i++) {
        const browser = browsers[i];
        let driver;

        describe(`General site tests - ${browser}`, async function() {
            this.timeout(60000);
            before(async function() {
                driver = await getBrowserSession(browsers[i]);
            });
    
            after(async function() {
                await driver.quit();
            });

            it("Can access the test site", async function() {
                await driver.get(siteUrl);
                await driver.manage().window().maximize();
                await saveScreenshot(driver, `Main - ${browser}`);
            });
        });
    }
});

/* (async function example() {
    let driver = getBrowserSession(browsers[2]);
    try {
        await driver.get('http://www.google.com/ncr');
        await driver.findElement(By.name('q')).sendKeys('webdriver', Key.RETURN);
        await driver.wait(until.titleIs('webdriver - Google Search'), 1000);
    } finally {
        await driver.quit();
    }
})(); */

/**
 * Save a screenshot of what the Web Driver currently sees
 * @param {Driver} driver The Web Driver object
 * @param {String} fileName The name to save the screenshot under
 */
async function saveScreenshot(driver, fileName) {
    const screenshot = await driver.takeScreenshot();
    const base64Data = screenshot.replace(/^data:image\/png;base64,/,"")
    await fs_WriteFile(`test/screenshots/${fileName}.png`, base64Data, {
        flag: "w",
        encoding: "base64"
    });
}

/**
 * Start up a browser session of the given type
 * @param {String} type The type of session to launch (Firefox, Chrome, IE8, noscript...)
 */
async function getBrowserSession(type) {
    if (typeof type !== "string") return null;

    switch(type.toLocaleLowerCase()) {
        case "firefox":
            const optionsF = new firefox.Options();
            const serviceF = new firefox.ServiceBuilder(firefoxDriverPath).build();
            return firefox.Driver.createSession(optionsF, serviceF);
        case "noscript":
            const optionsNs = new firefox.Options().setPreference("javascript.enabled", false);
            const serviceNs = new firefox.ServiceBuilder(firefoxDriverPath).build();
            return firefox.Driver.createSession(optionsNs, serviceNs);
        case "chrome":
            const optionsC = new chrome.Options();
            const serviceC = new chrome.ServiceBuilder(chromeDriverPath).build();
            return chrome.Driver.createSession(optionsC, serviceC);
        case "edge":
            const optionsE = new edge.Options();
            const serviceE = new edge.ServiceBuilder(edgeDriverPath).build();
            return edge.Driver.createSession(optionsE, serviceE);
        case "ie":
        case "internet explorer":
            const optionsI = new ie.Options().setExtractPath(ieDriverPath);
            return ie.Driver.createSession(optionsI);
        default:
            throw new Error(`Unrecognised browser session type ${type}`);
    }
}
