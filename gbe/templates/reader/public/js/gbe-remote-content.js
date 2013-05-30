angular.module('gbe.services', [], function($provide) {
    $provide.factory('contentService', ["$http", "$q", function($http, $q) {

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

            this.loadContent = function(key) {
                var def = $q.defer();
                $http.get('/content').then(function(resp){
                    def.resolve(resp.data);
                }, function(reason){
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
