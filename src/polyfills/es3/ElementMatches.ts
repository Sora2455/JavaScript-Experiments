// tslint:disable-next-line:interface-name
interface Element {
    matchesSelector(selectors: string): boolean;
    mozMatchesSelector(selectors: string): boolean;
    msMatchesSelector(selectors: string): boolean;
    oMatchesSelector(selectors: string): boolean;
}

if (!Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            const matches = (this.document || this.ownerDocument).querySelectorAll(s);
            let i = matches.length;
            // tslint:disable-next-line:no-empty
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
        };
}
