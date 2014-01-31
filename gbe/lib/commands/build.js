/**
 Copyright (c) 2013, Covistra Technologies Inc.
 All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
 following conditions are met:

 Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 disclaimer.

 Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
 following disclaimer in the documentation and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
 */
(function() {
    var phonegap = require('phonegap-build-api'),
        path = require('path'),
        async = require('async'),
        _ = require('underscore'),
        jade = require('jade'),
        request = require('request'),
        yaml = require('js-yaml'),
        archiver = require('archiver'),
        wrench = require('wrench'),
        fs = require('fs');

    module.exports = function(program) {
        var sourcePath = path.resolve(program.gamebook);
        var destPath = path.resolve(program.destination);

        console.log("Building gamebook...");
        console.log("Content Source:", sourcePath);
        console.log("Destination:", destPath);

        if(program.local) {
            console.log("Book files won't be sent to PhoneGap build");
        }
        else {
            console.log("Book apps will be generated using PhoneGap Build with token", program.token);
        }

        async.auto({
            book_content: function(callback) {
                console.log("Loading the book content for template rendering", path.join(sourcePath, "gb.yml"));
                fs.readFile(path.join(sourcePath, "gb.yml"), function(err, content) {
                    if(err) return callback(err);
                    var gb = yaml.load(content+"");
                    return callback(null, gb.gamebook);
                });
            },
            dest_path:['book_content', function(callback, data) {
                console.log("Check the destination folder");
                if(!fs.existsSync(destPath)) {

                    console.log("Creating destination folder");
                    wrench.mkdirSyncRecursive(destPath, 0777);
                }
                else
                    console.log("Reusing existing destination path");
                callback();
            }],
            create_structure:['dest_path', function(callback){
                console.log("Create application structure");
                try {
                    fs.mkdirSync(path.join(destPath, "js"));
                    fs.mkdirSync(path.join(destPath, "css"));
                    fs.mkdirSync(path.join(destPath, "content"));
                    fs.mkdirSync(path.join(destPath, "img"));
                }
                catch(err){}
                finally {
                    callback();
                }
            }],
            copy_external_js:['create_structure',function(callback)  {
                var external_files = {
                    'jquery': "http://code.jquery.com/jquery.js",
                    'angular': "http://cdnjs.cloudflare.com/ajax/libs/angular.js/1.1.3/angular.min.js",
                    'underscore': "http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.4.4/underscore-min.js",
                    'q': "http://cdnjs.cloudflare.com/ajax/libs/q.js/0.9.2/q.min.js",
                    "js-yaml": "https://raw.github.com/nodeca/js-yaml/master/js-yaml.js"
                };

                async.forEach(_.keys(external_files), function(filename, done) {
                    console.log("Installing "+filename+".js from ", external_files[filename]);
                    request.get(external_files[filename]).pipe(fs.createWriteStream(path.join(destPath, "js", filename+".js")));
                    done();
                },callback);

            }],
            copy_external_css:['create_structure', function(callback) {
                var external_files = {
                };

                async.forEach(_.keys(external_files), function(filename, done) {
                    console.log("Installing "+filename+".css from ", external_files[filename]);
                    request.get(external_files[filename]).pipe(fs.createWriteStream(path.join(destPath, "css", filename+".css")));
                    done();
                },callback);
            }],
            copy_local_css_files:['create_structure', function(callback) {
                var files = {
                    "base": "templates/reader/public/css/base.css",
                    "bootstrap" : "templates/reader/public/css/bootstrap.css"
                };

                async.forEach(_.keys(files), function(filename, done) {
                    console.log("Installing "+filename+".css from ", files[filename]);
                    fs.createReadStream(path.resolve(files[filename])).pipe(fs.createWriteStream(path.join(destPath, "css", filename+".css")));
                    done();
                },callback);
                callback();
            }],
            copy_local_js_files:['create_structure', function(callback) {
                var files = {
                    "showdown": "templates/reader/public/js/showdown.js",
                    "gbe": "templates/reader/public/js/gbe.js",
                    "bootstrap": "templates/reader/public/js/bootstrap.js",
                    "app": "templates/reader/public/js/app.js",
                    "gbe-local-content": "templates/build/gbe-local-content.js"
                };

                async.forEach(_.keys(files), function(filename, done) {
                    console.log("Installing "+filename+".js from ", files[filename]);
                    fs.createReadStream(path.resolve(files[filename])).pipe(fs.createWriteStream(path.join(destPath, "js", filename+".js")));
                    done();
                },callback);
                callback();
            }],
            copy_book_content: ['create_structure', function(callback) {
                wrench.rmdirSyncRecursive(path.join(destPath, "content"), true);
                wrench.copyDirRecursive(sourcePath, path.join(destPath, "content"), {
                    forceDelete: false,
                    excludeHiddenUnix: true
                }, callback);
            }],
            render_app_page: ['create_structure', 'book_content', function(callback, data) {
                fs.readFile(path.resolve('templates/build/index.jade'), function(err, tmpl) {
                    var fn = jade.compile(tmpl+"", {pretty:true});
                    fs.writeFile(path.join(destPath, "index.html"), fn({title:data.book_content.title, gamebook: data.book_content}), callback);
                });
            }],
            create_phonegap_config: ['create_structure', function(callback) {
                console.log("Create phonegap build application config");
                fs.createReadStream(path.resolve('templates/build/config.xml')).pipe(fs.createWriteStream(path.join(destPath, "config.xml")));
                callback();
            }],
            zip_app:['create_phonegap_config', 'render_app_page', 'copy_book_content', function(callback){
                var output = fs.createWriteStream(__dirname + '/app.zip');
                var archive = archiver('zip');
                archive.on('error', function(err) {
                    callback(err);
                });
                archive.pipe(output);
                var files = wrench.readdirSyncRecursive(destPath);
                _.each(files, function(f) {
                    console.log(path.join(destPath, f));
                    if(!fs.statSync(path.join(destPath, f)).isDirectory()) {
                        archive.append(fs.createReadStream(path.join(destPath, f)), {name: f});
                    }
                    else
                        console.log("Skipping folder ", f);
                });
                archive.finalize(function(err) {
                    console.log("Finalizing zip app");
                    if (err) {
                        callback(err);
                    }
                    callback(null, __dirname + "/app.zip");
                });
            }],
            phonegap:[function(callback) {
                if(!program.local)
                    phonegap.auth({ token: program.token }, callback);
                else
                    callback();
            }],
            build_app:['phonegap', 'zip_app', function(callback, data){
                if(!program.local) {
                    console.log("Sending the zip file to Phonegap build", data.zip_app);
                    var options = {
                        form: {
                            data: {
                                title: data.book_content.title,
                                create_method: 'file'
                            },
                            file: path.resolve(data.zip_app)
                        }
                    };
                    data.phonegap.post('/apps', options, function(err, data){
                        if(err) console.log(err);
                        console.log(data);
                        callback(null, data);
                    });
                }
                else
                    callback();
            }],
            cleanup: ['build_app', function(callback, data){
                if(!program.local) {
                    console.log("Clean files up");
                    fs.unlinkSync(data.zip_data);
                }
                callback();
            }]
        }, function(err) {
            if(err) console.log(err);
            else
                console.log("Build completed successfully");
        });

    };

})();
