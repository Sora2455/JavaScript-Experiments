interface IPendingSend {
    id?: number;
    jsonString: string;
    endpoint: string;
}

// Keep these constants in sync with EnsureSendJson.ts
const dataBaseName = "pendingJsonSends";
const tableName = "outbox";
const syncTag = "sendJSON";
const messageEventType = "syncCompleted";

/**
 * Open a connection to the pending JSON database as a Promise
 */
function openPendingJsonDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(dataBaseName, 1);
        openRequest.onerror = openRequest.onblocked = reject;
        openRequest.onsuccess = () => {
            resolve(openRequest.result);
        };
        openRequest.onupgradeneeded = (ev) => {
            const db = openRequest.result;
            if (ev.oldVersion === 0) {
                db.createObjectStore(tableName, { autoIncrement : true, keyPath: "id" });
            }
        };
    });
}

/**
 * Get the first pending send in the database
 * @param db A IndexedDb connection to the pending send database
 */
function getPendingSend(db: IDBDatabase): Promise<IPendingSend> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(tableName, "readonly");
        const objectStore = transaction.objectStore(tableName);
        const cursorRequest = objectStore.openCursor();
        cursorRequest.onsuccess = () => {
            resolve(cursorRequest.result && cursorRequest.result.value);
        };
        cursorRequest.onerror = reject;
    });
}

/**
 * Delete a specific record from the pending send table
 * @param db A IndexedDb connection to the pending send database
 * @param id The ID of the pending send to delete
 */
function deletePendingSend(db: IDBDatabase, id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(tableName, "readwrite");
        const getAllRequest = transaction.objectStore(tableName).delete(id);
        getAllRequest.onsuccess = () => {
            resolve();
        };
        getAllRequest.onerror = reject;
    });
}

/**
 * Send the pending JSON POSTs
 */
async function sendPendingJson(): Promise<void> {
    const db = await openPendingJsonDb();
    let pendingSend = await getPendingSend(db);
    while (pendingSend) {
        const result = await fetch(pendingSend.endpoint, {
            body: pendingSend.jsonString,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json, */*;q=0.5"
            },
            method: "POST"
        });
        const status = result.status;
        const resultJson = await result.json();
        await deletePendingSend(db, pendingSend.id);
        const clients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({
                id: pendingSend.id,
                result: resultJson,
                statusCode: status,
                type: messageEventType
            });
        });

        pendingSend = await getPendingSend(db);
    }
}

function onSync(ev: SyncEvent): void {
    if (ev.tag === syncTag) {
        ev.waitUntil(sendPendingJson());
    }
}

function onMessage(ev: MessageEvent): void {
    if (ev.data === syncTag) {
        sendPendingJson();
    }
}

addEventListener("sync", onSync);
addEventListener("message", onMessage);
