"use strict";
const gulp = require("gulp");
const gulpMerge = require("gulp-merge");
const postcss = require('gulp-postcss');
const cssnano = require('cssnano');
const uncss = require('uncss').postcssPlugin;
const ts = require("gulp-typescript");
const replace = require('gulp-replace');
const extReplace = require("gulp-ext-replace");
const uglifyEs = require('uglify-es');
const composer = require('gulp-uglify/composer');
const uglify = composer(uglifyEs, console);
const sourcemaps = require('gulp-sourcemaps');
const htmlmin = require('gulp-htmlmin');
const del = require("del");
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const merge = require('merge-stream');
const glob = require('glob');
const path = require('path');
const {MathMlReplacer} = require("math-ml-now");
const imagemin = require('gulp-imagemin');
const imageminWebp = require('imagemin-webp');
const exec = require('child_process').exec;


const polyfillRegex = /\/\/ startpolyfill[\s\S]*?\/\/ endpolyfill/g;

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
                .pipe(uglify(newModuleOptions))
                .pipe(sourcemaps.write("./"))
                .pipe(gulp.dest("build/modules/modules"));
});

gulp.task("oldModules", function(){
    return gulp.src("src/Modules/*.ts")
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(gulp.dest("build/noModules/modules"));
});

gulp.task("moduleCode", ["newModules"], function(){
    return gulp.src("src/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES2015",
                    module: "ES2015",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(uglify(newModuleOptions))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest("build/modules"));
});

gulp.task("compileNoModuleCode", ["oldModules"], function() {
    return gulp.src("src/*.ts")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(ts({
                    noImplicitAny: true,
                    target: "ES3",
                    module: "commonjs",
                    removeComments: true,
                    sourceMap: false
                }))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest("build/noModules"));
});

gulp.task("noModuleCode", ["compileNoModuleCode"], function() {
    const files = glob.sync('build/noModules/*.js');
    return merge(files.map(function(file) {
        return browserify({
            entries: file,
            debug: true
        }).bundle()
            .pipe(source(path.basename(file, ".js") + ".min.js"))
            .pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify(oldModuleOptions))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest("build/noModules"))
      }));
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
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest("build/workers"));
});

gulp.task("workerCode", ["compileWorkerCode", "compileNoModuleCode"], function() {
    const files = glob.sync('build/workers/*.js');
    return merge(files.map(function(file) {
        return browserify({
            entries: file,
            debug: true
        }).bundle()
            .pipe(source(path.basename(file, ".js") + ".min.js"))
            .pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify(oldModuleOptions))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest("build/workers"))
      }));
});

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
                .pipe(sourcemaps.write('./'))
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
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest("build/polyfills/es5"));
});

gulp.task("polyfills", ["polyfillsEs3", "polyfillsEs5"]);

gulp.task("compileBytecode", function(cb) {
    exec('cd src && make.bat', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
});

gulp.task("scripts", ["moduleCode", "noModuleCode", "workerCode", "polyfills"]);

gulp.task("media", ["html"], function() {
    return gulpMerge(
        gulp.src("src/media/*{png,jpg}")
            .pipe(imagemin([
                imageminWebp()
            ]))
            .pipe(extReplace(".webp"))
            .pipe(gulp.dest("build/media")),
        gulp.src("src/media/*{png,jpg,gif,svg}")
            .pipe(imagemin())
            .pipe(gulp.dest("build/media"))
    );
});

gulp.task("html", function() {
    const replacer = new MathMlReplacer({
        formatName: "TeX",
        imageFolder: "/src/media/"
    });

    return gulp.src("src/html/*.html")
                .pipe(replacer)
                .pipe(replace("/src/", "/"))
                .pipe(htmlmin({
                    collapseWhitespace: true,
                    conservativeCollapse: true
                }))
                .pipe(gulp.dest("build"));
});

gulp.task("css", ["html", "scripts"], function() {
    return gulp.src("src/css/*.css")
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(postcss([
                    uncss({
                        html: ["build/*.html"]
                    }),
                    cssnano()
                ]))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest("build"));
});

gulp.task("clean", function() {
    return del.sync("build");
});

gulp.task("build", ["clean", "html", "scripts", "css", "media"]);

gulp.task("watch", function () {
    gulp.watch('src/*.ts', ["scripts"]);
    gulp.watch('src/*/*.ts', ["scripts"]);
    gulp.watch('src/*/*.css', ["css"]);
    gulp.watch('src/*/*.css', ["css"]);
    gulp.watch('src/*/*.html', ["html"]);
    gulp.watch('src/*/*.html', ["html"]);
});

gulp.task("default", ["build", "watch"]);