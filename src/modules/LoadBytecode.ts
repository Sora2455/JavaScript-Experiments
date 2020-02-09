export function loadBytecode(url: string, imports: any, pages: number,
                             callback: (exports: IModuleExports, buffer: ArrayBuffer) => void): void {
    if (typeof WebAssembly !== "undefined") {
        // TODO Chrome/Safari currently don't allow WASM under CSP as they think it's eval
        const wasmMemory = new WebAssembly.Memory({initial: 10, maximum: 100});
        const wasmTable = new WebAssembly.Table({
            element: "anyfunc",
            initial: 1,
            maximum: 1 + 0
        });
        // tslint:disable-next-line:no-empty
        const noop = () => {};
        const asmLibraryArg = {
            args_get: noop,
            args_sizes_get: noop,
            memory: wasmMemory,
            proc_exit: noop,
            table: wasmTable
        };
        loadWebAssembly(url, (instance) => {
            if (!instance || !instance.exports) { throw new Error("Unable to load wasm code!"); }
            callback(instance.exports, wasmMemory.buffer);
        }, {
            env: asmLibraryArg,
            imports,
            wasi_snapshot_preview1: asmLibraryArg
        });
    } else if (typeof ArrayBuffer === "function") {
        const buffer = new ArrayBuffer(0x10000 * pages);
        url = url.replace(".wasm", ".asm.js");
        loadAsmJs(url, imports, buffer, (exports) => {
            if (!exports) { throw new Error("Unable to load asm.js code!"); }
            callback(exports, buffer);
        });
    } else {
        // TODO: Polyfill Math.imut and the other 3 methods needed
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
    /** A typed array or ArrayBuffer containing the binary code of the .wasm module you want to compile. */
    bufferSource: ArrayBuffer;
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

// tslint:disable-next-line:interface-name
declare interface WebAssemblyMemory {
    /**
     * An accessor property that returns the buffer contained in the memory.
     */
    buffer: ArrayBuffer;
    /**
     * The grow() protoype method of the Memory object increases the size of
     * the memory instance by a specified number of WebAssembly pages (64KB).
     */
    grow: (pages: number) => void;
    // tslint:disable-next-line:no-misused-new
    new(options: WebAssemblyMemoryDescriptor): WebAssemblyMemory;
}

// tslint:disable-next-line:interface-name
declare interface WebAssemblyTable {
    /**
     * Returns the length of the table, i.e. the number of elements.
     */
    length: number;
    /**
     * Accessor function — gets the element stored at a given index.
     */
    // tslint:disable-next-line:ban-types
    get: (index: number) => Function;
    /**
     * Sets an element stored at a given index to a given value.
     */
    // tslint:disable-next-line:ban-types
    set: (index: number, value: Function) => void;
    /**
     * Increases the size of the Table instance by a specified number of elements.
     */
    grow: (elements: number) => void;
    // tslint:disable-next-line:no-misused-new
    new(options: WebAssembleTableDescriptor): WebAssemblyTable;
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
 * MDN-inspired code to load WebAssembly from the net
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

declare global {
    // tslint:disable-next-line:interface-name
    interface Window {
        Module: IAsmModule;
    }
}

interface IAsmModule {
    wasm: ArrayBuffer;
    mem: ArrayBuffer;
}

/**
 * Loads and compiles asm.js code from the server
 * @param url The url to load your asm.js code from
 * @param imports Any JavaScript functions you want to pass to your code
 * @param buffer The memory allocated for your function
 * @param callback A callback function that will be called with the module exports (or null, if there was an error)
 */
function loadAsmJs(url: string, imports: any, buffer: ArrayBuffer,
                   callback: (module: IModuleExports) => void): void {
    // Set up initialisation paramatars
    self.Module = {
        mem: new ArrayBuffer(0),
        wasm: new ArrayBuffer(0)
    };
    const script = document.createElement("script");
    script.onerror = () => {
        callback(null);
    };
    script.onload = () => {
        instantiateAsmJs(buffer, imports, callback);
    };
    script.src = url;
    document.head.appendChild(script);
}

/**
 * Loads and compiles asm.js code from the server
 * @param imports Any JavaScript functions you want to pass to your code
 * @param buffer The memory allocated for your function
 * @param callback A callback function that will be called with the module exports (or null, if there was an error)
 */
function instantiateAsmJs(buffer: ArrayBuffer, imports: any, callback: (module: IModuleExports) => void) {
    // TODO actually use the buffer somewhere
    (WebAssembly.instantiate(self.Module.wasm, imports) as PromiseLike<any>).then((output) => {
        callback(output.instance.exports);
    });
}
