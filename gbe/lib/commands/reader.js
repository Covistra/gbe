/**
 Copyright (c) 2013, Covistra Technologies Inc.
 All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
 following conditions are met:

 Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 disclaimer.

 Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
 following disclaimer in the documentation and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
 */
(function() {
    require('js-yaml');

    var express = require('express'),
        http = require('http'),
        path = require('path'),
        fs = require('fs'),
        _ = require('underscore'),
        spawn = require('child_process').spawn;

    module.exports = function(program) {
        var port = program.port || 8080;
        var readerImpl = program.reader || "reader";
        var gamebook = require(path.resolve(program.gamebook || process.cwd(), "gb.yml")).gamebook;
        var monsters = require(path.resolve(program.gamebook || process.cwd(), gamebook.monsters));
        var heroe = require(path.resolve(program.gamebook || process.cwd(), gamebook.heroe)).heroe;
        var datapath = program.data || process.cwd();

        var app = express();
        app.set('views', __dirname + '../../../templates/reader/views');
        app.set('view engine', 'jade');
        app.use(express.static(__dirname + "../../../templates/reader/public/"));

        var server = http.createServer(app);

        app.get('/', function(req, res) {
            res.render('index', {
                title: 'GBE Reader',
                gamebook: gamebook
            });
        });

        app.get('/book', function(req, res){
            res.json(gamebook);
        });

        app.get("/content", function(req, res){
            fs.readFile(path.resolve(program.gamebook || process.cwd(), gamebook.content), function(err, content) {
                res.end(content+"");
            });
        });
        app.get("/monster/:key", function(req, res) {

            // Make sure to compute any variable attribute
            var monster = dynamic(monsters[req.params.key], "skills", "health", "magic", "attack", "armor");
            monster.maxHealth = monster.health;
            monster.maxMagic = monster.magic;
            monster.maxArmor = monster.armor;

            res.json(monster);
        });
        app.get('/asset/:filename', function(req, res) {
            fs.createReadStream(path.resolve(program.gamebook || process.cwd(), '_assets', req.params.filename)).pipe(res);
        });

        app.get('/views/:key', function(req, res) {
            res.render('views/'+req.params.key, {
                gamebook: gamebook
            });
        });

        app.get('/heroe', function(req, res) {
            var h = dynamic(heroe, "health", "magic", "skills");
            h.maxHealth = h.health;
            h.maxMagic = h.magic;
            h.maxArmor = h.armor;

            res.json(h);
        });

        app.get('/profiles', function(req, res, next) {
            fs.readdir(datapath, function(err, files) {
                if(err) return next(err);
                return res.json(files);
            });
        });

        app.post('/profile/:key', function(req, res) {
            req.pipe(fs.createWriteStream(path.join(datapath, req.params.key)));
            res.end();
        });

        app.get('/profile/:key', function(req, res, next){
            fs.readFile(path.join(datapath, req.params.key), function(err, data){
                if(err) return next(err);
                var profile = JSON.parse(data + "");
                return res.json(profile);
            });
        });

        server.listen(port, function() {
            spawn('open', ['http://localhost:'+port]);
            console.log("GBE Reader has been launched at http://localhost:"+port+"/");
        });

    };

    function dynamic(o) {
        var r = _.clone(o);
        var fields = _.toArray(arguments).slice(1);
        _.each(fields, function(field) {
            if(_.isObject(o[field])) {
                r[field] = {};
                r[field] = dynamic.apply(this, [o[field]].concat(_.keys(o[field])));
            }
            else {
                r[field] = computeSkill(o[field]);
            }
        });
        return r;
    }

    function computeSkill(range){
        if(_.isString(range)){
            var factors = range.split('-');
            return Math.round(Math.random() * parseInt(factors[1] - factors[0]) + parseInt(factors[0]));
        }
        else
            return range;
    }

    process.on('uncaughtException', function(e){
        console.log(e);
    })
})();
