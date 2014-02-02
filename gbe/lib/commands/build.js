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
var path = require('path'),
    util = require('util'),
    Q = require('q'),
    requireDirectory = require('require-directory'),
    colors = require('colors');

module.exports = function(program) {
    var BuildSteps = requireDirectory(module, path.join(__dirname,"buildsteps"));

    BuildSteps.setup_build_context(program).then(function(build_ctx) {

        // Start the build process
        return BuildSteps.load_book_content(build_ctx).then(function(gb) {

            // Append the gamebook content to the build context
            build_ctx.gamebook = gb.gamebook;

            var structure = BuildSteps.setup_book_structure(build_ctx).then(function() {

                return Q.all([
                    BuildSteps.install_javascripts(build_ctx),
                    BuildSteps.render_mainfile(build_ctx),
                    BuildSteps.render_configfile(build_ctx),
                    BuildSteps.setup_book_content(build_ctx)
                ]);

            });

            // Determine if we need to build the app
            if(!program.local) {
                return structure.then(function() {
                    console.log("Initiating the mobile app build for iOS and Android through build.phonegap.com".yellow);
                    return BuildSteps.package_app(build_ctx).then(function() {
                        return BuildSteps.upload_app(build_ctx).then(function() {
                            return BuildSteps.build_app(build_ctx).then(function(){
                                return BuildSteps.update_build_id(build_ctx);
                            });
                        });
                    });
                }).then(function(result) {
                    console.log("Gamebook '%s' was successfully built".green, build_ctx.gamebook.title, result);
                });

            }
            else {
                return structure.then(function() {
                    console.log();
                    console.log("Skipping gamebook building. Gamebook is ready to be manually built".green);
                });
            }
        });


    })

    // All errors are handled in this global catchall
    .fail(BuildSteps.handle_error)
    .done();
};
