declare global {
    // tslint:disable-next-line:interface-name
    interface HTMLScriptElement {
        readyState: string;
        onreadystatechange: () => void;
    }
    // tslint:disable-next-line:interface-name
    interface Window {
        /**
         * This is a proprietary Microsoft Internet Explorer alternative
         * to the standard EventTarget.addEventListener() method.
         * @param eventNameWithOn The name of the event to listen for, prefixed with "on",
         * as if it were an event handler attribute. For example, you would use "onclick" to listen for the click event.
         * @param handler Callback function to call when the event is triggered on this target.
         * The function will be called with no arguments, and with the this reference set to the window object.
         * @returns {boolean} Boolean indicating whether the event handler was successfully attached.
         */
        attachEvent(eventNameWithOn: string, handler: () => void): boolean;
        /**
         * This is a proprietary Microsoft Internet Explorer alternative
         * to the standard EventTarget.removeEventListener() method.
         * @param eventNameWithOn The name of the event whose handler is to be detached, prefixed with "on"
         * (as if it were an event handler attribute). For example, you would use "onclick" to detach an
         * event handler for the click event.
         * @param handler Event handler callback function to deregister.
         */
        detachEvent(eventNameWithOn: string, handler: () => void): void;
    }
}
type RequestIdleCallbackHandle = number;
interface IRequestIdleCallbackOptions {
    timeout: number;
}
interface IRequestIdleCallbackDeadline {
    readonly didTimeout: boolean;
    timeRemaining: (() => number);
}
declare var requestIdleCallback: ((
    callback: ((deadline: IRequestIdleCallbackDeadline) => void),
    opts?: IRequestIdleCallbackOptions,
) => RequestIdleCallbackHandle);
interface IFeature {
    /**
     * A function that returns true if the feature is availible for use
     */
    test: () => boolean;
    /**
     * True if the polyfill for this item has started loading
     */
    loaded?: boolean;
    /**
     * The location of a polyfill script for this feature (if availible)
     */
    polyfillSrc?: string;
    /**
     * A list of features the polyfill for this item depends on
     */
    polyfillRequires?: IFeature[];
}
interface IFeatureList {
    [item: string]: IFeature;
}

export const Requirement: IFeatureList = {
    BroadcastChannel: {
        polyfillSrc: "/polyfills/es5/BroadcastChannel.js",
        test: () => typeof BroadcastChannel === "function"
    },
    MessageChannel: {
        test: () => typeof MessageChannel === "function"
    },
    MutationObserver: {
        test: () => typeof MutationObserver === "function"
    },
    Worker: {
        polyfillSrc: "/polyfills/es3/WebWorker.js",
        test: () => typeof Worker === "function"
    },
    datalist: {
        polyfillSrc: "/polyfills/es3/DataList.js",
        test: () => typeof HTMLDataListElement === "function" && !window.StyleMedia
    },
    matches: {
        polyfillSrc: "/polyfills/es3/ElementMatches.js",
        test: () => typeof Element.prototype.matches === "function"
    },
    reportValidity: {
        polyfillSrc: "/polyfills/es3/ReportValidity.js",
        test: () => !HTMLFormElement.prototype.checkValidity || !HTMLFormElement.prototype.reportValidity
    },
    requestAnimationFrame: {
        polyfillSrc: "/polyfills/es3/RequestAnimationFrame.js",
        test: () => typeof requestAnimationFrame === "function"
    },
    requestIdleCallback: {
        polyfillSrc: "/polyfills/es3/RequestIdleCallback.js",
        test: () => typeof requestIdleCallback === "function"
    },
    sendBeacon: {
        polyfillSrc: "/polyfills/es3/SendBeacon.js",
        test: () => !navigator.sendBeacon
    }
};
Requirement.BroadcastChannel.polyfillRequires = [Requirement.MessageChannel];
Requirement.datalist.polyfillRequires = [Requirement.matches];

