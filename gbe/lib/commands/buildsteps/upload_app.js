var Q = require('q'),
    phonegap = require('phonegap-build-api');

module.exports = function(build_ctx) {

    return Q.nfcall(phonegap.auth, build_ctx.phonegap.options).then(function(api) {

        // Check if we already have an existing build id
        if(build_ctx.gamebook.build_id) {

            // Update the zip
            var options = {
                form: {
                    file: build_ctx.zipfile
                }
            };

            console.log("Updating existing build profile ", build_ctx.gamebook.build_id);
            return Q.ninvoke(api, "put", '/apps/'+build_ctx.gamebook.build_id, options).then(function(data) {
                build_ctx.build_report = data;
                return data;
            });

        }
        else {
            console.log("Creating a new build profile");

            // Upload the zip and create the app
            var options = {
                form: {
                    data:{
                        title: build_ctx.gamebook.title,
                        create_method: 'file',
                        debug: false
                    },
                    file: build_ctx.zipfile
                }
            };

            return Q.ninvoke(api, "post", '/apps', options).then(function(data) {
                build_ctx.build_report = data;
                return data;
            });

        }

    });
};
