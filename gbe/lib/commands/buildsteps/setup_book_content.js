var Q = require('q'),
    fs = require('fs-extra');

module.exports = function(build_ctx) {
    return Q.fcall(fs.copy, build_ctx.sourcePath, build_ctx.contentPath);
};
