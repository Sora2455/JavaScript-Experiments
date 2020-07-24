/*
  Based on: https://code.google.com/archive/p/ie-web-worker/
  Create a fake worker thread of IE and other browsers
  Remember: Only pass in primitives, and there is none of the native
          security happening
*/

if (typeof Worker !== "function") {
    // @ts-ignore Polyfill does not match worker interface
    window.Worker = function(scriptFile: string) {
        const self = this;
        let timeHandle = null as number;

        /** This is the onMessage that the worker code listens on */
        const onmessage = null as (text: any) => void;

        /** This is the postMessage the worker uses to post results to the outside */
        const postMessage = (text: any) => {
            self.onmessage({ data: text });
        };

        /** This is the onMessage that outside code listens on */
        self.onmessage = null;

        /** This is the postMessage that outside code uses to post 'questions' to the worker */
        self.postMessage = (text: any) => {
            // Execute on a timer so we dont block (well as good as we can get in a single thread)
            timeHandle = setTimeout(() => {
                if ("function" === typeof self.onmessage) {
                  onmessage({ data : text });
                }
            }, 1);
        };

        self.terminate = () => {
            clearTimeout(timeHandle);
            // Prevent any new messages from being actioned
            self.postMessage = () => {
                // No action
            };
        };

        function doEval(context: object, scriptText: string): void {
            (() => {
                // tslint:disable-next-line:no-eval
                eval(scriptText);
            }).call(context);
        }

        /* HTTP Request*/

        self.importScripts = (src: string) => {
            const http = new XMLHttpRequest();
            http.open("GET", scriptFile, false);
            http.send(null);

            if (http.readyState === 4) {
                // IE functions will become delagates of the instance of Worker
                doEval(self, http.responseText);
            }
        };

        self.importScripts(scriptFile);

        return self;
    };
}
