angular.module('gbe', ['gbe.services'])

.provider('parser', function() {
    return {
        $get: function() {
            return new GBE.Parser();
        }
    };
})

.controller('GameBookCtrl', function($scope, parser, $q, contentService) {
    var gb;

    $scope.encounter = undefined;

    $("body").on('click', "a[data-action=show-asset]", function(e){
        alert("This is a test! "+$(e.target).attr('href'));
        return false;
    });

    contentService.loadHeroe().then(function(heroe) {
        $scope.heroe = new GBE.Heroe(heroe);

        contentService.loadBook().then(function(book){
            contentService.loadContent(book.content).then(function(content) {

                parser.parse(content, function(err, gamebook) {
                    gb = gamebook;

                    // start the book (should display title page here)
                    $scope.scene = gamebook.startScene();
                });
            });
        });

    });

    $scope.$on('start-encounter', function(e, encounter, scene){
        $scope.encounter = new function() {
            this.state = 'prepare';
            this.profile = encounter;
            this.actions = [];
            this.block = false;
            this.rage = false;
            this.availableItems = [];

            this.addAction = function(action) {
                this.actions.push(action);
            }
        };

        // Load monster details
        var monsterDetails = [];
        _.each(encounter.monsters, function(monster) {
            monsterDetails.push(contentService.loadMonster(monster));
        });

        // Build the actor list, sorted by high DEX
        $q.all(monsterDetails).then(function() {

            var actors= [$scope.heroe].concat(_.values(encounter.monsters));
            $scope.encounter.actors = _.sortBy(actors, function(a) { return a.skills.DEX }).reverse();

            // Assign the first monster (the one with the highest DEX)
            $scope.monster = _.sortBy(encounter.monsters, function(m) { return m.skills.DEX }).reverse()[0];

            // Assign the first actor
            $scope.nextActor();

            if($scope.actor.isHeroe()) {
                $scope.encounter.addAction("You are faster than your ennemy, you act first!");
            }
            else
                $scope.encounter.addAction("The "+$scope.monster.label()+" is faster than you. He attacks!");

            // Get the encounter started
            $scope.resolveActions();
        });
    });

    $scope.nextActor = function() {
        if($scope.actorIndex === $scope.encounter.actors.length - 1 || _.isUndefined($scope.actorIndex))
            $scope.actorIndex = 0;
        else
            $scope.actorIndex++;
        $scope.actor = $scope.encounter.actors[$scope.actorIndex];
    };

    $scope.resolveActions = function() {
        if($scope.actor.isHeroe())  {
            $scope.nextAction = $scope.actor.act($scope.monster);
        }
        else {
            $scope.nextAction = $scope.actor.act($scope.heroe);
        }

        // Apply the action results
        $scope.nextAction.then(function(action) {
            $scope.$apply(function() {
                $scope.encounter.addAction(action.action.describe());

                // Apply the action on the target
                var outcome = action.action.applyOn(action.target);

                if(outcome === 'NEXT_ACTION') {
                    $scope.nextActor();
                    $scope.resolveActions();
                }
                else if(outcome === "TARGET_DEAD") {
                    var scene;

                    if($scope.actor.isHeroe()) {
                        $scope.scene.encounter.state = 'won';

                        // Add monster treasure to the scene
                        _.each(action.target.treasures, function(t){
                            $scope.encounter.availableItems.push.apply($scope.encounter.availableItems, t.items);
                        });

                        // Make sure we apply the win outcome if present in this encounter
                        scene = $scope.scene.encounter.applyOutcome('win', $scope.scene, gb);
                        if(scene) {
                            scene.activate(function(scene)  {
                                $scope.scene = scene;

                                if($scope.scene.encounter) {
                                    $scope.$emit('start-encounter', $scope.scene.encounter, $scope.scene);
                                }
                            });
                        }
                        else
                            console.log("No scene was provided. Let the user pick a selector");
                    }
                    else {
                        $scope.scene.encounter.state = 'lost';

                        // Make sure we apply the win outcome if present in this encounter
                        scene = $scope.scene.encounter.applyOutcome('lost', $scope.scene, gb);
                        if(scene) {
                            scene.activate(function(scene)  {
                                $scope.scene = scene;

                                if($scope.scene.encounter) {
                                    $scope.$emit('start-encounter', $scope.scene.encounter, $scope.scene);
                                }
                            });
                        }
                        else
                            console.log("No scene was provided. Let the user pick a selector");
                    }
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
        $scope.heroe.addItem(i.description, i.value);
    };

    $scope.useItem = function(i) {

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
            var scene = gb.getScene(sceneNo);
            scene.activate(function(scene){
                $scope.scene = scene;

                if($scope.scene.encounter) {
                    $scope.$emit('start-encounter', $scope.scene.encounter, $scope.scene);
                }
            });
        }

    };

})

.run(function($rootScope) {
    document.addEventListener('deviceready', function() {
        $rootScope.$broadcast('deviceready');
    }, false);
});
