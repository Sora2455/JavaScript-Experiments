if ("customElements" in self) {
    class TimingInformation extends HTMLElement {
        constructor() {
            // Always call super first in constructor
            super();

            const locales = navigator.languages.concat([document.documentElement.lang]);
            const getTimeInSecondsSecondsString = (timeInMilliseconds: number | null) => {
                if (typeof timeInMilliseconds !== "number") { return "unknown"; }
                const timeInSeconds = timeInMilliseconds / 1000;
                return timeInSeconds.toLocaleString(locales,
                    {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                        style: "unit",
                        // @ts-ignore This is totally a valid option, TypeScript just hasn't caught up
                        unit: "second",
                        unitDisplay: "long"
                    });
            };

            const shadow = this.attachShadow({mode: "open"});

            const pageTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
            const domReadyTime = pageTiming.domContentLoadedEventEnd - pageTiming.requestStart;

            const lastModifiedDate = new Date(document.lastModified);
            const lastModifiedLocaleString = lastModifiedDate.toLocaleString(locales, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            });
            const lastModifiedIsoString = lastModifiedDate.toISOString();

            const serverTiming = (pageTiming as any).serverTiming as PerformanceServerTiming[];
            let generationTime = null;
            let databaseTime = null;
            if (Array.isArray(serverTiming)) {
                let totalTime = 0;
                let dataBaseTime = 0;
                serverTiming.forEach((t) => {
                    if (t.name === "t") {
                        totalTime = t.duration;
                    } else if (t.name === "d") {
                        dataBaseTime = t.duration;
                    }
                });
                if (totalTime) {
                    generationTime = totalTime - dataBaseTime;
                }
                if (dataBaseTime) {
                    databaseTime = dataBaseTime;
                }
            }

            const addDt = (text: string, dl: HTMLDListElement) => {
                const dt = document.createElement("dt");
                dt.textContent = text;
                dl.appendChild(dt);
            }

            const addDd = (text: string, dl: HTMLDListElement) => {
                const dd = document.createElement("dd");
                dd.textContent = text;
                dl.appendChild(dd);
            }

            const content = document.createElement("dl");
            addDt("Page load time", content);
            addDd(getTimeInSecondsSecondsString(domReadyTime), content);
            addDt("Time spent in database", content);
            addDd(getTimeInSecondsSecondsString(databaseTime), content);
            addDt("Time spent generating page", content);
            addDd(getTimeInSecondsSecondsString(generationTime), content);
            addDt("Page last modified", content);

            const dateElem = document.createElement("time");
            dateElem.setAttribute("datetime", lastModifiedIsoString);
            dateElem.textContent = lastModifiedLocaleString;
            const dd = document.createElement("dd");
            dd.appendChild(dateElem);
            content.appendChild(dd);

            shadow.appendChild(content);
        }
    }

    customElements.define("timing-information", TimingInformation);
}
