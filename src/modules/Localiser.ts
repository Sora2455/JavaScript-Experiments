import {ReadyManager} from "./readyManager.js";

// to anyone forking this library: you most likely will want to edit the below two lines
const authorLanguage = "en-AU";
export const authorCurrency = "AUD";
const documentLanguage = document.getElementsByTagName("html")[0].getAttribute("lang") as string;
// try and use native language formatting, falling back to the langauge of the document, then the author
const locales = navigator.languages.concat(documentLanguage, authorLanguage);
let timeFormatter: Intl.DateTimeFormat;
let dateFormatter: Intl.DateTimeFormat;
let dateTimeFormatter: Intl.DateTimeFormat;
let numberFormatter: Intl.NumberFormat;
let moneyFormatter: Intl.NumberFormat;
let percentFormatter: Intl.NumberFormat;

// if the Internationalisation API is not supported, don't try to localise
if (typeof Intl === "object") {
    // set up the formatters for time, dates, and date-times
    timeFormatter = new Intl.DateTimeFormat(locales, { hour: "numeric", minute: "numeric", timeZoneName: "short" });
    dateFormatter = new Intl.DateTimeFormat(locales,
    { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
    dateTimeFormatter = new Intl.DateTimeFormat(locales,
    { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", timeZoneName: "short" });
    numberFormatter = new Intl.NumberFormat(locales, {style: "decimal"});
    moneyFormatter = new Intl.NumberFormat(locales, {style: "currency", currency: authorCurrency});
    percentFormatter = new Intl.NumberFormat(locales, {style: "percent"});
    const manager = new ReadyManager();
    manager.whenReady(localiseTimes);
    manager.whenReady(localiseNumbers);
    manager.whenReady(tryAddShareButton);
    // if the user changes their langauge (how often will THAT happen?!) change with it
    document.addEventListener("languagechange", localiseTimes);
    document.addEventListener("languagechange", localiseNumbers);
}
/**
 * Localise <time> tags to their native language, format and timezone
 */
function localiseTimes() {
    const timeTags = document.getElementsByTagName("time");
    // now format each of the time tags
    for (let i = timeTags.length; i--;) {
        const time = timeTags[i];
        // start with a 'blank' date
        const dateObj = new Date(Date.UTC(1900, 1));
        // get the datetime property of the time tag
        const dateTimeString = time.getAttribute("datetime");
        if (!dateTimeString){
            time.textContent = "";
            return;
        }
        if (dateTimeString.indexOf("-") !== -1) {
            // date with possible time
            const [dateString, timeString] = dateTimeString.split("T");
            setDatePart(dateString, dateObj);
            if (timeString) {
                setTimePart(timeString, dateObj);
                time.textContent = dateTimeFormatter.format(dateObj);
            } else {
                time.textContent = dateFormatter.format(dateObj);
            }
        } else {
            // time only
            setTimePart(dateTimeString, dateObj);
            time.textContent = timeFormatter.format(dateObj);
        }
    }
}
function setDatePart(dateString: string, dateObj: Date) {
    const [year, month, day] = dateString.split("-");
    // javsScript months are 0-indexed for some reason
    dateObj.setUTCFullYear(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
}
function setTimePart(timeString: string, dateObj: Date) {
    const [hours, minutes] = timeString.replace("Z", "").split(":");
    dateObj.setUTCHours(parseInt(hours, 10));
    dateObj.setUTCMinutes(parseInt(minutes, 10));
}
/**
 * Localise <data> tags to their native language and culture
 */
function localiseNumbers() {
    const dataTags = document.getElementsByTagName("data");
    // now format each of the data tags
    for (let i = dataTags.length; i--;) {
        const dataTag = dataTags[i];
        const numberValue = Number(dataTag.value);
        if (isNaN(numberValue)) { continue; }
        const format = dataTag.getAttribute("data-format");
        switch (format) {
            case "number":
                dataTag.textContent = numberFormatter.format(numberValue);
                break;
            case "money":
                dataTag.textContent = moneyFormatter.format(numberValue);
                break;
            case "percent":
                dataTag.textContent = percentFormatter.format(numberValue);
                break;
        }
    }
}

/**
 * If the Web Share API is supported, replace the Share links with one generic share button
 */
function tryAddShareButton() {
    if ("share" in navigator) {
        const shareAreas = document.querySelectorAll("page-share");
        for (let i = shareAreas.length; i--;) {
            const shareArea = shareAreas[i];
            // Empty the current share area
            while (shareArea.firstChild) {
                shareArea.removeChild(shareArea.firstChild);
            }
            // Add the header back in
            const header = document.createElement("h2");
            header.textContent = "Share me";
            shareArea.appendChild(header);
            // Then add the shiny new share button
            const shareButton = document.createElement("button");
            shareButton.addEventListener("click", shareCurrentPage);
            shareButton.textContent = "Share";
            shareArea.appendChild(shareButton);
        }
    } else {
        // The default Twitter share URLs don't take the page description into account (yet)
        const twitterShareLinks =
            document.querySelectorAll("page-share a[href^='https://twitter.com']") as NodeListOf<HTMLAnchorElement>;
        const canonicalUrlElem = document.querySelector("link[rel=canonical]") as HTMLLinkElement;
        const url = canonicalUrlElem ? canonicalUrlElem.href : location.href;
        const description = document.querySelector("meta[name='Description']")?.getAttribute("content") ?? "";
        const fixedTwitterLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`
            + `&text=${encodeURIComponent(description)}`;
        for (let i = twitterShareLinks.length; i--;) {
            twitterShareLinks[i].href = fixedTwitterLink;
        }
    }
}

/**
 * Share the current page on using the Web Share API
 */
function shareCurrentPage() {
    const title = document.title;
    const canonicalUrlElem = document.querySelector("link[rel=canonical]") as HTMLLinkElement;
    const url = canonicalUrlElem ? canonicalUrlElem.href : location.href;
    const text = document.querySelector("meta[name='Description']")?.getAttribute("content") ?? undefined;
    navigator.share({title, url, text});
}
