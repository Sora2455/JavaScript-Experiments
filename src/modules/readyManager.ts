declare global {
    // tslint:disable-next-line:interface-name
    interface HTMLScriptElement {
        readyState: string;
        onreadystatechange: () => void;
    }
    // tslint:disable-next-line:interface-name
    interface Window {
        /**
         * A property both IE and Edge left exposed to the window that they probably shouldn't have
         */
        StyleMedia: any;
        /**
         * A flag set on the window to let us know that the fix for Trident/EdgeHTML's datalist implementation
         * (which searches only the beginning of the string, not the whole string) is in place.
         */
        msDataListFix: boolean;
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

interface IAction {
    /**
     * The action to attempt
     */
    action: () => void;
    /**
     * A fallback action to try if the main action cannot be completed (optional)
     */
    fallbackAction?: () => void;
}

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
        } else {
            // the onload handler will trigger this handler if DOMContentLoaded doesn't fire for some reason
            document.addEventListener("DOMContentLoaded", this.isNowReady);
        }
        if (document.readyState === "complete") {
            this.isNowLoaded();
        } else {
            window.addEventListener("load", this.isNowLoaded);
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
    public whenReady(callback: () => void, fallbackAction?: () => void): void {
        const action = this.getAction(callback, fallbackAction);
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
    public whenLoaded(callback: () => void, fallbackAction?: () => void): void {
        const action = this.getAction(callback, fallbackAction);
        if (this.state.isLoaded) {
            this.runAction(action);
        } else {
            this.loadCallbacks.push(action);
        }
    }

    /**
     * Turn the passed paramaters into an action object, while adding any missed prerequisites
     * @param callback The function to call once loaded
     * @param fallbackAction A function to run if the main function cannot be run for some reason
     */
    private getAction(callback: () => void, fallbackAction?: () => void): IAction {
        return {
            action: callback,
            fallbackAction
        } as IAction;
    }

    private runAction(action: IAction): void {
        // we run actions in a timeout so that errors inside them do not kill the whole program
        const fallback = action.fallbackAction;
        if (fallback) {
            // run the action with a fallback if things go wrong
            setTimeout(() => {
                try {
                    action.action();
                } catch (e) {
                    fallback();
                    // rethrow the error so that it shows up in logging
                    throw e;
                }
            }, 1);
        } else {
            // no fallback, just run the main function
            setTimeout(() => {
                action.action();
            }, 1);
        }
    }

    private isNowReady(): void {
        document.removeEventListener("DOMContentLoaded", this.isNowReady);
        this.state.isReady = true;
        this.runCallbacks(this.readyCallbacks);
    }

    private isNowLoaded(): void {
        window.removeEventListener("load", this.isNowLoaded);
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
        for (let i = actionStack.length; i--;) {
            const action = actionStack[i];
            if (!action) { continue; }
            // remove the action from the stack
            actionStack.splice(i, 1);
            this.runAction(action);
        }
    }
}
