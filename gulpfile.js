"use strict";
const gulp = require("gulp");
const postcss = require("gulp-postcss");
const cssnano = require("cssnano");
const ts = require("gulp-typescript");
const replace = require("gulp-replace");
const extReplace = require("gulp-ext-replace");
const uglifyEs = require("uglify-es");
const composer = require("gulp-uglify/composer");
const uglify = composer(uglifyEs, console);
const sourcemaps = require("gulp-sourcemaps");
const htmlmin = require("gulp-htmlmin");
const del = require("del");
const browserify = require("browserify");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const merge = require("merge-stream");
const glob = require("glob");
const path = require("path");
const imagemin = require("gulp-imagemin");
const imageminWebp = require("imagemin-webp");
const ffmpeg = require("fluent-ffmpeg");
const exec = require("child_process").exec;
const realFavicon = require("gulp-real-favicon");
const bust = require("gulp-buster");
const fs = require("fs");
const autoprefixer = require('autoprefixer');

// File where the favicon markups are stored
const FAVICON_DATA_FILE = "src/favicon/faviconData.json";
// Folder where the ffmeg binaries are stored
const configJson = JSON.parse(fs.readFileSync("config.json"));
ffmpeg.setFfmpegPath(configJson.ffmpegPath);
ffmpeg.setFfprobePath(configJson.ffprobePath);
const origin = configJson.origin;
const gifConvertOptions = "[0:v] fps=12,scale=320:-1:flags=lanczos," +
    "split [a][b];[a] palettegen [p];[b][p] paletteuse";

const polyfillRegex = /\/\/ startpolyfill[\s\S]*?\/\/ endpolyfill/g;
const noPolyfillRegex = /\/\/ startnopolyfill[\s\S]*?\/\/ endnopolyfill/g;

const oldModuleOptions = {ie8:true};
const newModuleOptions = {safari10:true};

gulp.task("newModules", function(){
    return gulp.src("src/modules/*.ts")
                //We don't need these old polyfills in modern browsers
                .pipe(replace(polyfillRegex, ""))
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES2015",
                    module: "ES2015",
                    removeComments: true,
                    sourceMap: false
                }))
                //Use absolute URLs instead of relative ones so that the cache-busting code
                //can find them
                .pipe(replace('"./', '"/modules/modules/'))
                .pipe(uglify(newModuleOptions))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/modules/modules"));
});

gulp.task("oldModules", function(){
    return gulp.src("src/Modules/*.ts")
                //Old browsers cannot run features enclosed by this marker
                .pipe(replace(noPolyfillRegex, ""))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(gulp.dest("build/noModules/modules"));
});

gulp.task("moduleCode", gulp.series("newModules", function(){
    return gulp.src("src/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES2015",
                    module: "ES2015",
                    removeComments: true,
                    sourceMap: false
                }))
                //Use absolute URLs instead of relative ones so that the cache-busting code
                //can find them
                .pipe(replace('"./', '"/modules/'))
                .pipe(uglify(newModuleOptions))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/modules"));
}));

gulp.task("compileNoModuleCode", gulp.series("oldModules", function() {
    return gulp.src("src/*.ts")
                //Old browsers cannot run features enclosed by this marker
                .pipe(replace(noPolyfillRegex, ""))
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/noModules"));
}));

gulp.task("noModuleCode", function() {
    const files = glob.sync("build/noModules/*.js");
    return merge(files.map(function(file) {
        return browserify({
            entries: file,
            debug: true
        }).bundle()
            .pipe(source(path.basename(file, ".js") + ".min.js"))
            .pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify(oldModuleOptions))
            .pipe(sourcemaps.write("./"))
            .pipe(gulp.dest("build/noModules"))
      }));
});

gulp.task("compileServiceWorkerCode", function() {
    return gulp.src("src/serviceWorker/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "es6",
		            module: "es2015",
                    removeComments: true,
                    sourceMap: false,
                    lib: [
                        "webworker",
                        "es6",
                        "scripthost"
                    ]
                }))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build"));
});

gulp.task("compileWorkerCode", function() {
    return gulp.src("src/workers/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false,
                    lib: [
                        "webworker",
                        "es6",
                        "scripthost"
                    ]
                }))
                //Rewrite module path so that browserify knows where to look
                .pipe(replace('"../modules/', '"./../noModules/modules/'))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/workers"));
});

