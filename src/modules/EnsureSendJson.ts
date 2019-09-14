import {ReadyManager} from "./readyManager.js";

declare global {
    interface IDBTransaction {
        /**
         * Signal that we won't be adding any more reads or writes in callback functions -
         * the transaction can be resolved and closed. This lets us write to the DB in a page unload scenario.
         */
        commit: () => void;
    }
}
interface IPendingSendCallbacks {
    [id: number]: (result: any, statusCode: number) => void;
}
interface IPendingSend {
    id?: number;
    jsonString: string;
    endpoint: string;
}
interface ISendResult {
    id: number;
    result: any;
    statusCode: number;
}
const pendingSendCallbacks = {} as IPendingSendCallbacks;

// Keep these constants in sync with ensureSendJsonSw.ts
const dataBaseName = "pendingJsonSends";
const tableName = "outbox";
const syncTag = "sendJSON";
const messageEventType = "syncCompleted";
const storageKey = "sendJSON-outbox";

let dbConnection: IDBDatabase;
const supportsIndexedDb = typeof indexedDB === "object";
const supportsSyncManager = typeof SyncManager === "function";
const commitSupport = typeof IDBTransaction.prototype.commit === "function";

/**
 * Send JSON to the given endpoint, regardless if we are offline or if the page is unloading
 * @param endpoint The endpoint to send JSON to
 * @param jsonString The (already stringified) JSON to send
 * @param callback An optional callback to run if the JSON sends when the page is still open
 */
export function postJson(endpoint: string, jsonString: string,
                         callback?: (result: any, statusCode: number) => void): void {
    const currentEvent = self.event && self.event.type;
    const isUnloading = currentEvent === "unload" || currentEvent === "beforeunload" ||
                        currentEvent === "pagehide" || currentEvent === "freeze";
    if (!supportsIndexedDb) {
        // If we don't support indexedDb (Internet Explorer 9-)
        // then we can't save the data to retry later - we have to try now
        // We can fallback to LocalStorage if we have to, though it isn't great
        trySendJson(endpoint, jsonString, isUnloading, callback);
    } else if (isUnloading) {
        // The async indexedDb doesn't work when the page is unloading
        saveToDataBaseSync(endpoint, jsonString);
    } else {
        // Now we store our JSON in the indexedDb, so that we know what to try again if we fail the first time
        saveToDataBase(endpoint, jsonString, callback);
    }
}

/**
 * Open a connection to the pending JSON database as a Promise
 */
function openDb(openCallback?: (db: IDBDatabase) => void,
                errorCallback?: () => void): void {
    if (dbConnection instanceof IDBDatabase) {
        openCallback(dbConnection);
    }
    const openRequest = self.indexedDB.open(dataBaseName, 1);
    if (errorCallback) {
        openRequest.onerror = openRequest.onblocked = errorCallback;
    }
    openRequest.onsuccess = () => {
        dbConnection = openRequest.result;
        if (openCallback) {
            openCallback(dbConnection);
        }
    };
    openRequest.onupgradeneeded = (ev) => {
        const db = openRequest.result;
        if (ev.oldVersion === 0) {
            db.createObjectStore(tableName, { autoIncrement : true, keyPath: "id" });
        }
    };
}

/**
 * Save the JSON request to the database so that if our initial attempt failed we can try again
 * @param endpoint The endpoint to send JSON to
 * @param jsonString The (already stringified) JSON to send
 * @param callback An optional callback to run if the JSON sends when the page is still open
 */
function saveToDataBase(endpoint: string, jsonString: string,
                        callback?: (result: any, statusCode: number) => void) {
    openDb((db) => {
        const transaction = db.transaction(tableName, "readwrite");
        const storeAttempt = transaction.objectStore(tableName).put({endpoint, jsonString} as IPendingSend);
        transaction.oncomplete = () => {
            if (callback) {
                const id = storeAttempt.result as number;
                // Store our callback in case we successfully send while the page is still open
                pendingSendCallbacks[id] = callback;
            }
            if (supportsSyncManager) {
                self.navigator.serviceWorker.ready.then((registation) => {
                    return registation.sync.register(syncTag);
                }, () => {
                    // If for some reason we can't register, try to send now
                    trySendOutbox();
                });
            } else {
                // If we can't rely on the service worker, try and send it now
                trySendOutbox();
            }
        };
        transaction.onerror = () => {
            // It shouldn't be possible for this add to fail, but just in case
            // fall back to LocalStorage if we have to
            trySendJson(endpoint, jsonString, false, callback);
        };
    }, () => {
        // If we can't open the DB for some reason (maybe we're in a Firefox private window) just try to send now
        trySendJson(endpoint, jsonString, false, callback);
    });
}

/**
 * Save the JSON request to the database so that if our initial attempt failed we can try again
 * (syncronously, as the page is currently unloading)
 * @param endpoint The endpoint to send JSON to
 * @param jsonString The (already stringified) JSON to send
 * @param callback An optional callback to run if the JSON sends when the page is still open
 */
