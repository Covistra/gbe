angular.module('gbe.services', [], function($provide) {
    $provide.factory('contentService', ["$http", "$q", function($http, $q, $timeout) {

        return new function() {

            this.loadBook = function(key) {
                var def = $q.defer();
                $http.get('content/gb.yml').then(function(resp){
                    var book = jsyaml.load(resp.data);
                    def.resolve(book.gamebook);
                }, function(err){
                    def.reject(err);
                });
                return def.promise;
            };

            this.loadContent = function(filename) {
                var def = $q.defer();
                $http.get('content/'+filename).then(function(resp){
                    def.resolve(resp.data);
                }, function(reason){
                    def.reject(reason);
                });
                return def.promise;
            };

            this.listGameProfiles = function() {
                console.log("Listing all game profiles");
                var def = $q.defer();
                $timeout(function(){
                    def.resolve([]);
                });
                return def.promise;
            };

            this.saveGameProfile = function(key, profile) {
                var def = $q.defer();
                $timeout(function(){
                    def.resolve({});
                });
                return def.promise;
            };

            this.loadGameProfile = function(key) {
                var def = $q.defer();
                $timeout(function(){
                    def.resolve({});
                });
                return def.promise;
            };

            this.loadMonster = function(monster) {
                var deferred = $q.defer();
                $http.get('content/_monsters.yml').then(function(resp){
                    var data = jsyaml.load(resp.data);

                    // Make sure to compute any variable attribute
                    var m = dynamic(data[monster.type], "skills", "health", "magic", "attack", "armor");
                    m.maxHealth = m.health;
                    m.maxMagic = m.magic;
                    m.maxArmor = m.armor;

                    deferred.resolve(_.extend(monster, m));
                }, function(reason) {
                    deferred.reject(reason);
                });
                return deferred.promise;
            };

            this.loadHeroe = function() {
                var def = $q.defer();

                $http.get("content/_heroe.yml").then(function(resp) {
                    var heroe = jsyaml.load(resp.data);
                    var h = dynamic(heroe.heroe, "health", "magic", "skills");
                    h.maxHealth = h.health;
                    h.maxMagic = h.magic;
                    h.maxArmor = h.armor;
                    def.resolve(h);
                }, function(reason){
                    def.reject(reason);
                });

                return def.promise;
            };

        };

    }]);

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

});
