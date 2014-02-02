var Q = require('q'),
    _ =require('lodash'),
    fs = require('fs-extra'),
    path = require('path'),
    request = require('request');

module.exports = function(build_ctx) {

    var jsfiles = [
        {src:"http://code.jquery.com/jquery.js", dest:"jquery.js"},
        {src:"http://cdnjs.cloudflare.com/ajax/libs/angular.js/1.1.5/angular.js", dest:"angular.js"},
        {src:"http://cdnjs.cloudflare.com/ajax/libs/lodash.js/2.4.1/lodash.min.js", dest:"lodash.js"},
        {src:"http://cdnjs.cloudflare.com/ajax/libs/q.js/0.9.2/q.min.js", dest:"q.js"},
        {src:"https://raw.github.com/nodeca/js-yaml/master/js-yaml.js", dest:"js-yaml.js"}
    ];

    return Q.all(_.map(jsfiles, function(js) {
        var defer = Q.defer();

        console.log("copying %s to %s".grey, js.src, js.dest);

        // Perform the request
        var r = request(js.src);
        r.pipe(fs.createWriteStream(path.resolve(build_ctx.jsPath, js.dest)));
        r.on('end', function() {
            console.log("%s was successfully copied".green, js.dest);
            defer.resolve(js);
        });
        r.on('error', function(err) {
            defer.reject(er);
        });

        return defer.promise;
    }));

};
