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
 * TODO: make this part an imported script
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

function getPendingSends(db: IDBDatabase): Promise<IPendingSend[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(tableName, "readonly");
        const objectStore = transaction.objectStore(tableName);
        const getAllRequest = objectStore.getAll();

        getAllRequest.onsuccess = () => {
            resolve(getAllRequest.result);
        };
        getAllRequest.onerror = reject;
    });
}

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

async function sendPendingJson(): Promise<void> {
    const db = await openPendingJsonDb();
    const pendingSends = await getPendingSends(db);
    const pendingSendPromises = pendingSends.map((send) => {
        return async () => {
            const result = await fetch(send.endpoint, {
                body: send.jsonString,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json, */*;q=0.5"
                },
                method: "POST"
            });
            const status = result.status;
            const resultJson = await result.json();
            await deletePendingSend(db, send.id);
            const clients = await (self as ServiceWorkerGlobalScope).clients.matchAll();
            clients.forEach((client) => {
                client.postMessage({
                    id: send.id,
                    result: resultJson,
                    statusCode: status,
                    type: messageEventType
                });
            });
        };
    });
    // Run through the pending sends in the order we recieved them
    await pendingSendPromises.reduce((prev, cur) => prev.then(cur), Promise.resolve());
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