gulp.task("workerCode", gulp.series("compileWorkerCode", "compileServiceWorkerCode", function() {
    const files = glob.sync("build/workers/*.js");
    return merge(files.map(function(file) {
        return browserify({
            entries: file,
            debug: true
        }).bundle()
            .pipe(source(path.basename(file, ".js") + ".min.js"))
            .pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify(oldModuleOptions))
            .pipe(sourcemaps.write("./"))
            .pipe(gulp.dest("build/workers"))
      }));
}));

//Polyfills that work with only ES3
gulp.task("polyfillsEs3", function() {
    return gulp.src("src/polyfills/es3/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(uglify(oldModuleOptions))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/polyfills/es3"));
});
//Polyfills that require ES5 features
gulp.task("polyfillsEs5", function() {
    return gulp.src("src/polyfills/es5/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES5",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(uglify(oldModuleOptions))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/polyfills/es5"));
});

gulp.task("polyfills", gulp.parallel("polyfillsEs3", "polyfillsEs5"));

gulp.task("compileBytecode", function(done) {
    exec("cd src && make.bat", function (err, stdout, stderr) {
        //console.log(stdout);
        console.log(stderr);
        done(err);
    });
});

gulp.task("scripts", gulp.parallel("moduleCode", "polyfills",
    gulp.series("compileNoModuleCode", gulp.parallel("noModuleCode", "workerCode"))));

const responsiveImageConfig = [{
    width: "25%",
    rename: {
        suffix: "-quarter"
    }
},
{
    width: "50%",
    rename: {
        suffix: "-half"
    }
},
{
    width: "75%",
    rename: {
        suffix: "-most"
    }
},
{
    width: "100%"
},
{
    width: "25%",
    rename: {
        suffix: "-quarter",
        extname: ".webp"
    }
},
{
    width: "50%",
    rename: {
        suffix: "-half",
        extname: ".webp"
    }
},
{
    width: "75%",
    rename: {
        suffix: "-most",
        extname: ".webp"
    }
},
{
    width: "100%",
    rename: {
        extname: ".webp"
    }
}];

/**
 * Adds a warning to outdated and JavaScript-disabled browsers as to why parts of the page don't work.
 * @param {String} element The 'element' we are replacing
 * @param {String} description The action the custom element allows (e.g. view comments)
 */
function addCustomElementWarning(element, description) {
    return `<p class="hide-if-custom-elements-supported">` +
                `Unfortunately, your browser does not support the technology required to ${description}. ` +
                `Please <a href="https://bestvpn.org/outdatedbrowser">update your browser</a>.`+
            `</p>` +
            `<noscript hidden class="show-if-custom-elements-supported">` +
                `<p>Please <a href="https://enable-javascript.com/">enable javascript</a> to ${description}.<p>` +
            `</noscript>`;
}

/**
 * Adds a simple, no JS widget for sharing the current page on social media.
 * The localisation module, if loaded, will attempt to replace this with the Web Share API.
 */
function addShareWidget() {
    const endpoint = this.file.stem === "index" ? "" : this.file.stem;
    const filePath = encodeURIComponent(origin + "/" + endpoint);
    const tweetText = encodeURIComponent("A dummy site to experiment with HTML, CSS, and JavaScript.");
    return `<page-share>
                <details>
                <summary><h2>Share me</h2></summary>
                <p><a href="https://www.facebook.com/sharer.php?u=${filePath}" target="socialWindow">
                    Share on Facebook
                </a></p>
                <p><a href="https://twitter.com/intent/tweet?url=${filePath}&text=${tweetText}"
                      target="socialWindow">
                    Share on Twitter
                </a></p>
                <p><a href="https://www.linkedin.com/shareArticle?mini=true&url=${filePath}" 
                      target="socialWindow">
                    Share on LinkedIn
                </a></p>
                <p><a href="mailto:?body=${filePath}">
                    Share via email
                </a></p>
                </details>
            </page-share>`;
}

/**
 * Adds a simple, no JS YouTube widget that only loads an image until clicked on
 */
function addLazyYouTube(element) {
    const codeRegex = /code="(.+?)"/;
    // TODO what if the title has a double or single quote?
    const titleRegex = /title="(.+?)"/;
    const videoCode = element.match(codeRegex)[1];
    const videoTitle = element.match(titleRegex)[1];
    return `<iframe ` +
                `width="560" ` +
                `height="315" ` +
                `loading="lazy" ` +
                `lazyload="1" ` +
                `referrerpolicy="no-referrer" ` +
                `src="https://www.youtube.com/embed/${videoCode}" ` +
                `srcdoc="<link rel='stylesheet' href='lazyYouTube.css' /> ` +
                `<a href=https://www.youtube.com/embed/${videoCode}?autoplay=1> ` +
                    `<img src=https://img.youtube.com/vi/${videoCode}/hqdefault.jpg ` +
                        `alt='Video ${videoTitle}' width='480' height='360'> ` +
                    `<span>▶</span> ` +
                `</a>" ` +
                `frameborder="0" ` +
                `allow="autoplay; encrypted-media; fullscreen; picture-in-picture" ` +
                `allowfullscreen ` +
                `title="${videoTitle}"></iframe>`;
}

gulp.task("html", function() {
    return gulp.src("src/html/*.html")
                .pipe(replace("/src/", "/"))
                .pipe(replace("[[origin]]", origin))
                .pipe(replace(/<custom-element-warning>(.+?)<\/custom-element-warning>/g,
                    addCustomElementWarning))
                .pipe(replace("<page-share></page-share>", addShareWidget))
                .pipe(replace(/<lazy-youtube(.+?)\/>/g, addLazyYouTube))
                .pipe(realFavicon.injectFaviconMarkups(
                    JSON.parse(
                        fs.readFileSync(FAVICON_DATA_FILE)
                    ).favicon.html_code))
                .pipe(htmlmin({
                    collapseWhitespace: true,
                    conservativeCollapse: true
                }))
                .pipe(gulp.dest("build"));
});

gulp.task("mediaWebP", function(){
    return gulp.src("src/media/*{png,jpg}")
        .pipe(imagemin([
            imageminWebp()
        ]))
        .pipe(extReplace(".webp"))
        .pipe(gulp.dest("build/media"));
});

gulp.task("mediaImages", function(){
    return gulp.src("src/media/*{png,jpg,gif,svg}")
        .pipe(imagemin())
        .pipe(gulp.dest("build/media"));
});

gulp.task("silentVideos", function(done){
    const files = glob.sync("src/media/silentVideos/*{webm,ogv}");
    const promises = files.map(filePath => {
        const fileName = path.basename(filePath, path.extname(filePath));
        //If we've already generated this video, skip
        if (fs.existsSync(`build/media/${fileName}.webm`) &&
            fs.existsSync(`build/media/${fileName}.ogv`) &&
            fs.existsSync(`build/media/${fileName}.gif`)) {
            return;
        }
        return new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .output(`build/media/${fileName}.webm`)
                .noAudio()
                .format("webm")
                .videoCodec("libvpx")
                .output(`build/media/${fileName}.ogv`)
                .noAudio()
                .format("ogv")
                .videoCodec("libtheora")
                .outputOptions([
                    "-g 1",
                    "-qscale 1"
                ])
                .output(`build/media/${fileName}.gif`)
                .outputOptions("-vf", gifConvertOptions)
                .on("error", function(err, stdout, stderr) {
                    console.log("Cannot process video: " + err.message);
                    reject();
                })
                .on("end", resolve)
                .run();
        });
    });
    Promise.all(promises).then(() => { done(); }).catch(done);
});