function saveToDataBaseSync(endpoint: string, jsonString: string) {
    if (commitSupport) {
        // We need the ability to commit transactions to ensure that we save to the DB during unload
        openDb((db) => {
            const transaction = db.transaction(tableName, "readwrite");
            if (supportsSyncManager) {
                transaction.oncomplete = () => {
                    self.navigator.serviceWorker.ready.then((registation) => {
                        return registation.sync.register(syncTag);
                    });
                };
            }
            transaction.onerror = () => {
                // It shouldn't be possible for this add to fail, but just in case
                // fall back to LocalStorage if we have to
                trySendJson(endpoint, jsonString, true);
            };
            transaction.objectStore(tableName).put({endpoint, jsonString} as IPendingSend);
            transaction.commit();
        }, () => {
            // If we can't open the DB for some reason (maybe we're in a Firefox private window) just try to send now,
            // and if not possible to record so in localStorage
            trySendJson(endpoint, jsonString, true);
        });
    } else {
        // Otherwise try to send now, and if not possible to record so in localStorage
        trySendJson(endpoint, jsonString, true);
    }
}

/**
 * Try to send the JSON data, and store it in localStorage for later if not possible
 * (e.g. we're offline)
 * @param endpoint The endpoint to send JSON to
 * @param jsonString The (already stringified) JSON to send
 * @param isUnloading True IFF the page is currently being unloaded
 * @param callback An optional callback to run if the JSON sends when the page is still open
 */
function trySendJson(endpoint: string, jsonString: string, isUnloading: boolean,
                     callback?: (result: any, statusCode: number) => void): void {
    const onError = self.localStorage ? () => {
        // If we can't send the json now, we need to use the synchronous localStorage API
        // (As we might be mid-unload)
        const existingPendingSends = JSON.parse(
            self.localStorage.getItem(storageKey) || "[]"
        ) as IPendingSend[];
        existingPendingSends.push({endpoint, jsonString} as IPendingSend);
        // It is possible to corrupt the data if two threads are trying to add/read data at once, which is why
        // we use it only as a fallback
        self.localStorage.setItem(storageKey, JSON.stringify(existingPendingSends));
    } : undefined;
    sendJson(endpoint, jsonString, isUnloading, callback, onError);
}

/**
 * Actually send the JSON to the server
 * @param endpoint The endpoint to send the JSON to
 * @param jsonString The (already stringified) JSON to send
 * @param isUnloading True IFF the page is currently being unloaded
 * @param callback An optional callback to run if the JSON sends successfully
 * @param onError An optional callback to run if the JSON fails to send (network error)
 */
function sendJson(endpoint: string, jsonString: string, isUnloading: boolean,
                  callback?: (result: any, statusCode: number) => void,
                  onError?: (e: any) => void): void {
    let jsonScheduled = false;
    // If the page is unloading and we have access to sendBeacon, use that to send the JSON
    if (isUnloading && self.navigator && self.navigator.sendBeacon) {
        try {
            const blob = jsonString ? new Blob([jsonString], {type: "application/json"}) : undefined;
            jsonScheduled = self.navigator.sendBeacon(endpoint, blob);
        } catch (e) {
            // Chrome currently has a bug where it throws an exception
            // when trying to send JSON to a server with sendBeacon
            // https://bugs.chromium.org/p/chromium/issues/detail?id=724929
            jsonScheduled = false;
        }
    }
    // Otherwise, use XMLHttpRequest to send the JSON
    if (!jsonScheduled) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, !isUnloading);
            xhr.setRequestHeader("Content-Type", "application/json");
            // We prefer JSON responses if possible, though an empty response is acceptable
            xhr.setRequestHeader("Accept", "application/json, */*;q=0.5");
            xhr.send(jsonString);
            // We can't set callback on sendBeacon, so for consistency the fallback won't either
            if (callback && !isUnloading) {
                xhr.onload = () => {
                    if (xhr.responseText) {
                        callback(JSON.parse(xhr.responseText), xhr.status);
                    } else {
                        callback(null, xhr.status);
                    }
                };
            }
            if (onError) {
                // Asyncronous XHR will have their errors handled here
                xhr.onerror = onError;
            }
        } catch (e) {
            if (onError) {
                // Syncronous XHR will have their errors handled here
                onError(e);
            }
        }
    }
}

/**
 * Try to send all the pending JSON calls in the outbox
 */
