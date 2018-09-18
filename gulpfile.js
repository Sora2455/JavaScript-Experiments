"use strict";
var gulp = require("gulp");
var postcss = require('gulp-postcss');
var cssnano = require('cssnano');
var uncss = require('uncss').postcssPlugin;
var ts = require("gulp-typescript");
var replace = require('gulp-replace');
var uglifyEs = require('uglify-es');
var composer = require('gulp-uglify/composer');
var uglify = composer(uglifyEs, console);
var sourcemaps = require('gulp-sourcemaps');
var htmlmin = require('gulp-htmlmin');
var del = require("del");
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var merge = require('merge-stream');
var glob = require('glob');
var path = require('path');
var exec = require('child_process').exec;

var polyfillRegex = /\/\/ startpolyfill[\s\S]*?\/\/ endpolyfill/g;

var oldModuleOptions = {ie8:true};
var newModuleOptions = {safari10:true};

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
    var files = glob.sync('build/noModules/*.js');
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
    var files = glob.sync('build/workers/*.js');
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

gulp.task("media", function() {
    return gulp.src("src/media/*{png,jpg}")
                .pipe(gulp.dest("build/media"));
});

gulp.task("html", function() {
    return gulp.src("src/html/*.html")
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