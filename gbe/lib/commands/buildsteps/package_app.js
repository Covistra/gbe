var Q = require('q'),
    archiver = require('archiver'),
    wrench = require('wrench'),
    _ = require('lodash'),
    path = require('path'),
    fs = require('fs-extra');

module.exports = function(build_ctx) {
    var defer = Q.defer();

    build_ctx.zipfile = path.join(path.resolve(build_ctx.destPath, ".."), 'app.zip');

    var output = fs.createWriteStream(build_ctx.zipfile);
    var archive = archiver('zip');
    archive.on('error', function(err) {
        defer.reject(err);
    });
    archive.pipe(output);
    var files = wrench.readdirSyncRecursive(build_ctx.destPath);
    _.each(files, function(f) {
        console.log("Reading file %s".yellow, f);
        if(!fs.statSync(path.join(build_ctx.destPath, f)).isDirectory()) {
            archive.append(fs.createReadStream(path.join(build_ctx.destPath, f)), {name: f});
        }
    });
    archive.finalize(function(err) {
        console.log("Finalizing zip file".yellow);
        if (err) {
            defer.reject(err);
        }
        else {
            defer.resolve(build_ctx);
        }
    });

    return defer.promise;
};
