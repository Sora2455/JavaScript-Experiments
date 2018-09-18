"use strict";
/*
Polyfill taken from https://github.com/nolanlawson/pseudo-worker 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
interface Window {
  Worker: any;
}

if (typeof Worker === "undefined") {
    window.Worker = PseudoWorker;
}

function doEval(self: object, __pseudoworker_script: string): void {
  /* jshint unused:false */
  (function () {
    /* jshint evil:true */
    eval(__pseudoworker_script);
  }).call(self);
}

function PseudoWorker(path: string): object {
  const messageListeners = [] as EventListener[];
  const errorListeners = [] as EventListener[];
  const workerMessageListeners = [] as EventListener[];
  const workerErrorListeners = [] as EventListener[];
  let postMessageListeners = [] as any[];
  let terminated = false;
  let script: string;
  let workerSelf: any;

  const api = this;

  // custom each loop is for IE8 support
  function executeEach(arr: EventListener[], fun: (listener: EventListener) => void): void {
    let i = -1;
    while (++i < arr.length) {
      if (arr[i]) {
        fun(arr[i]);
      }
    }
  }

  function callErrorListener(err: Error): (listener: EventListener) => void {
    return function (listener) {
      listener({
        type: 'error',
        error: err,
        message: err.message
      } as ErrorEvent);
    };
  }

  function addEventListener(type: string, fun: EventListener): void {
    /* istanbul ignore else */
    if (type === 'message') {
      messageListeners.push(fun);
    } else if (type === 'error') {
      errorListeners.push(fun);
    }
  }

  function removeEventListener(type: string, fun: EventListener): void {
      let listeners;
      /* istanbul ignore else */
      if (type === 'message') {
        listeners = messageListeners;
      } else if (type === 'error') {
        listeners = errorListeners;
      } else {
        return;
      }
      let i = -1;
      while (++i < listeners.length) {
        const listener = listeners[i];
        if (listener === fun) {
          delete listeners[i];
          break;
        }
      }
  }

  function postError(err: Error): void {
    const callFun = callErrorListener(err);
    if (typeof api.onerror === 'function') {
      callFun(api.onerror);
    }
    if (workerSelf && typeof workerSelf.onerror === 'function') {
      callFun(workerSelf.onerror);
    }
    executeEach(errorListeners, callFun);
    executeEach(workerErrorListeners, callFun);
  }

  function runPostMessage(msg: any): void {
    function callFun(listener: EventListener): void {
      try {
        listener({data: msg} as MessageEvent);
      } catch (err) {
        postError(err);
      }
    }

    if (workerSelf && typeof workerSelf.onmessage === 'function') {
      callFun(workerSelf.onmessage);
    }
    executeEach(workerMessageListeners, callFun);
  }

  function postMessage(msg: any): void {
    if (typeof msg === 'undefined') {
      throw new Error('postMessage() requires an argument');
    }
    if (terminated) {
      return;
    }
    if (!script) {
      postMessageListeners.push(msg);
      return;
    }
    runPostMessage(msg);
  }

  function terminate(): void {
    terminated = true;
  }

  function workerPostMessage(msg: any): void {
    if (terminated) {
      return;
    }
    function callFun(listener: EventListener): void {
      listener({
        data: msg
      } as MessageEvent);
    }
    if (typeof api.onmessage === 'function') {
      callFun(api.onmessage);
    }
    executeEach(messageListeners, callFun);
  }

  function workerAddEventListener(type: string, fun: EventListener): void {
    /* istanbul ignore else */
    if (type === 'message') {
      workerMessageListeners.push(fun);
    } else if (type === 'error') {
      workerErrorListeners.push(fun);
    }
  }

  const xhr = new XMLHttpRequest();

  xhr.open('GET', path);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 400) {
        script = xhr.responseText;
        workerSelf = {
          postMessage: workerPostMessage,
          addEventListener: workerAddEventListener,
          close: terminate
        };
        doEval(workerSelf, script);
        const currentListeners = postMessageListeners;
        postMessageListeners = [];
        for (let i = 0; i < currentListeners.length; i++) {
          runPostMessage(currentListeners[i]);
        }
      } else {
        postError(new Error('cannot find script ' + path));
      }
    }
  };

  xhr.send();

  api.postMessage = postMessage;
  api.addEventListener = addEventListener;
  api.removeEventListener = removeEventListener;
  api.terminate = terminate;

  return api;
}