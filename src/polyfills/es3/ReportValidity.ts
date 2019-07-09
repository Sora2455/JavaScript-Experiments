/*
Copyright © 2018 Jelmer de Maat, https://github.com/jelmerdemaat
*/

// tslint:disable-next-line:interface-name
interface HTMLFormElement {
    /**
     * A hidden button element that we 'click' to trigger the validation messages
     */
    p: HTMLButtonElement;
}

if (!HTMLFormElement.prototype.checkValidity) {
    HTMLFormElement.prototype.checkValidity = () => {
        return true;
    };
}

if (!HTMLFormElement.prototype.reportValidity) {
    HTMLFormElement.prototype.reportValidity = function() {
        const f = this as HTMLFormElement;
        if (f.checkValidity()) {
            return true;
        }

        if (!f.p) {
            f.p = document.createElement("button");
            f.p.setAttribute("type", "submit");
            f.p.setAttribute("hidden", "hidden");
            f.p.setAttribute("style", "display:none");

            f.p.addEventListener("click", (evt) => {
                if (f.checkValidity()) {
                    evt.preventDefault();
                }
            });

            f.appendChild(f.p);
        }

        this.p.click();

        return false;
    };
}
