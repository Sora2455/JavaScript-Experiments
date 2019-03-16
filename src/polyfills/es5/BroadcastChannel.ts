"use strict";
interface IChannelList {
    [index: string]: BCPollyfill[];
}
interface Window {
    BroadcastChannel: Function;
}
/**
 * @see https://gist.github.com/inexorabletash/52f437d1451d12145264
 */
class BCPollyfill {
    private static channels = {} as IChannelList;
    private _name: string;
    private _id: string;
    private _closed: boolean;
    private _mc: MessageChannel;

    constructor(channel: string) {
        channel = String(channel);

        const id = "$BroadcastChannel$" + channel + "$";

        BCPollyfill.channels[id] = BCPollyfill.channels[id] || [];
        BCPollyfill.channels[id].push(this);

        this._name = channel;
        this._id = id;
        this._closed = false;
        this._mc = new MessageChannel();
        this._mc.port1.start();
        this._mc.port2.start();

        self.addEventListener("storage", (e) => {
            if (e.storageArea !== self.localStorage) { return; }
            if (e.newValue === null) { return; }
            if (e.key.substring(0, id.length) !== id) { return; }
            const data = JSON.parse(e.newValue);
            this._mc.port2.postMessage(data);
        });
    }

    get name() { return this._name; }
    public postMessage(message: any): void {
        if (this._closed) {
            const e = new Error();
            e.name = "InvalidStateError";
            throw e;
        }
        const value = JSON.stringify(message);

        // Broadcast to other contexts via storage events...
        const key = this._id + String(Date.now()) + "$" + String(Math.random());
        self.localStorage.setItem(key, value);
        setTimeout(() => { self.localStorage.removeItem(key); }, 500);

        // Broadcast to current context via ports
        BCPollyfill.channels[this._id].forEach((bc) => {
            if (bc === this) { return; }
            bc._mc.port2.postMessage(JSON.parse(value));
        });
    }
    public close(): void {
        if (this._closed) { return; }
        this._closed = true;
        this._mc.port1.close();
        this._mc.port2.close();

        const index = BCPollyfill.channels[this._id].indexOf(this);
        BCPollyfill.channels[this._id].splice(index, 1);
    }

    // EventTarget API
    get onmessage() { return this._mc.port1.onmessage; }
    set onmessage(value) { this._mc.port1.onmessage = value; }
    public addEventListener(type: "message" | "messageerror",
                            listener: (this: MessagePort, ev: MessageEvent) => any /*, useCapture*/): void {
        return this._mc.port1.addEventListener.apply(this._mc.port1, arguments);
    }
    public removeEventListener(type: "message" | "messageerror",
                               listener: (this: MessagePort, ev: MessageEvent) => any /*, useCapture*/): void {
        return this._mc.port1.removeEventListener.apply(this._mc.port1, arguments);
    }
    public dispatchEvent(event: Event): void {
        return this._mc.port1.dispatchEvent.apply(this._mc.port1, arguments);
    }
}

self.BroadcastChannel = self.BroadcastChannel || BCPollyfill;
