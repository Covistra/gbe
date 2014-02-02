var fs = require('fs-extra'),
    path = require('path'),
    Q = require('q');

module.exports = function(build_ctx) {
    return Q.nfcall(fs.mkdirs, build_ctx.destPath).then(function(){
        console.log("Destination folder %s was created".green, build_ctx.destPath);
        return Q.nfcall(fs.copy, path.join(build_ctx.buildPath, "tablet"), build_ctx.destPath, {forceDelete: true}).then(function(){
            console.log("basic tablet book structure was successfully created".green);

            // Setup a few key files
            build_ctx.appConfigFile = path.join(build_ctx.destPath, "www", "config.xml");
            build_ctx.appIconFile = path.join(build_ctx.destPath, "www", "icon.png");
            build_ctx.appMainFile = path.join(build_ctx.destPath, "www", "index.html");
            build_ctx.cssPath = path.join(build_ctx.destPath, "www", "css");
            build_ctx.jsPath = path.join(build_ctx.destPath, "www", "js");
            build_ctx.imgPath = path.join(build_ctx.destPath, "www", "img");
            build_ctx.resPath = path.join(build_ctx.destPath, "www", "res");
            build_ctx.contentPath = path.join(build_ctx.destPath, "www", "content");

        });
    });
};
