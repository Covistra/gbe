angular.module('gbe.services', [], function($provide) {

    $provide.factory('contentService', ["$http", "$q","$timeout", function($http, $q) {

        return new function() {

            this.loadBook = function(key) {
                var def = $q.defer();
                $http.get('/book').then(function(resp){
                    def.resolve(resp.data);
                }, function(reason){
                    def.reject(reason);
                });
                return def.promise;
            };

            this.listGameProfiles = function() {
                console.log("Listing all game profiles");
                var def = $q.defer();
                $http.get("/profiles").then(function(resp){
                    def.resolve(resp.data);
                });
                return def.promise;
            };

            this.saveGameProfile = function(key, profile) {
                var def = $q.defer();
                if(arguments.length == 1) {
                    profile = key;
                    key = profile.key = profile.key || _.uniqueId(profile.gamebook);
                }

                $http.post("/profile/"+key, profile).then(function(resp) {
                    def.resolve(resp.data);
                });
                return def.promise;
            };

            this.loadGameProfile = function(key) {
                var def = $q.defer();
                $http.get('/profile/'+key).then(function(resp) {
                    def.resolve(resp.data);
                });
                return def.promise;
            };

            this.loadContent = function() {
                var def = $q.defer();
                $http.get('/content').then(function(resp) {
                    def.resolve(resp.data);
                }, function(reason) {
                    def.reject(reason);
                });
                return def.promise;
            };

            this.loadMonster = function(monster) {
                var deferred = $q.defer();
                $http.get('/monster/'+monster.type).then(function(resp){
                    monster = _.extend(monster, resp.data);
                    deferred.resolve(monster);
                }, function(reason){
                    deferred.reject(reason);
                });
                return deferred.promise;
            };

            this.loadHeroe = function() {
                var def = $q.defer();
                $http.get('/heroe').then(function(resp) {
                    def.resolve(resp.data);
                }, function(reason){
                    def.reject(reason);
                });
                return def.promise;
            };

        };

    }]);

});
