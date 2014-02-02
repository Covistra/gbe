var Q = require('q'),
    fs = require('fs'),
    Yaml = require('js-yaml');

module.exports = function(build_ctx) {
    return Q.fcall(function() {
        return Q.nfcall(fs.readFile, build_ctx.gamebookFile).then(function(src){
            return Yaml.safeLoad(src+"");
        });
    });
};
