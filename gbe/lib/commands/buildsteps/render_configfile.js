var Q = require('q'),
    fs = require('fs-extra'),
    path = require('path'),
    doT = require('dot');

module.exports = function(build_ctx) {

    return Q.nfcall(fs.readFile, build_ctx.appConfigFile).then(function(cfgfile) {
        var tmpl = doT.template(cfgfile+"");
        var content = tmpl(build_ctx);
        return Q.nfcall(fs.writeFile, build_ctx.appConfigFile, content, {encoding:'utf-8'});
    });
};
