const {until, By, Key, Condition} = require("selenium-webdriver");
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
const browsers = ["Firefox", "Chrome", "IE8", "IE9", "IE10", "IE11", "Edge", "noscript"];
let server;
let messageServer;

describe("Cross-browser testing", async function() {
    before(async function() {
        server = fork("server.js");
        messageServer = function(value) {
            return new Promise(function(resolve, reject) {
                server.send(value, function(error) {
                    if (error) { reject(error); }
                    else { resolve(); }
                });
            });
        }
    });

    after(async function() {
        await messageServer("shutdown");
        server.disconnect();
    });

    for (let i = 0; i < browsers.length; i++) {
        const browser = browsers[i];
        let driver;

        describe(`General site tests - ${browser}`, async function() {
            this.timeout(60000);
            before(async function() {
                let version = "edge";
                switch (browser) {
                    case "IE8":
                        version = "8";
                        break;
                    case "IE9":
                        version = "9";
                        break;
                    case "IE10":
                        version = "10";
                        break;
                }
                await messageServer({set: "ieVersion", value: version});
                driver = await getBrowserSession(browsers[i]);
            });
    
            after(async function() {
                await driver.quit();
            });

            it("Can access the test site", async function() {
                await driver.get(siteUrl);
                await driver.manage().window().maximize();
                await driver.switchTo().frame(0);
                if (browser !== "noscript") {
                    const generateButton = await driver.findElement(By.id("QRCodeGenerate"));
                    await driver.wait(until.elementIsNotVisible(generateButton), 1000);
                }
                const tempText = 'webdriver';
                await driver.findElement(By.id("QRCodeInput")).sendKeys(tempText, Key.RETURN);
                if (browser === "noscript") {
                    const qrCodeImage = By.css("img[src='qrCode.png']");
                    const qrCodeImageElement = await driver.findElement(qrCodeImage);
                    await driver.wait(until.stalenessOf(qrCodeImageElement), 3000);
                    await untilImageIsLoaded(driver, qrCodeImage);
                } else {
                    await driver.findElement(By.id("QRCodeResult")).click();
                }
                await driver.switchTo().defaultContent();
                await saveScreenshot(driver, `Main - ${browser}`);
            });

            it("Can see the second section", async function() {
                await driver.get(`${siteUrl}#2`);
                await driver.manage().window().maximize();
                await saveScreenshot(driver, `Second - ${browser}`);
            });

            it("Can see the third section", async function() {
                await driver.get(`${siteUrl}#3`);
                await driver.manage().window().maximize();
                const lazyImage = By.css("img[src='/media/you-have-gone-back-in-time.jpg']");
                await driver.wait(until.elementLocated(lazyImage), 1000);
                await saveScreenshot(driver, `Third - ${browser}`);
            });
        });
    }
});

/**
 * Waits until a given image is loaded
 * @param {Diver} driver The WebDriver object
 * @param {By} locator The selector that locates the image to wait on
 */
async function untilImageIsLoaded(driver, locator) {
    const el = await driver.wait(until.elementLocated(locator), 3000);
    await driver.wait(checkIfImageLoaded(el), 3000);
}

/**
 * Returns a Conditon on the loaded state of an image
 * @param {WebElement} element The WebElement representing the image we're checking
 */
function checkIfImageLoaded(element) {
    return new Condition("for image to load", async (driver) => {
        return await driver.executeScript("return arguments[0].src && arguments[0].complete", element);
    });
}

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
        default:
            const optionsI = new ie.Options().setExtractPath(ieDriverPath);
            return ie.Driver.createSession(optionsI);
    }
}
