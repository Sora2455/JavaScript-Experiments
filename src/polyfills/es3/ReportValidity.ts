/*
Copyright © 2018 Jelmer de Maat, https://github.com/jelmerdemaat

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the “Software”), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
