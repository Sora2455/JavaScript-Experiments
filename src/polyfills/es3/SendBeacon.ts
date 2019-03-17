// original pollyfill based on https://github.com/miguelmota/Navigator.sendBeacon
if (navigator && !navigator.sendBeacon) {
    navigator.sendBeacon =
    (url: string, data?: Blob | Int8Array | Int16Array | Int32Array |
        Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array |
        Float64Array | DataView | ArrayBuffer | FormData | string | null) => {
            const currentEvent = self.event && self.event.type;
            const needSyncRequest = currentEvent === "unload" || currentEvent === "beforeunload";

            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, !needSyncRequest);
            xhr.withCredentials = true;
            xhr.setRequestHeader("Accept", "*/*");

            if (typeof data === "string") {
                xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
                xhr.responseType = "text";
            } else if (data instanceof Blob && data.type) {
                xhr.setRequestHeader("Content-Type", data.type);
            }

            try {
                xhr.send(data);
            } catch (error) {
                return false;
            }

            return true;
    };
}
