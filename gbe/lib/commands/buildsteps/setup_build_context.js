var Q = require('q'),
    path = require('path');

module.exports = function(program) {
    return Q.fcall(function(){
        var build_ctx  = {};

        if(program.gamebook)
            build_ctx.sourcePath = path.resolve(program.gamebook);
        else
            build_ctx.sourcePath = path.resolve(process.cwd());

        build_ctx.gamebookFile = path.join(build_ctx.sourcePath, "gb.yml");

        if(program.destination)
            build_ctx.destPath = path.resolve(program.destination);
        else
            build_ctx.destPath = path.resolve(process.cwd(), "build");

        build_ctx.buildPath = path.resolve(__dirname, "..", "..", "..", "templates", "build");
        build_ctx.phonegap = {
            options: {
                token: program.token
            }
        };

        return build_ctx;
    });

};