function trySendOutbox(): void {
    // If we're not online, don't bother continuing
    if (self.navigator.onLine === false) {
        return;
    }
    // Then try to take any LocalStorage records and put them in the IndexedDb if possible, send them if not,
    // put them back if we must
    if (self.localStorage) {
        const localStoragePendingSends = JSON.parse(
            self.localStorage.getItem(storageKey) || "[]"
        ) as IPendingSend[];
        // It is possible that we might lose data if two threads are accessing this at once,
        // or if there is an error during sending, so this is used only as a fallback
        self.localStorage.removeItem(storageKey);
        if (localStoragePendingSends.length > 0) {
            if (supportsIndexedDb) {
                openDb((db) => {
                    const transaction = db.transaction(tableName, "readwrite");
                    localStoragePendingSends.forEach((pendingSend) => {
                        const storeAttempt = transaction.objectStore(tableName).put({
                            endpoint: pendingSend.endpoint,
                            jsonString: pendingSend.jsonString
                        } as IPendingSend);
                        storeAttempt.onerror = () => {
                            // If we can't add this row for whatever reason, we have to try and send it now
                            // and put it back in localStorage if we can't
                            trySendJson(pendingSend.endpoint, pendingSend.jsonString, false);
                        };
                    });
                }, () => {
                    // If we can't add this row for whatever reason, we have to try and send it now
                    // and put it back in localStorage if we can't
                    localStoragePendingSends.forEach((pendingSend) => {
                        trySendJson(pendingSend.endpoint, pendingSend.jsonString, false);
                    });
                });
            } else {
                // If we don't support IndexedDb, then we have to try and send it now
                // and put it back in localStorage if we can't
                localStoragePendingSends.forEach((pendingSend) => {
                    trySendJson(pendingSend.endpoint, pendingSend.jsonString, false);
                });
            }
        }
    }

    if (self.navigator.serviceWorker) {
        // If possible, let the service worker handle this (as then we avoid multi-thread issues)
        self.navigator.serviceWorker.ready.then((reg) => {
            reg.active.postMessage(syncTag);
        });
    } else if (supportsIndexedDb) {
        // Otherwise we have to hope that we are the only tab open for this origin
        openDb((db) => {
            const transaction = db.transaction(tableName, "readonly");
            const objectStore = transaction.objectStore(tableName);
            const getAllRequest = objectStore.getAll();

            getAllRequest.onsuccess = () => {
                getAllRequest.result.forEach((call: IPendingSend) => {
                    // Attempt to re-send each call
                    sendJson(call.endpoint, call.jsonString, false, (result, status) => {
                        // If the call succeeded, we can remove the outbox record
                        confirmRecordSent(call.id, result, status);
                    });
                });
            };
        });
    }
}

/**
 * Confirm that a record has been sent and delete it from the outbox
 * @param id The ID of the outbox entry that has now been sent
 * @param result The response send by the server to our POST request
 * @param statusCode The HTTP status code of the POST request
 */
function confirmRecordSent(id: number, result: any, statusCode: number) {
    // Remove the outbox entry (as we don't want to send the request twice)
    openDb((db) => {
        const transaction = db.transaction(tableName, "readwrite");
        transaction.objectStore(tableName).delete(id);
    });
    if (self.localStorage) {
        // Use message events to let other tabs know (IE 10-11)
        const sendResult = {id, result, statusCode} as ISendResult;
        self.localStorage.setItem(syncTag, JSON.stringify(sendResult));
        self.localStorage.removeItem(syncTag);
    }

    // If we still remember the original callback, run it now
    tryRunCallback(id, result, statusCode);
}

/**
 * Try to run the JSON callback, if the page still remembers it
 * @param id The ID of the outbox entry that has now been sent
 * @param result The response send by the server to our POST request
 * @param statusCode The HTTP status code of the POST request
 */
function tryRunCallback(id: number, result: any, statusCode: number) {
    // If we still remember the original callback, run it now
    if (pendingSendCallbacks.hasOwnProperty(id)) {
        pendingSendCallbacks[id](result, statusCode);
        delete pendingSendCallbacks[id];
    }
}

if (self.navigator.serviceWorker) {
    // If we support serviceWorkers, we need to know when our JSON is sent so we can
    // run callbacks
    self.navigator.serviceWorker.addEventListener("message", (ev) => {
        if (ev.data && ev.data.type === messageEventType && typeof ev.data.id === "number") {
            tryRunCallback(ev.data.id, ev.data.result, ev.data.statusCode);
        }
    });
} else {
    // Otherwise we have to use storage events becuase other tabs/windows might send our JSON
    // for us
    self.addEventListener("storage", (ev) => {
        if (ev.key === syncTag && ev.newValue) {
            const sendResult = JSON.parse(ev.newValue) as ISendResult;
            tryRunCallback(sendResult.id, sendResult.result, sendResult.statusCode);
        }
    });
}

// Begin opening the DB connection right away so that we can use it when the page unloads
openDb();

if (!supportsSyncManager) {
    // For users that don't have background sync, try sending if
    // the internet reconnects while the page is still loaded
    self.addEventListener("online", trySendOutbox);
    // Or if the page has just loaded, try sending entries in the outbox now
    (new ReadyManager()).whenLoaded(trySendOutbox);
}

if (self.document) {
    self.document.addEventListener("freeze", () => {
        // If the document is being frozen, close our DB connection (if it was opened successfully)
        if (dbConnection instanceof IDBDatabase) {
            dbConnection.close();
            dbConnection = null;
        }
    });

    self.document.addEventListener("resume", () => {
        // If the document is being thawed out, open the DB connection again
        openDb();
    });
}