gulp.task("media", gulp.parallel("mediaWebP", "mediaImages", "silentVideos"));

// Generate the icons. This task takes a few seconds to complete.
// You should run it at least once to create the icons. Then,
// you should run it whenever RealFaviconGenerator updates its
// package (see the check-for-favicon-update task below).
gulp.task("generate-favicon", function(done) {
    //If we've already set up the favicon, skip this step
    if (fs.existsSync("build/favicon.ico")) {
        done();
        return;
    }

	realFavicon.generateFavicon({
		masterPicture: "src/favicon/favicon.svg",
		dest: "build",
		iconsPath: "/",
		design: {
			ios: {
				pictureAspect: "backgroundAndMargin",
				backgroundColor: "#ffffff",
				margin: "14%",
				assets: {
					ios6AndPriorIcons: false,
					ios7AndLaterIcons: false,
					precomposedIcons: true,
					declareOnlyDefaultIcon: true
				}
			},
			desktopBrowser: {},
			windows: {
				pictureAspect: "whiteSilhouette",
				backgroundColor: "#da532c",
				onConflict: "override",
				assets: {
					windows80Ie10Tile: false,
					windows10Ie11EdgeTiles: {
						small: true,
						medium: true,
						big: true,
						rectangle: true
					}
				}
			},
			androidChrome: {
				pictureAspect: "noChange",
				themeColor: "#d2cdcd",
				manifest: {
					name: "JavaScript experiments",
					display: "standalone",
					orientation: "notSet",
					onConflict: "override",
					declared: true
				},
				assets: {
					legacyIcon: false,
					lowResolutionIcons: false
				}
			},
			safariPinnedTab: {
				pictureAspect: "silhouette",
				themeColor: "#5bbad5"
			}
		},
		settings: {
			scalingAlgorithm: "Mitchell",
			errorOnImageTooSmall: false,
			readmeFile: false,
			htmlCodeFile: false,
			usePathAsIs: false
		},
		markupFile: FAVICON_DATA_FILE
	}, done);
});

