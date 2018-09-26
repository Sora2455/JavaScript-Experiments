import {ReadyManager} from "./readyManager.js";
const config = {
    // If the image gets within 50px in the Y axis, start the download.
    rootMargin: "50px 0px"
} as IntersectionObserverInit;
let observer: IntersectionObserver;
// if we're using a browser without the IntersectionObserver (IE11, Safari 11),
// skip the lazy part and just load the resources
if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver(onIntersection, config);
}
const tempImg = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
/**
 * Temporarily replace a expensive resource load with a cheap one
 */
function storeSourceForLater(lazyItem: Element, tempData: string): void {
    if (lazyItem.hasAttribute("src")) {
        // store our ACTUAL source for later
        lazyItem.setAttribute("data-lazy-src", lazyItem.getAttribute("src"));
        // set the item to point to a temporary replacement (like a data URI)
        lazyItem.setAttribute("src", tempData);
    }
    if (lazyItem.hasAttribute("poster")) {
        // the video element has a 'poster' attribute that shows an image while loading
        lazyItem.setAttribute("data-lazy-poster", lazyItem.getAttribute("poster"));
        lazyItem.setAttribute("poster", tempData);
    }
    // now observe the item so that we can start loading when it gets close to the viewport
    observer.observe(lazyItem);
}
/**
 * Temporarily prevent expensive resource loading by inserting a
 * <source> tag pointing to a cheap one (like a data URI)
 */
function jamSourceLoading(lazyItem: HTMLPictureElement, tempData: string): void {
    const newSource = document.createElement("source");
    // audio/video sources use src, picture sources use srcset
    newSource.setAttribute("srcset", tempData);
    newSource.setAttribute("data-lazy-remove", "true");
    // adding this source tag at the start of the picture/audio/video
    // tag means the browser will load it first
    lazyItem.insertBefore(newSource, lazyItem.firstChild);
    const baseImage = lazyItem.getElementsByTagName("img")[0];
    if (baseImage) {
        // this is a picture tag, so we need to watch the image
        // (as the picture tag is smaller than the image usually)
        observer.observe(baseImage);
    } else {
        // start watching the source tag, so that we can remove it and start properly
        // loading the audio/video when the user gets close
        observer.observe(lazyItem);
    }
}
/**
 * Set up the lazy items so that they won't try to load when we add them to the document,
 * but will once the user is close to seeing them
 */
function prepareLazyContents(lazyArea: HTMLDivElement): void {
    const nativeLazyLoad = (() => {
        const img = document.createElement("img");
        return "lazyload" in img;
    })();
    const lazyImgs = lazyArea.getElementsByTagName("img");
    for (let i = lazyImgs.length; i--;) {
        if (nativeLazyLoad) {
            lazyImgs[i].setAttribute("lazyload", "on");
        } else {
            storeSourceForLater(lazyImgs[i], tempImg);
        }
    }
    const lazyiFrames = lazyArea.getElementsByTagName("iframe");
    for (let i2 = lazyiFrames.length; i2--;) {
        storeSourceForLater(lazyiFrames[i2], "about:blank");
    }
    const lazyPictures = lazyArea.getElementsByTagName("picture");
    for (let i3 = lazyPictures.length; i3--;) {
        if (!nativeLazyLoad) {
            jamSourceLoading(lazyPictures[i3], tempImg);
        }
    }
    const lazyAudios = lazyArea.getElementsByTagName("audio");
    for (let i4 = lazyAudios.length; i4--;) {
        lazyAudios[i4].preload = "none";
    }
    const lazyVideos = lazyArea.getElementsByTagName("video");
    for (let i5 = lazyVideos.length; i5--;) {
        const lazyVideo = lazyVideos[i5];
        lazyVideo.preload = "none";
    }
}
/**
 * Put the source back where we found it - now that the element is attached to the document, it will load now
 */
function restoreSource(lazyItem: Element): void {
    if (lazyItem.hasAttribute("data-lazy-src")) {
        lazyItem.setAttribute("src", lazyItem.getAttribute("data-lazy-src"));
        lazyItem.removeAttribute("data-lazy-src");
    }
    if (lazyItem.hasAttribute("data-lazy-poster")) {
        lazyItem.setAttribute("poster", lazyItem.getAttribute("data-lazy-poster"));
        lazyItem.removeAttribute("data-lazy-poster");
    }
}
/**
 * Remove the source tag preventing the loading of picture/audio/video
 */
function removeJammingSource(lazyItem: Element): void {
    const jammingSource = lazyItem.querySelector("source[data-lazy-remove]");
    if (jammingSource) { lazyItem.removeChild(jammingSource); }
}
/**
 * Handle the intersection postback
 */
function onIntersection(entries: IntersectionObserverEntry[], obsvr: IntersectionObserver): void {
    entries.forEach((entry) => {
        if (entry.intersectionRatio === 0) { return; }
        // if the item is now visible, load it and stop watching it
        const lazyItem = entry.target;
        obsvr.unobserve(lazyItem);
        if (lazyItem instanceof HTMLImageElement) {
            // just in case the img is the decendent of a picture element, check for source tags
            removeJammingSource(lazyItem.parentElement);
            restoreSource(lazyItem);
        } else if (lazyItem instanceof HTMLIFrameElement) {
            restoreSource(lazyItem);
        } else if (lazyItem instanceof HTMLVideoElement || lazyItem instanceof HTMLAudioElement) {
            lazyItem.preload = "metadata";
        }
    });
}
/**
 * Retrieve the elements from the 'lazy load' no script tags and prepare them for display
 */
function setUp(): void {
    // get all the noscript tags on the page
    const lazyLoadAreas = document.getElementsByTagName("noscript");
    for (let i = lazyLoadAreas.length; i--;) {
        const noScriptTag = lazyLoadAreas[i];
        // only process the ones marked for lazy loading
        if (!noScriptTag.hasAttribute("data-lazy-load")) { continue; }
        // The contents of a noscript tag are treated as text to JavaScript
        const lazyAreaHtml = noScriptTag.textContent || noScriptTag.innerHTML;
        // So we stick them in the innerHTML of a new div tag to 'load' them
        const lazyArea = document.createElement("div");
        lazyArea.innerHTML = lazyAreaHtml;
        // only delay loading if we can use the IntersectionObserver to check for visibility
        if (!observer) {
            noScriptTag.parentNode.replaceChild(lazyArea, noScriptTag);
        } else {
            prepareLazyContents(lazyArea);
            noScriptTag.parentNode.replaceChild(lazyArea, noScriptTag);
        }
    }
}
// if the page has loaded already, run setup - if it hasn't, run as soon as it has.
// use requestAnimationFrame as this will propably cause repaints
new ReadyManager().whenLoaded(() => {
    requestAnimationFrame(setUp);
});
