var Q = require('q'),
    fs = require('fs-extra'),
    path = require('path'),
    doT = require('dot');

doT.templateSettings = {
    evaluate:    /\#\{([\s\S]+?)\}/g,
    interpolate: /\#\{=([\s\S]+?)\}/g,
    encode:      /\#\{!([\s\S]+?)\}/g,
    use:         /\#\{#([\s\S]+?)\}/g,
    define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
    conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
    iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
    varname: 'it',
    strip: false,
    append: true,
    selfcontained: false
};
module.exports = function(build_ctx) {

    return Q.nfcall(fs.readFile, path.join(build_ctx.buildPath, "index.html")).then(function(mainfile) {
        var tmpl = doT.template(mainfile+"");
        var html = tmpl(build_ctx);
        return Q.nfcall(fs.writeFile, build_ctx.appMainFile, html, {encoding:'utf-8'});
    });
};
