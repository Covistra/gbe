/*

 Gamebook Engine: A gamebook tablet application generator.
 Copyright (C) 2014 Covistra Technologies Inc.

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
