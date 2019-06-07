interface ISearchResult {
    label: string;
    key: string;
}

interface IStringUsedDictionary {
    [label: string]: boolean;
}

declare type AutoCompleteSearchFunction = (text: string, callback: (results: ISearchResult[]) => void) => void;

interface IAutoSearchOptions {
    minLength?: number;
    searchDelay?: number;
    startingResults: ISearchResult[];
}

let lastId = typeof performance === "object" && typeof performance.now === "function" ?
                performance.now() : (new Date()).getTime();
/**
 * Get a unique ID for dynamically created HTML
 * @param prefix A string to prefix the ID with (should be unique per use... just in case)
 */
function getUniqueId(prefix?: string) {
    prefix = prefix || "uid";
    const suffix = (Math.floor((Math.random() * 35))).toString(36);
    return `${prefix}_${++lastId}_${suffix}`;
}

const zws = "\u200B";

export class AutoCompleteSearch {
    private static defaultOptions: IAutoSearchOptions = {
        minLength: 3,
        searchDelay: 500,
        startingResults: [] as ISearchResult[]
    };
    private textBox: HTMLInputElement;
    private dataList: HTMLDataListElement;
    private searchFunction: AutoCompleteSearchFunction;
    private onSelection: (key: string) => void;
    private minLength: number;
    private searchDelay: number;
    private pendingSearch: boolean;
    private currentResults: ISearchResult[];

    constructor(textbox: HTMLInputElement, searchFunction: AutoCompleteSearchFunction,
                onSelection: (key: string) => void, options?: IAutoSearchOptions) {
        this.textBox = textbox;
        this.searchFunction = searchFunction;
        this.onSelection = onSelection;
        options = options || AutoCompleteSearch.defaultOptions;
        this.minLength = typeof options.minLength === "number" ?
            options.minLength : AutoCompleteSearch.defaultOptions.minLength;
        this.searchDelay = typeof options.searchDelay === "number" ?
            options.searchDelay : AutoCompleteSearch.defaultOptions.searchDelay;
        if (!textbox.parentElement) {
            throw new Error("Textbox needs to be inserted into a node before autocomplete can be set up");
        }
        // TODO: Check for datalist support here
        if (textbox.list instanceof HTMLDataListElement) {
            this.dataList = textbox.list;
        } else {
            this.dataList = document.createElement("datalist");
            this.dataList.id = getUniqueId("autoCompleteDataList");
            textbox.insertAdjacentElement("afterend", this.dataList);
            textbox.setAttribute("list", this.dataList.id);
        }
        // Set up any intial search results we might have
        this.setResults(options.startingResults || AutoCompleteSearch.defaultOptions.startingResults);

        this.setResults = this.setResults.bind(this);
        this.handleInput = this.handleInput.bind(this);

        // startpolyfill (compiler directive)
        if (typeof textbox.addEventListener === "function") {
        // endpolyfill
            textbox.addEventListener("input", this.handleInput);
            textbox.addEventListener("change", this.handleInput);
        // startpolyfill (compiler directive)
        } else {
            textbox.onchange = this.handleInput;
            textbox.oninput = this.handleInput;
        }
        // endpolyfill
    }

    /**
     * Set the autocomplete suggestions for this control
     * @param results The autocomplete suggestions to show the user
     */
    public setResults(results: ISearchResult[]): void {
        this.currentResults = results;
        while (this.dataList.lastChild) {
            this.dataList.removeChild(this.dataList.lastChild);
        }
        const newResults = document.createDocumentFragment();
        const usuedLabels = {} as IStringUsedDictionary;

        // Unlike my usual shortcut, we actually need to iterate forwards through this to preserve
        // ordering
        for (const result of results) {
            let version = 1;
            const originalLabel = result.label;
            // Make sure we've never used this name before!
            while (usuedLabels[result.label]) {
                result.label = `${originalLabel} (${++version})`;
            }
            usuedLabels[result.label] = true;
            const option = document.createElement("option");
            option.text = option.label = result.label + zws;
            newResults.appendChild(option);
        }

        this.dataList.appendChild(newResults);
    }

    /**
     * Handle the user changing the value of the textbox (maybe by selecting one of our autocomplete suggestions?!)
     */
    private handleInput(): void {
        const value = this.textBox.value;
        // The heart of our trick - if the last character in the textbox is the invisible, extremely hard-to-type
        // zero-width-space, then we can (mostly) safely assume the user selected a dropdown option
        const isSelection = value[value.length - 1] === zws;
        if (isSelection) {
            // The actual selected options won't have a zero-width-space at the end (I dearly hope)
            const actualValue = value.substr(0, value.length - 1);
            for (let i = this.currentResults.length; i--;) {
                const selection = this.currentResults[i];
                if (actualValue === selection.label) {
                    // We have a winner!
                    this.onSelection(selection.key);
                    // Trim off the zero-width space in case the continue typing
                    this.textBox.value = actualValue;
                    return;
                }
            }
        }
        // Otherwise, we're continuing to search
        // If we're already about to search, don't schedule another one
        if (this.pendingSearch) { return; }
        this.pendingSearch = true;
        setTimeout(() => {
            // If we're below the minimum length of text to search by, don't bother
            if (value.length < this.minLength) {
                return;
            }
            // TODO make sure to cancel the previous request before launching another one
            this.searchFunction(value, this.setResults);
        }, this.searchDelay);
    }
}
