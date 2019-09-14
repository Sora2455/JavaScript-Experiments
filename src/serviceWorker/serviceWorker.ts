importScripts("workers/ensureSendJsonSw.min.js");

/**
 * Moves the contents of one named cached into another.
 * @param source The name of the cache to move from
 * @param destination The name of the cache to move into
 */
function cacheCopy(source: string, destination: string) {
    "use strict";
    return caches.delete(destination).then(() => {
        return Promise.all([
            caches.open(source),
            caches.open(destination)
        ]).then((results) => {
            const sourceCache = results[0];
            const destCache = results[1];

            return sourceCache.keys().then((requests: ReadonlyArray<Request>) => {
                return Promise.all(requests.map((request) => {
                    return sourceCache.match(request).then((response) => {
                        return destCache.put(request, response);
                    });
                }));
            });
        });
    });
}

/**
 * When the service worker is being intalled, download the required assets into a temporary cache
 * @param e The intall event
 */
function installHander(e: ExtendableEvent): void {
    "use strict";
    // Put updated resources in a new cache, so that currently running pages
    // get the current versions.
    e.waitUntil(caches.delete("core-waiting").then(() => {
        return caches.open("core-waiting").then((core) => {
            const resourceUrls = [
                // TODO get the needed resourse URLs
            ] as string[];

            return Promise.all(resourceUrls.map((key) => {
                // Make sure to download fresh versions of the files!
                return fetch(key, { cache: "no-cache" })
                    .then((response) => core.put(key, response));
            }))
            // Don't wait for the client to refresh the page (as this site is designed not to refresh)
            .then(() => (self as ServiceWorkerGlobalScope).skipWaiting());
        });
    }));
}

/**
 * When the service worker is being activated, move our assets from the temporary cache to our main cache
 * @param e The install event
 */
function activationHander(e: ExtendableEvent): void {
    "use strict";
    // Copy the newly installed cache to the active cache
    e.waitUntil(cacheCopy("core-waiting", "core")
        // Declare that we'll be taking over now
        .then(() => (self as ServiceWorkerGlobalScope).clients.claim())
        // Delete the waiting cache afterward to save client memory space
        .then(() => caches.delete("core-waiting")));
}

addEventListener("install", installHander);
addEventListener("activate", activationHander);
