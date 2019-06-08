/*
 * Datalist polyfill - based on https://github.com/mfranzke/datalist-polyfill
 * @license Copyright(c) 2017 by Maximilian Franzke
 * Supported by Christian, Johannes, @mitchhentges, @mertenhanisch, @ailintom, @Kravimir, @mischah,
 * @hryamzik, @ottoville, @IceCreamYou, @wlekin, @eddr, @beebee1987, @mricherzhagen, @acespace90,
 * @damien-git and @nexces - many thanks for that !
 */
/*
 * A minimal and dependency-free vanilla JavaScript datalist polyfill.
 * Supports all standard's functionality as well as mimics other browsers behavior.
 * Tests for native support of an inputs elements datalist functionality.
 * Elsewhere the functionality gets emulated by a select element.
 */

(() => {
    "use strict";

    // Performance: Set local variables
    const dcmnt = window.document;
    const ua = window.navigator.userAgent;
        // Feature detection
    const datalistSupported =
            "list" in dcmnt.createElement("input") &&
            Boolean(dcmnt.createElement("datalist") &&  typeof HTMLDataListElement === "function");
        // IE & EDGE browser detection via UserAgent
        // TODO: obviously ugly. But sadly necessary until Microsoft enhances the UX within EDGE
        // (compare to https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9573654/)
        // adapted out of https://gist.github.com/gaboratorium/25f08b76eb82b1e7b91b01a0448f8b1d :
    const isGteIE10 = Boolean(ua.match(/Trident\/[6-7]\./));
    const isEDGE = Boolean(ua.indexOf("Edge/") !== -1);

    // Let's break here, if it's even already supported ... and not IE10+ or EDGE
    if (datalistSupported && !isGteIE10 && !isEDGE) {
        return false;
    }

    // Define some global settings and configurations
    let touched = false;
    // Speaking variables for the different keycodes
    const keyENTER = 13;
    const keyESC = 27;
    const keyUP = 38;
    const keyDOWN = 40;
    // Defining the text / value seperator for displaying the value and text values ...
    const textValueSeperator = " / ";
    // ... and defining the different input types that are supported by this polyfill
    const supportedTypes = ["text", "email", "number", "search", "tel", "url"];
    // Classes for elements
    const classNameInput = "polyfilled";
    const classNamePolyfillingSelect = "polyfilling";
    // Defining a most likely unique polyfill string
    const uniquePolyfillString = "###[P0LYFlLLed]###";

    // Differentiate for touch interactions,
    // adapted by https://medium.com/@david.gilbertson/the-only-way-to-detect-touch-with-javascript-7791a3346685
    window.addEventListener("touchstart", function onFirstTouch() {
        touched = true;

        window.removeEventListener("touchstart", onFirstTouch);
    });

    // For observing any changes to the option elements within the datalist elements, define MutationObserver initially
    let obs: MutationObserver;

    // Define a new observer
    if (typeof MutationObserver !== "undefined") {
        obs = new MutationObserver((mutations: MutationRecord[]) => {
            const datalistsNeedingAnUpdate = [] as HTMLDataListElement[];

            // Look through all mutations that just occured
            mutations.forEach((mutation) => {
                // If any options were added or removed, we need to resort the polyfill options
                if (mutation.addedNodes.length > 1 || mutation.removedNodes.length > 1) {
                    datalistsNeedingAnUpdate.push(mutation.target as HTMLDataListElement);
                }
            });

            datalistsNeedingAnUpdate.forEach((dataListNeedingAnUpdate) => {
                const input = dcmnt.querySelector(
                    'input[list="' + dataListNeedingAnUpdate.id + '"]'
                ) as HTMLInputElement;

                if (getInputValue(input) !== "") {
                    // Prepare the options and toggle the visiblity afterwards
                    toggleVisibility(
                        !!prepOptions(dataListNeedingAnUpdate, input).length,
                        dataListNeedingAnUpdate.getElementsByClassName(
                            classNamePolyfillingSelect
                        )[0] as HTMLSelectElement
                    );
                }
            });
        });
    }

    /** Function regarding the inputs interactions on keyup event */
    const inputInputList = (event: KeyboardEvent) => {
        const input = event.target as HTMLInputElement;
        const datalist = input.list as HTMLDataListElement;
        const keyOpen = event.keyCode === keyUP || event.keyCode === keyDOWN;

        // Check for whether the events target was an input and still
        // check for an existing instance of the datalist and polyfilling select
        if (input.tagName.toLowerCase() !== "input" || datalist === null) {
            return;
        }

        // Handling IE10+ & EDGE
        if (isGteIE10 || isEDGE) {
            // On keypress check for value
            if (
                getInputValue(input) !== "" &&
                !keyOpen &&
                event.keyCode !== keyENTER &&
                event.keyCode !== keyESC &&
                // As only EDGE doesn't trigger the input event after selecting an item via mouse,
                // we need to differentiate here
                (isGteIE10 || input.type === "text")
            ) {
                updateIEOptions(input, datalist);

                // TODO: Check whether this update is necessary depending on the options values
                input.focus();
            }

            return;
        }

        let visible = false;
        // Creating the select if there's no instance so far
        // (e.g. because of that it hasn't been handled or it has been dynamically inserted)
        const datalistSelect =
                datalist.getElementsByClassName(classNamePolyfillingSelect)[0] as HTMLSelectElement ||
                setUpPolyfillingSelect(input, datalist);

        // On an ESC or ENTER key press within the input, let's break here and afterwards hide the datalist select,
        // but if the input contains a value or one of the opening keys have been pressed ...
        if (
            event.keyCode !== keyESC &&
            event.keyCode !== keyENTER &&
            (getInputValue(input) !== "" || keyOpen) &&
            datalistSelect !== undefined
        ) {
            // ... prepare the options
            if (prepOptions(datalist, input).length > 0) {
                visible = true;
            }

            const firstEntry = 0;
            const lastEntry = datalistSelect.options.length - 1;

            // ... preselect best fitting index
            if (touched) {
                datalistSelect.selectedIndex = firstEntry;
            } else if (keyOpen && input.getAttribute("type") !== "number") {
                datalistSelect.selectedIndex =
                    event.keyCode === keyUP ? lastEntry : firstEntry;

                // ... and on arrow up or down keys, focus the select
                datalistSelect.focus();
            }
        }

        // Toggle the visibility of the datalist select according to previous checks
        toggleVisibility(visible, datalistSelect);
    };

    /**
     * On keypress check all options for that as a substring, save the original value as a data-attribute
     * and preset that inputs value (for sorting) for all option values (probably as well enhanced by a token)
     */
    const updateIEOptions = (input: HTMLInputElement, datalist: HTMLDataListElement): void => {
        const inputValue = getInputValue(input);

        // Loop through the options
        Array.prototype.slice.call(datalist.options, 0).forEach((option: HTMLOptionElement) => {
            // We're using .getAttribute instead of .dataset here for IE10
            const dataOriginalvalue = option.getAttribute("data-originalvalue");
            const originalValue = dataOriginalvalue || option.value;

            // In case of that the original value hasn't been saved as data so far, do that now
            if (!dataOriginalvalue) {
                // We're using .setAttribute instead of .dataset here for IE10
                option.setAttribute("data-originalvalue", originalValue);
            }

            // As we'd manipulate the value in the next step,
            // we'd like to put in that value as either a label or text if none of those exist
            if (!option.label && !option.text) {
                option.label = originalValue;
            }

            /*
            Check for whether the current option is a valid suggestion and replace its value by
                - the current input string, as IE10+ and EDGE don't do substring, but only prefix matching
                - followed by a unique string that should prevent any interferance
                - and the original string, that is still necessary e.g. for sorting within the suggestions list
            As the value is being inserted on users selection, we'll replace that one within the upfollowing
            inputInputListIE function
            */
            option.value = isValidSuggestion(option, inputValue)
                ? inputValue + uniquePolyfillString + originalValue.toLowerCase()
                : originalValue;
        });
    };

    /** Check for the input and probably replace by correct options elements value */
    const inputInputListIE = (event: Event): void => {
        const input = event.target as HTMLInputElement;
        const datalist = input.list;

        if (
            !input.matches("input[list]") ||
            !input.matches("." + classNameInput) ||
            !datalist
        ) {
            return;
        }

        // Query for related option - and escaping the value as doublequotes wouldn't work
        const option = datalist.querySelector(
            'option[value="' +
                getInputValue(input).replace(/\\([\s\S])|(")/g, "\\$1$2") +
                '"]'
        );

        // We're using .getAttribute instead of .dataset here for IE10
        if (option && option.getAttribute("data-originalvalue")) {
            setInputValue(input, option.getAttribute("data-originalvalue"));
            // Make sure other code knows we've modified the value
            dispatchEvent(input, "input");
        }
    };

    /** Check for whether this is a valid suggestion */
    const isValidSuggestion = (option: HTMLOptionElement, inputValue: string): boolean => {
        const optVal = option.value.toLowerCase();
        const inptVal = inputValue.toLowerCase();
        const label = option.getAttribute("label");
        const text = option.text.toLowerCase();

        /*
        "Each option element that is a descendant of the datalist element,
        that is not disabled, and whose value is a string that isn't the empty string,
        represents a suggestion. Each suggestion has a value and a label."
        "If appropriate, the user agent should use the suggestion's label
        and value to identify the suggestion to the user."
        */
        return Boolean(
            option.disabled === false &&
                ((optVal !== "" && optVal.indexOf(inptVal) !== -1) ||
                    (label && label.toLowerCase().indexOf(inptVal) !== -1) ||
                    (text !== "" && text.indexOf(inptVal) !== -1))
        );
    };

    /** Focusin and -out events */
    const changesInputList = (event: FocusEvent) => {
        // Check for correct element on this event delegation
        if (!(event.target as Element).matches("input[list]")) {
            return;
        }

        const input = event.target as HTMLInputElement;
        const datalist = input.list;

        // Check for whether the events target was an input and still check for an existing instance of the datalist
        if (input.tagName.toLowerCase() !== "input" || datalist === null) {
            return;
        }

        // Test for whether this input has already been enhanced by the polyfill
        if (!input.matches("." + classNameInput)) {
            prepareInput(input, event.type);
        }

        // #GH-49: Microsoft EDGE / datalist popups get "emptied" when receiving focus via tabbing
        if (isEDGE && event.type === "focusin") {
            // Set the value of the first option to it's value - this actually triggers a redraw of the complete list
            const firstOption = (input.list as HTMLDataListElement).options[0];

            firstOption.value = firstOption.value;
        }

        // Break here for IE10+ & EDGE
        if (isGteIE10 || isEDGE) {
            return;
        }

        // Creating the select if there's no instance so far
        // (e.g. because of that it hasn't been handled or it has been dynamically inserted)
        const datalistSelect =
                datalist.getElementsByClassName(classNamePolyfillingSelect)[0] as HTMLSelectElement ||
                setUpPolyfillingSelect(input, datalist);
        // Either have the select set to the state to get displayed in case of that it
        // would have been focused or because it's the target on the inputs blur - and check for general
        // existance of any option as suggestions
        const visible =
                datalistSelect &&
                datalistSelect.querySelector("option:not(:disabled)") &&
                ((event.type === "focusin" && getInputValue(input) !== "") ||
                    (event.relatedTarget && event.relatedTarget === datalistSelect));

        // Toggle the visibility of the datalist select according to previous checks
        toggleVisibility(visible, datalistSelect);
    };

    /** Prepare the input */
    const prepareInput = (input: HTMLInputElement, eventType: string) => {
        // We'd like to prevent autocomplete on the input datalist field
        input.setAttribute("autocomplete", "off");

        // WAI ARIA attributes
        input.setAttribute("role", "textbox");
        input.setAttribute("aria-haspopup", "true");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-owns", input.getAttribute("list"));

        // Bind the keyup event on the related datalists input
        if (eventType === "focusin") {
            input.addEventListener("keyup", inputInputList);

            input.addEventListener("focusout", changesInputList, true);

            // As only EDGE doesn't trigger the input event after selecting an item via mouse,
            // we need to differentiate here
            if (isGteIE10 || (isEDGE && input.type === "text")) {
                input.addEventListener("input", inputInputListIE);
            }
        } else if (eventType === "blur") {
            input.removeEventListener("keyup", inputInputList);

            input.removeEventListener("focusout", changesInputList, true);

            // As only EDGE doesn't trigger the input event after selecting an item via mouse,
            // we need to differentiate here
            if (isGteIE10 || (isEDGE && input.type === "text")) {
                input.removeEventListener("input", inputInputListIE);
            }
        }

        // Add class for identifying that this input is even already being polyfilled
        input.className += " " + classNameInput;
    };

    /** Get the input value for dividing regular and mail types */
    const getInputValue = (input: HTMLInputElement): string => {
        // In case of type=email and multiple attribute, we would need to grab the last piece
        // Using .getAttribute here for IE9 purpose - elsewhere it wouldn't return the newer HTML5 values correctly
        return input.getAttribute("type") === "email" &&
            input.getAttribute("multiple") !== null
            ? input.value.substring(input.value.lastIndexOf(",") + 1)
            : input.value;
    };

    /** Set the input value for dividing regular and mail types */
    const setInputValue = (input: HTMLInputElement, datalistSelectValue: string) => {
        const lastSeperator = input.value.lastIndexOf(",");

        // In case of type=email and multiple attribute, we need to set up the resulting inputs value differently
        input.value =
            // Using .getAttribute here for IE9 purpose - elsewhere it wouldn't return the newer HTML5 values correctly
            input.getAttribute("type") === "email" &&
            input.getAttribute("multiple") !== null &&
            lastSeperator > -1
                ? input.value.slice(0, lastSeperator) + "," + datalistSelectValue
                : datalistSelectValue;
    };

    // Binding the focus event - matching the input[list]s happens in the function afterwards
    dcmnt.addEventListener("focusin", changesInputList, true);

    /** Create and dispatch an event; divided for IE9 usage */
    const dispatchEvent = (input: HTMLInputElement, eventType: string) => {
        let evt: Event;

        if (typeof Event === "function") {
            evt = new Event(eventType, {
                bubbles: true
            });
        } else {
            evt = dcmnt.createEvent("Event");
            evt.initEvent(eventType, true, false);
        }

        input.dispatchEvent(evt);
    };

    // Break here for IE10+ & EDGE
    if (isGteIE10 || isEDGE) {
        return;
    }

    // Function for preparing and sorting the options/suggestions
    const prepOptions = (datalist: HTMLDataListElement, input: HTMLInputElement) => {
        if (typeof obs !== "undefined") {
            obs.disconnect();
        }

        // Creating the select if there's no instance so far
        // (e.g. because of that it hasn't been handled or it has been dynamically inserted)
        const datalistSelect =
                datalist.getElementsByClassName(classNamePolyfillingSelect)[0] as HTMLSelectElement ||
                setUpPolyfillingSelect(input, datalist);
        const inputValue = getInputValue(input);
        const newSelectValues = dcmnt.createDocumentFragment();
        const disabledValues = dcmnt.createDocumentFragment();

        // Create an array out of the options list
        Array.prototype.slice
            .call(datalist.querySelectorAll("option:not(:disabled)"))
            // ... sort all entries and
            .sort((a: HTMLOptionElement, b: HTMLOptionElement) => {
                let aValue = a.value;
                let bValue = b.value;

                // Using the knowledge that the values are URLs to allow the user to
                // omit the scheme part and perform intelligent matching on the domain name
                if (input.getAttribute("type") === "url") {
                    aValue = aValue.replace(/(^\w+:|^)\/\//, "");
                    bValue = bValue.replace(/(^\w+:|^)\/\//, "");
                }

                return aValue.localeCompare(bValue);
            })
            .forEach((opt: HTMLOptionElement) => {
                const optionValue = opt.value;
                const label = opt.getAttribute("label");
                const text = opt.text;

                // Put this option into the fragment that is meant to get inserted into the select.
                // Additionally according to the specs ...
                // TODO: This might get slightly changed/optimized in a future release
                if (isValidSuggestion(opt, inputValue)) {
                    const textOptionPart = text.substr(
                            0,
                            optionValue.length + textValueSeperator.length
                        );
                    const optionPart = optionValue + textValueSeperator;

                    // The innertext should be 'value seperator text' in case they are different
                    if (
                        text &&
                        !label &&
                        text !== optionValue &&
                        textOptionPart !== optionPart
                    ) {
                        opt.innerText = optionValue + textValueSeperator + text;
                    } else if (!opt.text) {
                        // Manipulating the option inner text, that would get displayed
                        opt.innerText = label || optionValue;
                    }

                    newSelectValues.appendChild(opt);
                } else {
                    // ... or put this option that isn't relevant to the users into the fragment
                    // that is supposed to get inserted outside of the select
                    disabledValues.appendChild(opt);
                }
            });

        // Input the options fragment into the datalists select
        datalistSelect.appendChild(newSelectValues);

        const datalistSelectOptionsLength = datalistSelect.options.length;

        datalistSelect.size =
            datalistSelectOptionsLength > 10 ? 10 : datalistSelectOptionsLength;
        datalistSelect.multiple = !touched && datalistSelectOptionsLength < 2;

        // Input the unused options as siblings next to the select - and differentiate
        // in between the regular, and the IE9 fix syntax upfront
        (datalist.getElementsByClassName(classNamePolyfillingSelect)[0] || datalist).appendChild(
            disabledValues
        );

        if (typeof obs !== "undefined") {
            // Becuase we completely disconnected the mutation observer earlier, we now have to put it back
            Array.prototype.slice
                .call(datalist.querySelectorAll("datalist"))
                .forEach((dl: HTMLDataListElement) => {
                    obs.observe(dl, {
                        childList: true
                    });
                });
        }

        return datalistSelect.options;
    };

    /** Define function for setting up the polyfilling select */
    const setUpPolyfillingSelect = (input: HTMLInputElement, datalist: HTMLElement): HTMLSelectElement => {
        // Check for whether it's of one of the supported input types defined at the beginning
        // Using .getAttribute here for IE9 purpose - elsewhere it wouldn't return the newer HTML5 values correctly
        // and still check for an existing instance
        if (
            (input.getAttribute("type") &&
                supportedTypes.indexOf(input.getAttribute("type")) === -1) ||
            datalist === null
        ) {
            return;
        }

        const rects = input.getClientRects();
        // Measurements
        const inputStyles = window.getComputedStyle(input);
        const datalistSelect = dcmnt.createElement("select");

        // Setting a class for easier identifying that select afterwards
        datalistSelect.setAttribute("class", classNamePolyfillingSelect);

        // Set general styling related definitions
        datalistSelect.style.position = "absolute";

        // Initially hiding the datalist select
        toggleVisibility(false, datalistSelect);

        // The select itself shouldn't be a possible target for tabbing
        datalistSelect.setAttribute("tabindex", "-1");

        // WAI ARIA attributes
        datalistSelect.setAttribute("aria-live", "polite");
        datalistSelect.setAttribute("role", "listbox");
        if (!touched) {
            datalistSelect.setAttribute("aria-multiselectable", "false");
        }

        // The select should get positioned underneath the input field ...
        if (inputStyles.getPropertyValue("display") === "block") {
            datalistSelect.style.marginTop =
                "-" + inputStyles.getPropertyValue("margin-bottom");
        } else {
            const direction =
                inputStyles.getPropertyValue("direction") === "rtl" ? "right" : "left";

            datalistSelect.style.setProperty(
                "margin-" + direction,
                "-" +
                    (rects[0].width +
                        parseFloat(inputStyles.getPropertyValue("margin-" + direction))) +
                    "px"
            );
            datalistSelect.style.marginTop =
                (rects[0].height + (input.offsetTop - datalist.offsetTop)).toString() +
                "px";
        }

        // Set the polyfilling selects border-radius equally to the one by the polyfilled input
        datalistSelect.style.borderRadius = inputStyles.getPropertyValue(
            "border-radius"
        );
        datalistSelect.style.minWidth = rects[0].width + "px";

        if (touched) {
            const messageElement = dcmnt.createElement("option");

            // ... and it's first entry should contain the localized message to select an entry
            messageElement.innerText = datalist.title;
            // ... and disable this option, as it shouldn't get selected by the user
            messageElement.disabled = true;
            // ... and assign a dividable class to it
            messageElement.setAttribute("class", "message");
            // ... and finally insert it into the select
            datalistSelect.appendChild(messageElement);
        }

        // Add select to datalist element ...
        datalist.appendChild(datalistSelect);

        // ... and our upfollowing functions to the related event
        if (touched) {
            datalistSelect.addEventListener("change", changeDataListSelect);
        } else {
            datalistSelect.addEventListener("click", changeDataListSelect);
        }

        datalistSelect.addEventListener("blur", changeDataListSelect);
        datalistSelect.addEventListener("keydown", changeDataListSelect);
        datalistSelect.addEventListener("keypress", datalistSelectKeyPress);

        return datalistSelect;
    };

    /** Functions regarding changes to the datalist polyfilling created selects keypress */
    const datalistSelectKeyPress = (event: KeyboardEvent) => {
        const datalistSelect = event.target as HTMLInputElement;
        const datalist = datalistSelect.parentNode as HTMLDataListElement;
        const input = dcmnt.querySelector('input[list="' + datalist.id + '"]') as HTMLInputElement;

        // Check for whether the events target was a select or whether the input doesn't exist
        if (datalistSelect.tagName.toLowerCase() !== "select" || input === null) {
            return;
        }

        // Determine a relevant key - either printable characters (that would have a length of 1)
        // or controlling like Backspace
        if (event.key && (event.key === "Backspace" || event.key.length === 1)) {
            input.focus();

            if (event.key === "Backspace") {
                input.value = input.value.substr(0, input.value.length - 1);

                // Dispatch the input event on the related input[list]
                dispatchEvent(input, "input");
            } else {
                input.value += event.key;
            }

            prepOptions(datalist, input);
        }
    };

    /** Change, Click, Blur, Keydown */
    const changeDataListSelect = (event: Event) => {
        const datalistSelect = event.currentTarget as HTMLSelectElement;
        const datalist = datalistSelect.parentNode as HTMLDataListElement;
        const input = dcmnt.querySelector('input[list="' + datalist.id + '"]') as HTMLInputElement;

        // Check for whether the events target was a select or whether the input doesn't exist
        if (datalistSelect.tagName.toLowerCase() !== "select" || input === null) {
            return;
        }

        const eventType = event.type;
        // ENTER and ESC
        let visible =
                eventType === "keydown" &&
                ((event as KeyboardEvent).keyCode !== keyENTER && (event as KeyboardEvent).keyCode !== keyESC);

        // On change, click or after pressing ENTER or TAB key, input the selects value into
        // the input on a change within the list
        if (
            (eventType === "change" ||
                eventType === "click" ||
                (eventType === "keydown" &&
                    ((event as KeyboardEvent).keyCode === keyENTER || (event as KeyboardEvent).key === "Tab"))) &&
            datalistSelect.value.length > 0 &&
            datalistSelect.value !== datalist.title
        ) {
            setInputValue(input, datalistSelect.value);

            // Dispatch the input event on the related input[list]
            dispatchEvent(input, "input");

            // Finally focusing the input, as other browser do this as well
            if ((event as KeyboardEvent).key !== "Tab") {
                input.focus();
            }

            // #GH-51 / Prevent the form to be submitted on selecting a value via ENTER key within the select
            if ((event as KeyboardEvent).keyCode === keyENTER) {
                event.preventDefault();
            }

            // Set the visibility to false afterwards, as we're done here
            visible = false;
        } else if (eventType === "keydown" && (event as KeyboardEvent).keyCode === keyESC) {
            // In case of the ESC key being pressed, we still want to focus the input[list]
            input.focus();
        }

        // Toggle the visibility of the datalist select according to previous checks
        toggleVisibility(visible, datalistSelect);
    };

    /** Toggle the visibility of the datalist select */
    const toggleVisibility = (visible: boolean, datalistSelect: HTMLSelectElement) => {
        if (visible) {
            datalistSelect.removeAttribute("hidden");
        } else {
            datalistSelect.setAttributeNode(dcmnt.createAttribute("hidden"));
        }

        datalistSelect.setAttribute("aria-hidden", (!visible).toString());
    };

    // Emulate the two properties regarding the datalist and input elements
    // list property / https://developer.mozilla.org/en/docs/Web/API/HTMLInputElement
    ((constructor) => {
        if (
            constructor &&
            constructor.prototype &&
            constructor.prototype.list === undefined
        ) {
            Object.defineProperty(constructor.prototype, "list", {
                get() {
                    /*
                    According to the specs ...
                    "The list IDL attribute must return the current suggestions source element,
                    if any, or null otherwise."
                    "If there is no list attribute, or if there is no element with that ID, or
                    if the first element with that ID is not a datalist element, then there is
                    no suggestions source element."
                    */
                    const element = dcmnt.getElementById(this.getAttribute("list"));

                    return typeof this === "object" &&
                        this instanceof constructor &&
                        element &&
                        element.matches("datalist")
                        ? element
                        : null;
                }
            });
        }
    })(HTMLInputElement);

    // Options property / https://developer.mozilla.org/en/docs/Web/API/HTMLDataListElement
    ((constructor) => {
        if (
            constructor &&
            constructor.prototype &&
            (constructor.prototype as any).options === undefined
        ) {
            Object.defineProperty(constructor.prototype, "options", {
                get() {
                    return typeof this === "object" && this instanceof constructor
                        ? this.getElementsByTagName("option")
                        : null;
                }
            });
        }
    })(HTMLElement);
})();
