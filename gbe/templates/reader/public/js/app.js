angular.module('gbe', ['gbe.services'])

.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/titlepage',{templateUrl: '/views/titlepage'})
        .when('/reader',{templateUrl: '/views/reader'});
}])

.provider('parser', function() {
    return {
        $get: function() {
            return new GBE.Parser();
        }
    };
})

.controller('GameBookCtrl', function($scope, parser, $q, contentService, $rootScope) {

    $scope.encounter = undefined;

    $("body").on('click', "a[data-action=show-asset]", function(e) {
        var key = $(e.target).attr('href').substr(1);
        $scope.showAsset(key);
        e.preventDefault();
        return false;
    });

    $("body").on('click', "a[data-action=add_artefact]", function(e) {
        var param = $(this).attr('data-param');
        $scope.addArtefact(param, e.target);
        e.preventDefault();
        return false;
    });

    $("body").on('click', "a[data-action=add_weapon]", function(e) {
        var param = $(this).attr('data-param');
        $scope.addWeapon(param, e.target);
        e.preventDefault();
        return false;
    });

    $("body").on('click', "a[data-action=add_money]", function(e) {
        var param = $(this).attr('data-param');
        $scope.addMoney(param, e.target);
        e.preventDefault();
        return false;
    });

    $("body").on('click', "a[data-action=check]", function(e) {
        var param = $(this).attr('data-param');
        var actionIdx = $(this).attr('data-action-index');

        e.preventDefault();

        // Remove the anchor
        $(e.target).remove();

        var action = $scope.scene.actions[actionIdx];

        var outcomes = ['any'];

        // Perform the attribute check
        if($scope.heroe.simpleCheck('skill')) {
            outcomes.push('success');
        }
        else {
            outcomes.push('failure');
        }

        // Reload the scene
        $scope.scene.selectOutcomes(action, function(scene, outcome) {
            return _.contains(outcomes, outcome.type);
        }, function(scene) {
            scene.activate($scope.heroe, onNextScene);
        });

        return false;
    });

    $scope.heroe = $rootScope.profile.heroe;
    contentService.loadContent($rootScope.meta.content).then(function(content) {

        parser.parse(content, function(err, gamebook) {
            $rootScope.gb = gamebook;

            // start the book (should display title page here)
            if($rootScope.profile.currentScene)
                $scope.scene = $rootScope.gb.getScene($rootScope.profile.currentScene);
            else
                $scope.scene = $rootScope.gb.startScene();
            $scope.scene.activate($scope.heroe, onNextScene);
        });
    });

    $scope.$on('start-encounter', function(e, encounter, scene) {
        $scope.encounter = new function() {
            this.state = 'active';
            this.profile = encounter;
            this.actions = [];
            this.availableItems = [];
            this.roundCount = 0;

            this.addAction = function(action) {
                this.actions.push(action);
            };

            this.checkTimeout = function(outcome) {
                if($scope.scene.encounter.outcomes.timeout) {
                    console.log("Checking timeout", this.roundCount, $scope.scene.encounter.outcomes);
                    if(this.roundCount >= parseInt($scope.scene.encounter.outcomes.timeout.param)) {
                        outcome = {outcome:"TIMEOUT"};
                    }
                    this.roundCount++;
                }
                return outcome;
            };
        };

        // Load monster details
        var monsterDetails = [];
        _.each(encounter.monsters, function(monster) {
            monsterDetails.push(contentService.loadMonster(monster));
        });

        // Build the actor list
        $q.all(monsterDetails).then(function() {

            $scope.actor = $scope.heroe;

            // Assign the first monster
            $scope.monster = _.sortBy(encounter.monsters, function(m) { return m.value('skill') }).reverse()[0];

            // Get the encounter started
            $scope.resolveActions();
        });
    });

    $scope.safeApply = function(fn) {
        var phase = this.$root.$$phase;
        if(phase == '$apply' || phase == '$digest') {
            if(fn && (typeof(fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };

    $scope.resolveActions = function() {
        $scope.nextAction = $scope.actor.act($scope.monster);

        // Apply the action results
        $scope.nextAction.then(function(action) {
            $scope.safeApply(function() {
                var scene;

                // Apply the action on the target
                var outcome = action.action.applyOn($scope.heroe, action.target);

                if(outcome && outcome.msg)
                    $scope.encounter.addAction(outcome.msg);
                else
                    $scope.encounter.addAction(action.action.describe());
                $scope.encounter.lastAction = action.action;

                // Check if the encounter has timed out
                if(!outcome.outcome)
                    outcome = $scope.encounter.checkTimeout(outcome);

                if(outcome.outcome === 'NEXT_ACTION') {
                    $scope.resolveActions();
                }
                else if(outcome.outcome === 'TIMEOUT') {
                    $scope.encounter.state = 'timeout';

                    scene = $scope.scene.encounter.applyOutcome('timeout', $scope.scene, $rootScope.gb);
                    if(scene) {
                        scene.activate($scope.heroe, onNextScene);
                    }
                    else
                        console.log("No scene was provided. Let the user pick a selector");
                }
                else if(outcome.outcome === "TARGET_DEAD") {
                    $scope.encounter.state = 'won';

                    // Add monster treasure to the scene
                    _.each(action.target.treasures, function(t) {
                        $scope.encounter.availableItems.push.apply($scope.encounter.availableItems, t.items);
                    });

                    // Make sure we apply the win outcome if present in this encounter
                    scene = $scope.scene.encounter.applyOutcome('win', $scope.scene, $rootScope.gb);
                    if(scene) {
                        scene.activate($scope.heroe, onNextScene);
                    }
                    else
                        console.log("No scene was provided. Let the user pick a selector");
                }
                else if(outcome.outcome === 'HEROE_DEAD') {
                    $scope.encounter.state = 'won';

                    // Make sure we apply the win outcome if present in this encounter
                    scene = $scope.scene.encounter.applyOutcome('lost', $scope.scene, $rootScope.gb);
                    if(scene) {
                        scene.activate($scope.heroe, onNextScene);
                    }
                    else
                        console.log("No scene was provided. Let the user pick a selector");
                }

            });

        }, function(err) {
            console.log(err);
        });

    };

    $scope.attack = function(attack) {
        $scope.heroe.perform(attack);
    };

    $scope.cast = function(spell) {
        $scope.heroe.cast(spell);
    };

    $scope.pickItem = function(i) {
        $scope.encounter.availableItems.remove(i);
        var name = i.description || i.key;
        var item = $rootScope.meta.artefacts[i.key];
        if(item)
            name = item.name;
        $scope.heroe.addItem(i.key, name, i.value, true);
    };

    $scope.useItem = function(i) {
        console.log("Using item ", i.key);
    };

    $scope.addArtefact = function(key, anchor) {
        $scope.safeApply(function(){
            if(!$scope.heroe.getItem(key)) {
                var data = $rootScope.meta.artefacts[key];
                console.log("Adding item %s to inventory", key, data);
                $scope.heroe.addItem(key, data.name, 1, true);

                var $anchor = $(anchor);
                var text = $anchor.text();
                $anchor.replaceWith(function(){
                    return "<span class='muted'>"+text+"</span>";
                });
            }
            else
                console.log("artefact %s is already in inventory", key);
        });
    };

    $scope.addWeapon = function(key, anchor) {
        $scope.safeApply(function(){
            if(!$scope.heroe.getItem(key)) {
                var weapon = $rootScope.meta.weapons[key];
                $scope.heroe.setWeapon(weapon);

                var $anchor = $(anchor);
                var text = $anchor.text();
                $anchor.replaceWith(function() {
                    return "<span class='muted'>"+text+"</span>";
                });
            }
            else
                console.log("artefact %s is already in inventory", key);
        });
    };

    $scope.addMoney = function(key, anchor) {
        $scope.safeApply(function(){
            console.log("Adding money to inventory", key);
            var idx = key.indexOf('#');
            var type = key.substring(0, idx);
            var amount = parseInt(key.substring(idx+1));

            console.log("adding %d %s to inventory", amount, type);

            var obj = $rootScope.meta.artefacts[type], name = type;
            if(obj)
                name = obj.name;

            $scope.heroe.addItem(type, name, amount, true);

            var $anchor = $(anchor);
            var text = $anchor.text();
            $anchor.replaceWith(function() {
                return "<span class='muted'>"+text+"</span>";
            });

        });
    };

    $scope.checkLuck = function() {

        if($scope.encounter.lastAction) {

            console.dir($scope.encounter.lastAction);

            var check = $scope.heroe.simpleCheck('luck');
            var result = $scope.encounter.lastAction.applyLuck(check);
            $scope.encounter.addAction(result.msg, check ? "text-success": "text-danger");
            console.log("Check luck result", result);

            if(result.outcome === 'NEXT_ACTION') {
                $scope.resolveActions();
            }
            else if(result.outcome === "TARGET_DEAD") {
                $scope.encounter.state = 'won';

                // Add monster treasure to the scene
                _.each($scope.encounter.lastAction.target.treasures, function(t) {
                    $scope.encounter.availableItems.push.apply($scope.encounter.availableItems, t.items);
                });

                // Make sure we apply the win outcome if present in this encounter
                var scene = $scope.scene.encounter.applyOutcome('win', $scope.scene, $rootScope.gb);
                if(scene) {
                    scene.activate($scope.heroe, onNextScene);
                }
                else
                    console.log("No scene was provided. Let the user pick a selector");
            }
            else if(result.outcome === 'HEROE_DEAD') {
                $scope.encounter.state = 'lost';

                // Make sure we apply the win outcome if present in this encounter
                scene = $scope.scene.encounter.applyOutcome('lost', $scope.scene, $rootScope.gb);
                if(scene) {
                    scene.activate($scope.heroe, onNextScene);
                }
                else
                    console.log("No scene was provided. Let the user pick a selector");
            }

            // Remove last action in either case
            delete $scope.encounter.lastAction;
        }

    };

    $scope.toggleBlock = function() {

        $scope.encounter.block = !$scope.encounter.block;
        if($scope.encounter.block) {
            $scope.encounter.addAction("You take a defensive stance to improve your protection");
            $scope.heroe.armorBonus = Math.round($scope.heroe.armor * 0.5);

            _.each($scope.heroe.attacks, function(a) {
                a.hitBonus = -Math.round(a.hit * 0.5);
            });
        }
        else {
            $scope.encounter.addAction("You get back to your offensive stance");
            $scope.heroe.armorBonus = 0;
            _.each($scope.heroe.attacks, function(a) {
                a.hitBonus = 0;
            });
        }

    };

    $scope.toggleRage = function() {

        $scope.encounter.rage = !$scope.encounter.rage;
        if($scope.encounter.rage) {
            $scope.encounter.addAction("You forget about yourself and fiercely push your attacks!");
            $scope.heroe.armorBonus = -Math.round($scope.heroe.armor * 0.5);

            _.each($scope.heroe.attacks, function(a) {
                a.hitBonus = Math.round(a.hit * 0.5);
            });
        }
        else {
            $scope.encounter.addAction("You calm down and return to your usual combat tactics");
            $scope.heroe.armorBonus = 0;
            _.each($scope.heroe.attacks, function(a) {
                a.hitBonus = 0;
            });
        }

    };

    $scope.choose = function(selector) {
        var sceneNo = selector.nextScene();
        if(sceneNo) {
            var scene = $rootScope.gb.getScene(sceneNo);
            if(scene)
                scene.activate($scope.heroe, onNextScene);
            else
                console.log("No scene #%d was found in gamebook content", sceneNo);
        }

    };

    $scope.showMap = function() {
        $scope.asset = {
            key: 'world_map.jpg',
            name: 'Adventure Map'
        };
        $("#assetWindow").modal('show');
    };

    $scope.showAsset = function(key, raw) {
        $scope.safeApply(function(){
            if(!raw) {
                $scope.asset = $scope.scene.findAsset(key);
            }
            else {
                $scope.asset = {
                    key: key,
                    name: ""
                }
            }
            $("#assetWindow").modal('show');
        });
    };

    function onNextScene (scene){
        $scope.scene = scene;

        // Keep track of where we went
        $scope.heroe.history.push({
            no:scene.no
        });

        if($scope.scene.encounter) {
            $scope.$emit('start-encounter', $scope.scene.encounter, $scope.scene);
        }

        $rootScope.profile.currentScene = scene.no;
        if(scene.milestone) {
            $rootScope.profile.progress = scene.milestone;
        }
        contentService.saveGameProfile($rootScope.profile);
    }

})

.controller('TitlepageCtrl', ['$scope', 'contentService', '$location', '$rootScope', function($scope, contentService, $location, $rootScope) {

    contentService.loadBook().then(function(book) {
        $rootScope.meta = book;
        $scope.profiles = contentService.listGameProfiles();
    });

    $scope.createProfile = function() {

        // Generate a heroe from content
        contentService.loadHeroe().then(function(heroe) {
            var profile = {};
            profile.heroe = new GBE.Heroe(heroe);
            profile.gamebook = $rootScope.meta.key;
            profile.artefacts = 0;
            profile.maxArtefacts = $rootScope.meta.maxArtefacts;
            profile.progress = 0;
            profile.date = new Date();
            profile.currentScene = 1;
            profile.maxProgress = $rootScope.meta.maxProgress;
            $rootScope.profile = profile;
            $location.path("reader");
        });

    };

    $scope.loadProfile = function(profile) {
        console.log("Load profile", profile);
        contentService.loadGameProfile(profile).then(function(profile) {
            $rootScope.profile = profile;
            $rootScope.profile.heroe = new GBE.Heroe(profile.heroe);
            $location.path("reader");
        }, function(reason) {
            console.log("Unable to load game profile:", reason);
        });
    };

}])

.run(function($rootScope, $location) {
    document.addEventListener('deviceready', function() {
        $rootScope.$broadcast('deviceready');
    }, false);

    $location.path("titlepage");
});
