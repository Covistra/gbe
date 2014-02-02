var Q = require('q'),
    fs = require('fs'),
    Yaml = require('js-yaml');

module.exports = function(build_ctx) {
    console.log("Recording build_id %s to the gamebook file", build_ctx.build_report.id);
    build_ctx.gamebook.build_id = build_ctx.build_report.id;
    var yml = Yaml.safeDump({gamebook:build_ctx.gamebook}, {skipInvalid:true});
    return Q.fcall(fs.writeFile, build_ctx.gamebookFile, yml, {encoding:'utf-8'});
};
