import {ReadyManager} from "./readyManager.js";

interface INetworkInformation {
    /**
     * Returns the effective bandwidth estimate in megabits per second,
     * rounded to the nearest multiple of 25 kilobits per seconds.
     */
    downlink: number;
    /**
     * Returns the maximum downlink speed, in megabits per second (Mbps),
     * for the underlying connection technology.
     */
    downlinkMax: number;
    /**
     * Returns the effective type of the connection meaning one of 'slow-2g', '2g', '3g', or '4g'.
     * This value is determined using a combination of recently observed round-trip time and downlink values.
     */
    effectiveType: "slow-2g" | "2g" | "3g" | "4g";
    /**
     * Returns the estimated effective round-trip time of the current connection,
     * rounded to the nearest multiple of 25 milliseconds.
     */
    rtt: number;
    /**
     * Returns true if the user has set a reduced data usage option on the user agent.
     */
    saveData: boolean;
    /**
     * Returns the type of connection a device is using to communicate with the network.
     */
    type: "bluetooth" | "cellular" | "ethernet" | "none" | "wifi" | "wimax" | "other" | "unknown";
}

// tslint:disable-next-line:interface-name
declare global {
    // tslint:disable-next-line:interface-name
    interface Navigator {
        connection: INetworkInformation;
    }
}

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
let lowData = false;
if (navigator.connection) {
  lowData = navigator.connection.saveData === true ||
    navigator.connection.effectiveType === "slow-2g" ||
    navigator.connection.effectiveType === "2g";
}
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
function prepareLazyContents(lazyArea: DocumentFragment): void {
    const nativeLazyLoad = "loading" in HTMLImageElement.prototype;
    const lazyImgs = lazyArea.querySelectorAll("img");
    for (let i = lazyImgs.length; i--;) {
        if (nativeLazyLoad) {
            lazyImgs[i].setAttribute("loading", "lazy");
        } else {
            storeSourceForLater(lazyImgs[i], tempImg);
        }
    }
    const lazyiFrames = lazyArea.querySelectorAll("iframe");
    for (let i2 = lazyiFrames.length; i2--;) {
        if (nativeLazyLoad) {
            lazyiFrames[i2].setAttribute("loading", "lazy");
        } else {
            storeSourceForLater(lazyiFrames[i2], "about:blank");
        }
    }
    if (!nativeLazyLoad) {
        const lazyPictures = lazyArea.querySelectorAll("picture");
        for (let i3 = lazyPictures.length; i3--;) {
            jamSourceLoading(lazyPictures[i3], tempImg);
        }
    }
    const lazyAudios = lazyArea.querySelectorAll("audio");
    for (let i4 = lazyAudios.length; i4--;) {
        lazyAudios[i4].preload = "none";
    }
    const lazyVideos = lazyArea.querySelectorAll("video");
    for (let i5 = lazyVideos.length; i5--;) {
        const lazyVideo = lazyVideos[i5];
        lazyVideo.preload = "none";
        storeSourceForLater(lazyVideo, tempImg);
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
        restoreSource(lazyItem);
        if (lazyItem instanceof HTMLImageElement) {
            // just in case the img is the decendent of a picture element, check for source tags
            removeJammingSource(lazyItem.parentElement);
        } else if (lazyItem instanceof HTMLVideoElement || lazyItem instanceof HTMLAudioElement) {
            lazyItem.preload = "metadata";
        }
    });
}

/**
 * Inserts one node after another one
 * @param newNode The node to insert
 * @param referenceNode The node to insert it after
 */
function insertAfter(newNode: Node, referenceNode: Node): void {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

/**
 * Checks an area for video tags whose formats are not supported, and forcing their fallbacks
 * @param lazyArea The area to check video tags in
 */
function setVideoFallback(lazyArea: DocumentFragment) {
  // DocumentFragments don't support getElementsByTagName
  const lazyVideos = lazyArea.querySelectorAll("video");
  for (let i = lazyVideos.length; i--;) {
    const lazyVideo = lazyVideos[i];
    let cantPlay = true;
    if (lazyVideo.canPlayType) {
      // Loop through the various source elements, and check if
      // the browser thinks it can play them
      // This works better if we specify the codec along with
      // the MIME type
      const sources = lazyVideo.getElementsByTagName("source");
      for (let i2 = sources.length; i2--;) {
        if (lazyVideo.canPlayType(sources[i2].type)) {
          cantPlay = false;
          break;
        }
      }
    }
    // If on a low-data connection, remove the autoplay attribute
    // (it's only polite)
    if (lowData) {
      lazyVideo.removeAttribute("autoplay");
      lazyVideo.setAttribute("controls", "");
    }
    // If you can't play any of the available formats, skip straight to fallback content
    if (cantPlay) {
      // Extract the fallback and replace the video with it
      const children = lazyVideo.childNodes;
      for (let i3 = children.length; i3--;) {
        const childNode = children[i3];
        if (!(childNode instanceof HTMLTrackElement) &&
            !(childNode instanceof HTMLSourceElement)) {
          insertAfter(childNode, lazyVideo);
        }
      }
      lazyVideo.parentNode.removeChild(lazyVideo);
    }
  }
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
        let lazyArea: DocumentFragment;
        try {
            // Use createContextualFragment where supported,
            // as it won't execute network requests until we attach it to the DOM
            lazyArea = document.createRange().createContextualFragment(lazyAreaHtml);
        } catch (e) {
            // Browsers that don't support the above, we stick the string in the innerHTML of a new div tag to 'load' it
            const lazyDiv = document.createElement("div");
            lazyDiv.innerHTML = lazyAreaHtml;
            lazyArea = document.createDocumentFragment();
            for (let i1 = lazyArea.childNodes.length; i1--;) {
                lazyArea.appendChild(lazyArea.childNodes[i1]);
            }
        }
        setVideoFallback(lazyArea);
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
