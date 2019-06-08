export function loadBytecode(url: string, stdlib: any, foreign: any, pages: number,
                             callback: (exports: IModuleExports, buffer: ArrayBuffer) => void): void {
    if ("WebAssembly" in window) {
        const buffer = new ArrayBuffer(0x10000 * pages);
        url = `${url}.js`;
        loadAsmJs(url, stdlib, foreign, buffer, (exports) => {
            if (!exports) { throw new Error("Unable to load wasm code!"); }
            callback(exports, buffer);
        });
    } else if (typeof ArrayBuffer === "function") {
        const buffer = new ArrayBuffer(0x10000 * pages);
        url = url.replace(".wasm", ".asm.js");
        loadAsmJs(url, stdlib, foreign, buffer, (exports) => {
            if (!exports) { throw new Error("Unable to load asm.js code!"); }
            callback(exports, buffer);
        });
    } else {
        throw new Error("This browser doesn't support ArrayBuffer (i.e. older than IE10)!");
    }
}

declare var WebAssembly: WebAssembly;

// tslint:disable-next-line:interface-name
interface WebAssembly {
    instantiateStreaming: (source: Promise<Response>, importObject?: any) => Promise<WebAssemblyResult>;
    instantiate: (source: WebAssemblyModule | ArrayBuffer, importObject?: any)
                => Promise<WebAssemblyInstance> | Promise<WebAssemblyResult>;
    Memory: WebAssemblyMemory;
    Table: WebAssemblyTable;
}

// tslint:disable-next-line:interface-name
interface WebAssemblyResult {
    module: WebAssemblyModule;
    instance: WebAssemblyInstance;
}

// tslint:disable-next-line:interface-name
interface WebAssemblyModule {

}

// tslint:disable-next-line:interface-name
interface WebAssemblyInstance {
    exports: IModuleExports;
}

// tslint:disable-next-line:interface-name
interface WebAssemblyMemoryDescriptor {
    /**
     * The initial size of the WebAssembly Memory, in units of WebAssembly pages (64KB).
     */
    initial: number;
    /**
     * The maximum size the WebAssembly Memory is allowed to grow to, in units of WebAssembly pages (64KB).
     * When present, the maximum parameter acts as a hint to the engine to reserve memory up front.
     * However, the engine may ignore or clamp this reservation request.
     * In general, most WebAssembly modules shouldn't need to set a maximum.
     */
    maximum?: number;
}

declare class WebAssemblyMemory {
    /**
     * An accessor property that returns the buffer contained in the memory.
     */
    public buffer: ArrayBuffer;
    /**
     * The grow() protoype method of the Memory object increases the size of
     * the memory instance by a specified number of WebAssembly pages (64KB).
     */
    public grow: (pages: number) => void;
    constructor(options: WebAssemblyMemoryDescriptor);
}

declare class WebAssemblyTable {
    /**
     * Returns the length of the table, i.e. the number of elements.
     */
    public length: number;
    /**
     * Accessor function — gets the element stored at a given index.
     */
    // tslint:disable-next-line:ban-types
    public get: (index: number) => Function;
    /**
     * Sets an element stored at a given index to a given value.
     */
    // tslint:disable-next-line:ban-types
    public set: (index: number, value: Function) => void;
    /**
     * Increases the size of the Table instance by a specified number of elements.
     */
    public grow: (elements: number) => void;
    constructor(options: WebAssembleTableDescriptor);
}

// tslint:disable-next-line:interface-name
interface WebAssembleTableDescriptor {
    /**
     * A string representing the type of value to be stored in the table.
     * At the moment this can only have a value of "anyfunc" (functions).
     */
    element: string;
    /**
     * The initial number of elements of the WebAssembly Table.
     */
    initial: number;
    /**
     * The maximum number of elements the WebAssembly Table is allowed to grow to.
     */
    maximum?: number;
}

/**
 * MDN-inspired code to load WebAssembly from the net only if it wasn't already cached
 * @link https://github.com/mdn/webassembly-examples/blob/master/wasm-utils.js
 */
function loadWebAssembly(url: string, callback: (instance: WebAssemblyInstance) => void, importObject?: any): void {
    fetchWebassembly(url, importObject).then((results) => {
        callback(results.instance);
    });
}

function fetchWebassembly(url: string, importObject?: any): Promise<WebAssemblyResult> {
    // all browsers that support WebAssembly support fetch
    const fetchedBytes = fetch(url);
    if ("instantiateStreaming" in WebAssembly) {
        return WebAssembly.instantiateStreaming(fetchedBytes, importObject);
    } else {
        return fetchedBytes.then((response) =>
            response.arrayBuffer()
        ).then((bytes) =>
            WebAssembly.instantiate(bytes, importObject) as Promise<WebAssemblyResult>
        );
    }
}

interface IModuleExports {
    [label: string]: (...args: any[]) => any;
}

/**
 * Loads and compiles asm.js code from the server
 * @param url The url to load your asm.js code from
 * @param stdlib The standard library that you want to pass to your code
 * @param foreign Any JavaScript functions you want to pass to your code
 * @param buffer The memory allocated for your function
 * @param callback A callback function that will be called with the module exports (or null, if there was an error)
 */
function loadAsmJs(url: string, stdlib: any, foreign: any, buffer: ArrayBuffer,
                   callback: (module: IModuleExports) => void): void {
    const urlParts = url.split("/");
    const moduleFileName = urlParts[urlParts.length - 1].replace(/\./g, "");
    // first, check if the module has already been loaded
    if (moduleFileName in window) {
        instantiateAsmJs(moduleFileName, buffer, callback);
    } else {
        // otherwise load it now
        const script = document.createElement("script");
        script.onerror = () => {
            callback(null);
        };
        script.onload = () => {
            instantiateAsmJs(moduleFileName, buffer, callback);
        };
        script.src = url;
        document.head.appendChild(script);
    }
}

/**
 * Loads and compiles asm.js code from the server
 * @param moduleFileName The name of your module's creation code (by convention [name]asmjs)
 * @param stdlib The standard library that you want to pass to your code
 * @param foreign Any JavaScript functions you want to pass to your code
 * @param buffer The memory allocated for your function
 * @param callback A callback function that will be called with the module exports (or null, if there was an error)
 */
function instantiateAsmJs(moduleFileName: string, buffer: ArrayBuffer, callback: (module: IModuleExports) => void) {
    let instance = {} as any;
    // @ts-ignore: No index on window
    instance = window[moduleFileName]({
        TOTAL_MEMORY: buffer.byteLength,
        TOTAL_STACK: buffer.byteLength,
        buffer,
        onRuntimeInitialized: () => {
            // give it a milisecond for the object reference to set
            setTimeout(() => {
                callback(instance.asm);
            }, 1);
        }
    });
}