interface IAction {
    /**
     * The action to attempt
     */
    action: () => void;
    /**
     * A list of features that are required for the action to be run
     */
    requirements: IFeature[];
    /**
     * A fallback action to try if the main action cannot be completed (optional)
     */
    fallbackAction?: () => void;
    /**
     * If false, this item requires features that can't be polyfilled
     */
    canBeLoaded?: boolean;
}
// startpolyfill (compiler directive)
// tslint:disable
// basic polyfills to start with
if (!Array.isArray) {
    Array.isArray = function(arg: any): arg is any[] {
        return Object.prototype.toString.call(arg) === "[object Array]";
    };
}
// production steps of ECMA-262, Edition 5, 15.4.4.18
// reference: http://es5.github.io/#x15.4.4.18
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback/*, thisArg*/) {
        var T, k;
        if (this == null) {
            throw new TypeError("this is null or not defined");
        }
        // 1. Let O be the result of calling toObject() passing the
        // |this| value as the argument.
        var O = Object(this);
        // 2. Let lenValue be the result of calling the Get() internal
        // method of O with the argument "length".
        // 3. Let len be toUint32(lenValue).
        var len = O.length >>> 0;
        // 4. If isCallable(callback) is false, throw a TypeError exception. 
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== 'function') {
            throw new TypeError(callback + ' is not a function');
        }
        // 5. If thisArg was supplied, let T be thisArg; else let
        // T be undefined.
        if (arguments.length > 1) {
            T = arguments[1];
        }
        // 6. Let k be 0.
        k = 0;
        // 7. Repeat while k < len.
        while (k < len) {
            var kValue;
            // a. Let Pk be ToString(k).
            //    This is implicit for LHS operands of the in operator.
            // b. Let kPresent be the result of calling the HasProperty
            //    internal method of O with argument Pk.
            //    This step can be combined with c.
            // c. If kPresent is true, then
            if (k in O) {
                // i. Let kValue be the result of calling the Get internal
                // method of O with argument Pk.
                kValue = O[k];
                // ii. Call the Call internal method of callback with T as
                // the this value and argument list containing kValue, k, and O.
                callback.call(T, kValue, k, O);
            }
            // d. Increase k by 1.
            k++;
        }
        // 8. return undefined.
    };
}
if (!Function.prototype.bind) {
    Function.prototype.bind = function(oThis) {
        if (typeof this !== "function") {
            // closest thing possible to the ECMAScript 5
            // internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var aArgs   = Array.prototype.slice.call(arguments, 1);
        var fToBind = this;
        // tslint:disable-next-line:no-empty only-arrow-functions
        var fNOP    = function(this: any) {} as any as { new (): any; };
        var fBound  = function() {
                return fToBind.apply(this instanceof fNOP
                    ? this
                    : oThis,
                    aArgs.concat(Array.prototype.slice.call(arguments)));
            };

        if (this.prototype) {
            // Function.prototype doesn't have a prototype property
            fNOP.prototype = this.prototype;
        }
        fBound.prototype = new fNOP();

        return fBound;
    };
}
// tslint:enable
const html5elements = ("abbr article aside audio bdi canvas data datalist details dialog figcaption " +
    "figure footer header hgroup main mark meter nav output picture progress section summary template " +
    "time video").split(" ");
// this line makes IE6-8 recognise these elements as containers and style targets
html5elements.forEach((element) => {
    document.createElement(element);
});
// endpolyfill

export class ReadyManager {
    private static readonly classRegex = /(\w+)\s*?\(/g;
    private readonly readyCallbacks = [] as IAction[];
    private readonly loadCallbacks = [] as IAction[];
    private readonly state = {
        isLoaded: false,
        isReady: false
    };

    constructor() {
        this.isNowReady = this.isNowReady.bind(this);
        this.isNowLoaded = this.isNowLoaded.bind(this);
        if (document.readyState !== "loading") {
            this.isNowReady();
        } else if ("addEventListener" in document) {
            // the onload handler will trigger this handler if addEventListener isn't supported
            document.addEventListener("DOMContentLoaded", this.isNowReady);
        }
        if (document.readyState === "complete") {
            this.isNowLoaded();
        } else {
            if ("addEventListener" in window) {
                window.addEventListener("load", this.isNowLoaded);
            } else {
                (window as Window).attachEvent("onload", this.isNowLoaded);
            }
        }

        if (Object.freeze) {
            Object.freeze(this);
        }
    }

    /**
     * Run a function once the page is interactive (i.e. once all HTML has been loaded and parsed).
     * Runs the function now if the page is already interactive.
     * @param callback The function to call once ready
     * @param fallbackAction A function to run if the main function cannot be run for some reason
     */
    public whenReady(callback: () => void, fallbackAction?: () => void): void;
    /**
     * Run a function once the page is interactive (i.e. once all HTML has been loaded and parsed).
     * Runs the function now if the page is already interactive.
     * @param callback The object representation of the action to run
     */
    public whenReady(callback: IAction): void;
    public whenReady(callback: (() => void) | IAction, fallbackAction?: () => void): void {
        const action = typeof callback === "function" ?
            this.getAction(callback, fallbackAction) : callback;
        if (typeof callback === "object") {
            action.canBeLoaded = this.addPolyfill(callback.requirements);
        }
        if (this.state.isReady) {
            this.runAction(action);
        } else {
            this.readyCallbacks.push(action);
        }
    }

    /**
     * Run a function once the page is fully loaded (or now, if that has already happened)
     * @param callback The function to call once loaded
     * @param fallbackAction A function to run if the main function cannot be run for some reason
     */
    public whenLoaded(callback: () => void, fallbackAction?: () => void): void;
    /**
     * Run a function once the page is fully loaded (or now, if that has already happened)
     * @param callback The object representation of the action to run
     */
    public whenLoaded(callback: IAction): void;
    public whenLoaded(callback: (() => void) | IAction, fallbackAction?: () => void): void {
        const action = typeof callback === "function" ?
            this.getAction(callback, fallbackAction) : callback;
        if (typeof callback === "object") {
            action.canBeLoaded = this.addPolyfill(callback.requirements);
        }
        if (this.state.isLoaded) {
            this.runAction(action);
        } else {
            this.loadCallbacks.push(action);
        }
    }

    /**
     * Load a polyfill (if needed)
     * @param item The item to polyfill if not already supported
     * @returns {boolean} True if all features are implemented/polyfilled/being polyfilled, false if not
     */
    public addPolyfill(item: IFeature[]): boolean {
        let allLoading = true;
        // don't try to add polyfills on node!
        if (document.baseURI && document.baseURI.indexOf("http") === -1) { return; }
        item.forEach((i) => {
            // if the item is already loaded/loading, or is implementated natively, don't bother
            if (i.test() || i.loaded) { return; }
            // if this item can't be polyfilled, this code can't run.
            if (!i.polyfillSrc) {
                allLoading = false;
                return;
            }
            if (Array.isArray(i.polyfillRequires)) {
                // If this polyfill needs items that can't be polyfilled, this code can't run
                // TODO handle polyfill queuing
                if (!this.addPolyfill(i.polyfillRequires)) {
                    allLoading = false;
                    return;
                }
            }
            // mark this item as loading
            i.loaded = true;
            const script = document.createElement("script");
            script.onload = () => {
                script.onload = script.onreadystatechange = null;
                this.polyfillLoaded();
            };
            // startpolyfill (compiler directive)
            script.onreadystatechange = () => {
                if (script.readyState === "loaded" || script.readyState === "complete") {
                    script.onload = script.onreadystatechange = null;
                    this.polyfillLoaded();
                }
            };
            // endpolyfill
            script.onerror = () => {
                // todo run fallback action at this point
            };
            script.src = i.polyfillSrc;
            const head = document.head || document.getElementsByTagName("head")[0];
            head.appendChild(script);
        });
        return allLoading;
    }

    /**
     * Turn the passed paramaters into an action object, while adding any missed prerequisites
     * @param callback The function to call once loaded
     * @param fallbackAction A function to run if the main function cannot be run for some reason
     */
    private getAction(callback: () => void, fallbackAction?: () => void): IAction {
        const prerequisites = [] as IFeature[];
        const callbackText = callback.toString();
        if (callbackText) {
            let matches = ReadyManager.classRegex.exec(callbackText);
            while (matches && matches.length > 1) {
                // if you invoke a class on our 'Requirement' object, we know how to treat that as a prerequisite!
                if (Requirement.hasOwnProperty(matches[1])) {
                    prerequisites.push(Requirement[matches[1]]);
                }
                matches = ReadyManager.classRegex.exec(callbackText);
            }
        }
        const canBeLoaded = this.addPolyfill(prerequisites);
        return {
            action: callback,
            canBeLoaded,
            fallbackAction,
            requirements: prerequisites
        } as IAction;
    }

    private polyfillLoaded(): void {
        if (this.state.isReady) {
            this.runCallbacks(this.readyCallbacks);
        }
        if (this.state.isLoaded) {
            this.runCallbacks(this.loadCallbacks);
        }
    }

    private runAction(action: IAction): void {
        // we run actions in a timeout so that errors inside them do not kill the whole program
        if (action.fallbackAction && action.canBeLoaded) {
            // run the action with a fallback if things go wrong
            setTimeout(() => {
                try {
                    action.action();
                } catch (e) {
                    action.fallbackAction();
                    // rethrow the error so that it shows up in logging
                    throw e;
                }
            }, 1);
        } else if (action.fallbackAction && !action.canBeLoaded) {
            // if we need features that can't be polyfilled, run the fallback
            setTimeout(() => {
                action.fallbackAction();
            }, 1);
        } else if (action.canBeLoaded) {
            // no fallback, just run the main function
            setTimeout(() => {
                action.action();
            }, 1);
        }
    }

    private isNowReady(): void {
        if ("removeEventListener" in document) {
            document.removeEventListener("DOMContentLoaded", this.isNowReady);
        }
        this.state.isReady = true;
        this.runCallbacks(this.readyCallbacks);
    }

    private isNowLoaded(): void {
        if ("removeEventListener" in window) {
            window.removeEventListener("load", this.isNowLoaded);
        } else {
            (window as Window).detachEvent("onload", this.isNowLoaded);
        }
        // if we somehow missed the DOMContentLoaded event, fire isNowReady now
        if (!this.state.isReady) { this.isNowReady(); }
        this.state.isLoaded = true;
        this.runCallbacks(this.loadCallbacks);
    }

    /**
     * Go through the list of pending actions and run the ones with loaded dependencies
     * @param actionStack The array of actions to try and run
     */
    private runCallbacks(actionStack: IAction[]): void {
        for (let i = 0; i < actionStack.length; i++) {
            const action = actionStack[i];
            let dependenciesMet = true;
            action.requirements.forEach((requrement) => {
                if (!requrement.test()) {
                    dependenciesMet = false;
                }
            });
            if (dependenciesMet) {
                // remove the action from the stack
                actionStack.splice(i, 1);
                this.runAction(action);
            }
        }
    }
}
