angular.module('gbe.services', [], function($provide) {
    $provide.factory('contentService', ["$http", "$q", function($http, $q) {

        return new function() {

            this.loadBook = function(key) {
                return $http.get('/content');
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
                return $http.get('/heroe');
            };

        };

    }]);

});
