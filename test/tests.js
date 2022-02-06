"use strict";
import {until, By, Key, Condition, Builder, Browser} from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import chrome from "selenium-webdriver/chrome.js";
import "geckodriver";
import "chromedriver";
import { fork } from "child_process";
import { promisify } from "util";
import fs from "fs";
const fs_WriteFile = promisify(fs.writeFile);
import {describe, before, after, it} from "mocha";

// Folder where the ffmeg binaries are stored
const configJson = JSON.parse(fs.readFileSync("config.json"));

const siteUrl = "https://localhost:8080/";
const browsers = ["Firefox", "Chrome", "noscript"];
let server;
let messageServer;
//TODO fix broken tests
describe("Cross-browser testing", function() {
    before(function startUpServer() {
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

    after(async function closeServer() {
        await messageServer("shutdown");
        server.disconnect();
    });

    for (let i = 0; i < browsers.length; i++) {
        const browser = browsers[i];
        let driver;

        describe(`General site tests - ${browser}`, function() {
            this.timeout(60000);
            before(function getBrowserDriver() {
                driver = getBrowserSession(browsers[i]);
            });

            after(function closeDriver() {
                driver.quit();
            });

            it("Can access the test site", async function() {
                await driver.get(`${siteUrl}#1`);
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
                await saveScreenshot(driver, `${browser} - 1 Main`);
            });

            it("Can see the second section", async function() {
                await driver.get(`${siteUrl}#2`);
                await driver.manage().window().maximize();
                await saveScreenshot(driver, `${browser} - 2 Second`);
            });

            it("Can see the third section", async function() {
                await driver.get(`${siteUrl}#3`);
                await driver.manage().window().maximize();
                const lazyImage = By.css("img[src='/media/you-have-gone-back-in-time.jpg']");
                await untilImageIsLoaded(driver, lazyImage);
                await saveScreenshot(driver, `${browser} - 3 Third`);
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
function getBrowserSession(type) {
    if (typeof type !== "string") return null;

    switch(type.toLocaleLowerCase()) {
        case "firefox":
            const optionsF = new firefox.Options();
            if (configJson.firefoxPath) {
                optionsF.setBinary(configJson.firefoxPath)
            }
            optionsF.setAcceptInsecureCerts(true);//Ignore the fact that we're using a self-signed cert
            const builderF = new Builder().forBrowser(Browser.FIREFOX);
            builderF.setFirefoxOptions(optionsF);
            return builderF.build();
        case "noscript":
            const optionsNs = new firefox.Options().setPreference("javascript.enabled", false);
            if (configJson.firefoxPath) {
                optionsNs.setBinary(configJson.firefoxPath)
            }
            optionsNs.setAcceptInsecureCerts(true);//Ignore the fact that we're using a self-signed cert
            const builderNs = new Builder().forBrowser(Browser.FIREFOX);
            builderNs.setFirefoxOptions(optionsNs);
            return builderNs.build();
        case "chrome":
            const optionsC = new chrome.Options()
            if (configJson.chomePath) {
                optionsC.setChromeBinaryPath(configJson.chomePath)
            }
            const builderC = new Builder().forBrowser(Browser.CHROME);
            builderC.setChromeOptions(optionsC);
            return builderC.build();
        default:
            return null;
    }
}
