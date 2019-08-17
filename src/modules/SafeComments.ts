// startnopolyfill (compiler directive)
/**
 * The ResizeObserver interface is used to observe changes to Element's content
 * rect.
 *
 * It is modeled after MutationObserver and IntersectionObserver.
 */
declare class ResizeObserver {
    /**
     * Adds target to the list of observed elements.
     */
    public observe: (target: Element) => void;

    /**
     * Removes target from the list of observed elements.
     */
    public unobserve: (target: Element) => void;

    /**
     * Clears both the observationTargets and activeTargets lists.
     */
    public disconnect: () => void;

    constructor(callback: ResizeObserverCallback);
}

/**
 * This callback delivers ResizeObserver's notifications. It is invoked by a
 * broadcast active observations algorithm.
 */
// tslint:disable-next-line:interface-name
type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

declare class ResizeObserverEntry {
    /**
     * The Element whose size has changed.
     */
    public readonly target: Element;

    /**
     * Element's content rect when ResizeObserverCallback is invoked.
     */
    public readonly contentRect: DOMRectReadOnly;
}

// tslint:disable-next-line:interface-name
interface DOMRectReadOnly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;

    toJSON: () => any;
}

interface ICommentData {
    /** The name of the person who authored this comment */
    author?: string;
    /** The timestamp of the date the comment was made */
    date?: number;
    /** The HTML string of the comment */
    text: string;
}
((s) => {
    "use strict";
    if (!("customElements" in s)) { return; }

    // Grab the getRandomValues function so that code running after us can't redefine it
    const getRandomValues = crypto.getRandomValues.bind(crypto) as (array: Uint8Array) => void;
    // Instantiate our DomParser and XMLSerializer now, rather than once for every time we need them
    const parser = new DOMParser();
    const serialiser = new XMLSerializer();
    // Whitelists are more secure than blacklists, but this is just one layer of our defence-in-depth
    // (We will use an iframe sandbox to prevent script execution)
    const blacklistedElementSelector = "style, script, img, image, picture, canvas, svg, math, map, video, audio, " +
                                       "object, applet, iframe, frameset, frame, embed, form, input, " +
                                       "textarea, select, button, keygen, marquee, meta, base, link, noscript";
    const blacklistedAttributes = ["background", "bgcolor", "border", "color", "contenteditable", "class", "draggable",
                                   "dropzone", "height", "hidden", "id", "ping", "style", "width"];
    const blacklistedAttributeSelector = blacklistedAttributes.map((att) => `[${att}]`).join(", ");
    // Set up a date formatter function for later
    const dateTimeFormatter = new Intl.DateTimeFormat(
        [navigator.language, document.documentElement.lang],
        {
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            month: "short",
            weekday: "short",
            year: "numeric"
        }
    ).format;

    /**
     * Generate a cryptographically random string of a given length (defaults to 40 characters)
     * @param len The legnth of the generated random string (defaults to 40 characters)
     */
    function generateId(len?: number): string {
        const arr = new Uint8Array((len || 40) / 2);
        getRandomValues(arr);
        return Array.from(arr, (dec) => {
            return ("0" + dec.toString(16)).substr(-2);
        }).join("");
    }

    /**
     * A custom HTML element that safely encloses custom HTML strings,
     * allowing only text and links.
     */
    class SafeComments extends HTMLElement {
        private content: HTMLIFrameElement;
        private resizeObserver: ResizeObserver;
        private loadingFromUrl: string;
        // Specify observed attributes so that
        // attributeChangedCallback will work
        static get observedAttributes() {
            return ["comment-url", "comment-data"];
        }

        constructor() {
            // Always call super first in constructor
            super();

            // Remove fallback content
            while (this.firstChild) {
                this.firstChild.remove();
            }

            const shadow = this.attachShadow({mode: "open"});
            const content = document.createElement("iframe");
            this.content = content;

            content.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox allow-same-origin");
            content.title = "Comments for \"" + document.title + "\"";
            content.style.border = "0";
            content.style.width = "100%";
            content.style.overflowY = "auto";
            content.height = "20";
            content.srcdoc = "<progress></progress>";

            shadow.appendChild(content);

            this.setIFrameHeight = this.setIFrameHeight.bind(this);
        }

        protected connectedCallback() {
            this.setCommentData();
            if (typeof ResizeObserver === "function") {
                this.resizeObserver = new ResizeObserver(() => {
                    this.setIFrameHeight();
                });
                this.resizeObserver.observe(this.content);
            } else {
                s.addEventListener("resize", this.setIFrameHeight);
            }
        }

        protected disconnectedCallback() {
            if (typeof ResizeObserver === "function") {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            } else {
                s.removeEventListener("resize", this.setIFrameHeight);
            }
        }

        protected attributeChangedCallback(name: string) {
            if (name === "comment-data" || name === "comment-url") {
                this.setCommentData();
            }
        }

        /**
         * Sets the internal comment data, either from an attribute or an external URL
         */
        private setCommentData() {
            if (this.hasAttribute("comment-data")) {
                const commentData = JSON.parse(this.getAttribute("comment-data"));
                this.writeCommentsIntoIFrame(commentData);
            } else if (this.hasAttribute("comment-url")) {
                const commentUrl = this.getAttribute("comment-url");
                if (this.loadingFromUrl !== commentUrl) {
                    this.loadingFromUrl = commentUrl;
                    fetch(this.getAttribute("comment-url"))
                        .then((response) => {
                            return response.json();
                        })
                        .then((commentData) => {
                            this.writeCommentsIntoIFrame(commentData);
                        });
                }
            }
        }

        /**
         * Write the comments into the main iFrame after sanitising them
         * @param comments A HTML string of one comment, a comment data object, or an array
         * of comment data objects
         */
        private writeCommentsIntoIFrame(comments: ICommentData[] | ICommentData | string) {
            // Make sure the paramater is an array of comment data, even if it doesn't start out that way
            if (!Array.isArray(comments)) {
                if (typeof comments === "object") {
                    comments = [comments];
                } else {
                    comments = [{text: comments}];
                }
            }
            const commentHtml = comments.map((c, i) => {// TODO author and microdata
                const date = typeof c.date === "number" ? new Date(c.date) : null;
                return  "<input type=\"checkbox\" id=\"readMoreCheckbox" + i + "\" hidden class=\"readMoreCheckbox\">" +
                        "<section class=\"comment\" dir=\"auto\" itemscope=\"\"" +
                            " itemtype=\"https://schema.org/Comment\">" +
                           (c.author ? "<h6 itemprop=\"author\" itemscope itemtype=\"https://schema.org/Person\">" +
                                "<span itemprop=\"name\">" + c.author + "</span>" +
                           "</h6>" : "") +
                           (date ?
                               " <time itemprop=\"dateCreated\" datetime=\"" + date.toISOString() + "\">" +
                                   dateTimeFormatter(date) +
                               "</time>" :
                               "") +
                           "<div class=\"contents\" tabindex=\"0\">" +
                               this.stripStylesScriptsAndExternalResources(c.text) +
                           "</div>" +
                           "<label class=\"readMore\" aria-hidden=\"true\" for=\"readMoreCheckbox" + i +
                               "\">Read more...</label>" +
                       "</section>";
            }).join("\n");

            const nonce = generateId();
            const fullHtml = "<!DOCTYPE html><html lang=\"" + document.documentElement.lang + "\">" +
            "<head>" +
                "<meta charset=\"utf-8\"/>" +
                "<title>Comments for \"" + document.title + "\"</title>" +
                // Make sure all relative links work, and start in a new tab
                "<base target=\"_blank\" href=\"" + location.origin + "\">" +
                // And that we don't send referer info when we do so
                "<meta name=\"referrer\" content=\"no-referrer\">" +
                // Finally, set our comment stylesheet
                "<link rel=\"stylesheet\" href=\"./safeComments.css\">" +
            "</head><body>" +
                commentHtml +
                // We use this data element to tell when the iframe has fully loaded
                // (if this element doesn't exist, it hasn't)
                "<data hidden value=\"" + nonce + "\"></data>" +
            "</body></html>";

            this.content.srcdoc = fullHtml;

            const setHeight = () => {
                    // If the iframe has finished loading...
                if (this.content.contentDocument &&
                    this.content.contentDocument.readyState === "complete" &&
                    // ...and has our nonce data element to prove it...
                    this.content.contentDocument.querySelector("data[value=\"" + nonce + "\"]")) {
                    this.setIFrameHeight();
                    this.content.contentDocument.addEventListener("change", this.setIFrameHeight);
                    this.content.contentDocument.addEventListener("focus", this.setIFrameHeight, true);
                    this.content.contentDocument.addEventListener("blur", this.setIFrameHeight, true);
                } else {
                    requestAnimationFrame(setHeight);
                }
            };
            requestAnimationFrame(setHeight);
        }

        /**
         * Change iframe height to match its contents
         */
        private setIFrameHeight() {
            if (this.content.contentDocument.body) {
                this.content.height = (this.content.contentDocument.body.offsetHeight + 25).toString();
            }
        }

        /**
         * Removes blacklisted attributes and elements from a given HTML string.
         * Intended to be used together with a script CSP, not on its own.
         * @param html The HTML string to clean
         */
        private stripStylesScriptsAndExternalResources(html: string): string {
            const doc = parser.parseFromString(html, "text/html");
            const elementsToRemove = doc.body.querySelectorAll(blacklistedElementSelector);
            elementsToRemove.forEach((el) => { el.remove(); });

            const elementsWithStylesOrClasses = doc.body.querySelectorAll(blacklistedAttributeSelector);
            elementsWithStylesOrClasses.forEach((el) => {
                blacklistedAttributes.forEach((att) => {
                    el.removeAttribute(att);
                });
            });

            return serialiser.serializeToString(doc.body);
        }
    }

    customElements.define("safe-comments", SafeComments);
})(self);
// endnopolyfill