// Check for updates on RealFaviconGenerator (think: Apple has just
// released a new Touch icon along with the latest version of iOS).
// Run this task from time to time. Ideally, make it part of your
// continuous integration system.
gulp.task("check-for-favicon-update", function() {
	var currentVersion = JSON.parse(fs.readFileSync(FAVICON_DATA_FILE)).version;
	realFavicon.checkForUpdates(currentVersion, function(err) {
		if (err) {
			throw err;
		}
	});
});

gulp.task("css", function() {
    return gulp.src("src/css/*.css")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(postcss([
                    autoprefixer(),
                    cssnano()
                ]))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build"));
});

gulp.task("getResourceHashes", function() {
    return gulp.src("build/**/*.{css,js}")
        .pipe(bust({
            relativePath: "build"
        }))
        .pipe(gulp.dest("build"));
});

/**
 * Escapes a string for inclusion in a regular expresion
 * @param {string} string A string to include in a regular expresion
 */
function escapeRegExp(string) {
    //https://stackoverflow.com/a/6969486/7077589
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

gulp.task("implementResourceHashes", function() {
    const hashList = JSON.parse(fs.readFileSync("build/busters.json"));
    const hashListRegexSelector = Object.keys(hashList).map(escapeRegExp).join("|");
                                    // Select all references to the files, except map files
    const hashFileRegex = new RegExp(`(${hashListRegexSelector})(?!\.map)`, "gi");
    return gulp.src("build/**/*.{css,js,html}")
        .pipe(replace(hashFileRegex, function (match, p1) {
            return match + "?v=" + hashList[match];
        }))
        .pipe(gulp.dest("build"));
});

gulp.task("cacheBust", gulp.series("getResourceHashes", "implementResourceHashes"));

gulp.task("cleanModules", function() {
    return del("build/modules");
});

gulp.task("cleanNoModules", function() {
    return del("build/noModules");
});

gulp.task("cleanPolyfills", function() {
    return del("build/polyfills");
});

gulp.task("cleanWorkers", function() {
    return del("build/workers");
});

gulp.task("cleanScripts", gulp.parallel("cleanModules", "cleanNoModules", "cleanPolyfills", "cleanWorkers"));

gulp.task("fullClean", function() {
    return del("build");
});

gulp.task("build", gulp.series("cleanScripts", gulp.parallel("html", "scripts"), "css", "cacheBust"));

gulp.task("fullBuild", gulp.series("fullClean", gulp.parallel("scripts",
    gulp.series("generate-favicon", "html", "media")), "css", "cacheBust"));

gulp.task("watch", function () {
    gulp.watch("src/*.ts", gulp.parallel("moduleCode", gulp.series("compileNoModuleCode", "noModuleCode")));
    gulp.watch("src/modules/*.ts", gulp.parallel("newModules", gulp.series("compileNoModuleCode", "noModuleCode")));
    gulp.watch("src/workers/*.ts", gulp.series("cleanWorkers", "compileNoModuleCode", "workerCode"));
    gulp.watch("src/serviceWorker/*.ts", gulp.series("cleanWorkers", "workerCode"));
    gulp.watch("src/polyfills/es3/*.ts", gulp.series("polyfillsEs3"));
    gulp.watch("src/polyfills/es5/*.ts", gulp.series("polyfillsEs5"));
    gulp.watch("src/*/*.css", gulp.series("css"));
    gulp.watch("src/*/*.html", gulp.series("html"));
});

gulp.task("default", gulp.series("build", "watch"));