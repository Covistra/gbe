(function(window, undefined){

    function toHash(attrArray){
        var hash = {};
        const VALUEPAIR = /(\w+):(.*)/;
        attrArray.forEach(function(attr){
            var parts = attr.match(VALUEPAIR);
            hash[parts[1]] = parts[2];
        });
        return hash;
    }

    window.GBE = {
        Parser: function(gb) {
            var gamebook = new GBE.Gamebook(gb);

            const METATAG = /{.*}/;
            const TAG_ATTR = /(\w*):([^,:{}]*)/g;

            function analyzeLine(lines, i, cb) {
                if(i >= lines.length) return cb(null, ++i);

                var tags = lines[i].match(METATAG);
                if(tags && tags.length > 0) {
                    var attrs= toHash(tags[0].match(TAG_ATTR));

                    // We have a new scene descriptor
                    if(attrs.Scene) {
                        console.log("Creating a new scene", attrs.Scene);
                        var scene = new GBE.Scene();
                        scene.parse(lines, attrs, ++i, function(err, newIdx){
                            gamebook.scenes.push(scene);
                            cb(null, newIdx);
                        });
                    }
                    else{
                        console.log("Not a scene descriptor", i);
                        cb(null, ++i);
                    }
                }
                else {
                    console.log("No tag on this line. Just skipping it", i);
                    cb(null, ++i);
                }
            }
            this.parse = function(content, callback) {

                var lines = content.split('\n');
                var i = 0;

                var cb = function(err, newIdx) {
                    i = newIdx;

                    if(i <= lines.length)
                        analyzeLine(lines, ++i, cb);
                    else
                        callback(err, gamebook);
                };

                analyzeLine(lines, i, cb);
            }

        },
        Gamebook: function(gb) {
            var _this = this;

            this.scenes = [];

            this.startScene = function() {
                console.log("Looking for start scene");
                return _.find(_this.scenes, function(s){ return s.start; });
            };

            this.getScene = function(no) {
                return _.find(_this.scenes, function(s){ return s.no == no });
            };

        },
        Scene: function() {
            var _this = this;

            function parseLocations(content) {
                var result = content;

                if(/{\s*[Ll]ocation:(.*)}/.test(content)) {
                    var matches = content.match(/{\s*([Ll]ocation):([^}]*)}/g);
                    if(matches) {
                        matches.forEach(function(m) {
                            var key = m.match(/:([\w\s]+)/);
                            _this.references.push({
                                name:key[1]
                            });
                            result = result.replace(m, "<span class='location'>"+key[1]+"</span>");
                        });
                    }
                }

                return result;
            }

            function parseAssets(content) {
                var result = content;

                if(/{\s*asset:(.*)}/i.test(content)) {
                    var matches = content.match(/{\s*asset:([^}]*)}/ig);
                    if(matches) {
                        matches.forEach(function(a) {
                            var key = a.match(/:([\w\s]+)/);
                            _this.assets.push({
                                name:key[1]
                            });
                            result = result.replace(a, "<a href='#"+ $.trim(key[1])+"' data-action='show-asset'>"+key[1]+"</a>");
                        });
                    }
                }

                return result;
            }

            function parseBlocks(content) {
                var result = content;
                var blocks = content.match(/{\s*[Bb]lock\s*:\s*([^}]*)\s*}(.*?){\/[Bb]lock\s*}/);
                while(blocks) {
                    _this.blocks.push(new GBE.Block(blocks[1], blocks[2], blocks.index));
                    result = result.replace(blocks[0], "$block("+(_this.blocks.length-1)+")");
                    blocks = result.match(/{\s*[Bb]lock\s*:\s*([^}]*)}(.*?){\/[Bb]lock\s*}/);
                }

                return result;
            }

            function parseSelectors(content) {
                var result = content;
                var selectors = content.match(/{\s*[Ss]elector\s*:\s*([^}]*)\s*}(.*?){\/[Ss]elector\s*}/);
                while(selectors) {
                    _this.selectors.push(new GBE.Selector(selectors[1], selectors[2], selectors.index));
                    result = result.replace(selectors[0], "");
                    selectors = result.match(/{\s*[Ss]elector\s*:\s*([^}]*)\s*}(.*?){\/[Ss]elector\s*}/);
                }

                return result;
            }

            this.parse = function(lines, attrs, idx, cb) {

                _this.no = attrs.Scene;
                _this.start = attrs.start;
                _this.lang = attrs.lang;
                _this.rating = attrs.rating;
                _this.references = [];
                _this.blocks = [];
                _this.selectors = [];
                _this.assets = [];

                var content = [];
                while(idx < lines.length && lines[idx].length != 0) {
                    content.push(lines[idx++]);
                }
                _this.content = content.join(" ");

                // Parse all special tags
                _this.content = parseLocations(_this.content);
                _this.content = parseBlocks(_this.content);
                _this.content = parseAssets(_this.content);

                // Register any encounter definition
                var encounters = _this.content.match(/{\s*[Ee]ncounter\s*:\s*([^}]*)\s*}/);
                if(encounters) {
                    var encounter = "";
                    var end = _this.content.match(/{\/[Ee]ncounter\s*}/);
                    if(end && end.index != -1) {
                        encounter = _this.content.substr(encounters.index, end.index);
                    }
                    else {
                        encounter = _this.content.substr(encounters.index);
                    }
                    _this.content = _this.content.replace(encounter, "");
                    _this.encounter = new GBE.Encounter(encounter);
                }

                // Parse all selectors
                _this.content = parseSelectors(_this.content);

                cb(null, idx);
            };

            this.render = function(heroe) {
                var html = _this.content;
                this.blocks.forEach(function(block, idx) {
                    if(block.isApplicable(heroe)) {

                        // Handle selectors in this conditional block
                        block.content = parseSelectors(block.content);

                        // Handle locations in this conditional block
                        block.content = parseLocations(block.content);

                        html = html.replace("$block("+idx+")", block.content);
                    }
                    else
                        html = html.replace("$block("+idx+")", "");
                });

                return html;
            };

            this.activate = function(cb) {
                cb(this);
            }
        },
        Block: function(expr, content, idx) {
            this.expr = expr;
            this.content = content;
            this.index = idx;

            this.isApplicable = function(heroe) {
                var expr = new GBE.Expression(this.expr);
                return expr(heroe);
            }
        },
        Encounter: function(body) {
            var _this = this;
            this.outcomes= {};
            this.monsters = {};
            this.actions = [];

            // Extract encounter type
            this.type = body.match(/{encounter\s*:\s*([^,}\s]+)\s*.*?}/i)[1];

            // Extract encounter title
            this.title = body.match(/{encounter\s*:\s*.*?,\s*title:\s*"(.*?)"\s*}/i)[1];
            console.log(this.title);

            // Extract all monsters
            var monsters = body.match(/{\s*monster\s*:\s*(.*?)}\s*(.*?)\s*{\/monster\s*}/ig);
            _.each(monsters, _.bind(function(monsterBody) {
                var type = monsterBody.match(/{monster\s*:\s*([^,}\s]+).*?}/i)[1];
                this.monsters[type] = new GBE.Monster(monsterBody);
            }, this));

            // Extract all outcomes
            var outcomeBody = body.match(/{\s*outcomes\s*:\s*(.*?)\s*}/i);
            var outcomes = outcomeBody[1].match(/\s*(\w+)\s*:\s*([^,}\s]*)\s*/ig);
            _.each(outcomes, function(outcome){
                var fragments = outcome.match(/\s*(\w+)\s*:\s*(.*)/i);
                _this.outcomes[fragments[1]] = new GBE.Outcome(fragments[2]);
            });

            this.addAction = function(action) {
                this.actions.push(action);
            }
        },
        Outcome: function(expr) {
            this.expr = expr;
        },
        Selector: function(expr, content, idx) {
            this.expr = expr;
            this.content = content;
            this.index = idx;

            this.nextScene = function() {
                var sceneKey = this.expr.match(/\s*Go\((\d+)\)\s*/);
                if(sceneKey) {
                    return sceneKey[1];
                }
                return null;
            };
        },
        Expression: function(expr) {
            if(expr) {
                var fragments = expr.match(/([^><=\s]+)\s*([><=]+)\s*([^<>=\s]+)/);

                return function(heroe) {
                    if(fragments[2] === '<')
                        return heroe.skills[fragments[1]] < parseInt(fragments[3]);
                    else if(fragments[2] === '>')
                        return heroe.skills[fragments[1]] > parseInt(fragments[3]);
                    else if(fragments[2] === '=')
                        return heroe.skills[fragments[1]] === parseInt(fragments[3]);
                    else if(fragments[2] === '>=')
                        return heroe.skills[fragments[1]] >= parseInt(fragments[3]);
                    else if(fragments[2] === '<=')
                        return heroe.skills[fragments[1]] <= parseInt(fragments[3]);
                    else if(fragments[2] === '<>')
                        return heroe.skills[fragments[1]] !== parseInt(fragments[3]);
                    else
                        return false;
                }
            }
            else {
                return function() {
                    return true;
                }
            }
        },
        Heroe: function(data) {
            _.extend(this, data);

            this.healthBonus = 0;
            this.armorBonus = 0;
            this.magicBonus = 0;

            // Convert data into objects
            var attacks= [];
            _.each(this.attacks, function(a){
                attacks.push(new GBE.Attack(a));
            });
            this.attacks = attacks;

            this.type = 'Heroe';

            this.adjHealth = function() {
                return Math.round(this.health + this.healthBonus);
            };

            this.adjMaxHealth = function() {
                return Math.round(this.maxHealth + this.healthBonus);
            };

            this.adjMagic = function() {
                return Math.round(this.magic + this.magicBonus);
            };

            this.adjMaxMagic = function() {
                return Math.round(this.maxMagic + this.magicBonus);
            };

            this.adjArmor = function() {
                return Math.round(this.armor + this.armorBonus);
            };

            this.adjMaxArmor = function() {
                return Math.round(this.maxArmor + this.armorBonus);
            };

            this.healthRatio = function() {
                return this.adjHealth() / this.adjMaxHealth() * 100;
            };

            this.magicRatio = function() {
                return this.adjMagic() / this.adjMaxMagic() * 100;
            };

            this.armorRatio = function() {
                return this.adjArmor() / this.adjMaxArmor() * 100;
            };

            this.isHeroe = function() { return true; };

            /**
             * Create a new defer that will be resolved after the user picked an action
             */
            this.act = function(target) {
                this.nextAction = Q.defer();
                this.currentTarget = target;
                return this.nextAction.promise;
            };

            this.perform = function(action) {
                if(this.nextAction) {
                    this.nextAction.resolve({action:action, target:this.currentTarget});
                }
                else
                    console.log("No nextAction has been installed...");
            };

            this.takeHit = function(dmg, type) {
                this.health -= dmg;
                return this.health;
            };

        },
        Monster: function(body) {
            this.type = body.match(/{monster\s*:\s*(.*?)\s*,/i)[1];
            this.count = parseInt(body.match(/{.*?count\s*:\s*(\d+).*?}/i)[1]);
            this.level = parseInt(body.match(/{.*?level\s*:\s*(\d+).*?}/i)[1]);
            this.attacks = [];
            this.treasures = [];
            this.artefacts = [];
            this.outcomes = [];
            this.healthBonus = 0;
            this.magicBonus = 0;
            this.armorBonus = 0;

            // Handle any internal elements
            var internal = body.match(/{monster\s*:.*?\s*}\s*(.*?)\s*{\/monster\s*}/i);
            var configs = internal[1].match(/{\s*(.*?)\s*:\s*(.*?)}/ig);
            _.each(configs, _.bind(function(config) {

                // Extract the type
                var type = config.match(/{\s*(\w+):.*?}/i)[1];

                // Key Objects
                if(type.match(/attack/i)) {
                    this.attacks.push(new GBE.Attack(config, this.type));
                }
                else if(type.match(/treasure/i)) {
                    this.treasures.push(new GBE.Treasure(config));

                }
                else if(type.match(/artefact/i)) {
                    this.artefacts.push(new GBE.Artefact(config));
                }
                else
                    console.log("Unsupported monster configuration type: ", type);
            }, this));

            this.load = function($http) {
                var _this = this;
                return $http.get('/monster/'+this.type).then(function(resp) {
                    _.extend(_this, resp.data);
                });
            };

            this.adjHealth = function() {
                return Math.round(this.health + this.healthBonus);
            };

            this.adjMaxHealth = function() {
                return Math.round(this.maxHealth + this.healthBonus);
            };

            this.adjMagic = function() {
                return Math.round(this.magic + this.magicBonus);
            };

            this.adjMaxMagic = function() {
                return Math.round(this.maxMagic + this.magicBonus);
            };

            this.adjArmor = function() {
                return Math.round(this.armor + this.armorBonus);
            };

            this.adjMaxArmor = function() {
                return Math.round(this.maxArmor + this.armorBonus);
            };

            this.healthRatio = function() {
                return this.adjHealth() / this.adjMaxHealth() * 100;
            };

            this.magicRatio = function() {
                return this.adjMagic() / this.adjMaxMagic() * 100;
            };

            this.armorRatio = function() {
                return this.adjArmor() / this.adjMaxArmor() * 100;
            };

            this.label = function() {
                return this.type.toLowerCase();
            };

            this.act = function(target) {
                var defer = Q.defer();
                setTimeout(_.bind(function() {
                    console.dir(target);

                    // We use an encounter strategy (base provided by monster definition + encounter overrides)

                    // How is our health?
                        // May drink a potion or cast a healing spell
                    // How is our ennemy? Compared to us?
                        //  May flee or push the attack

                    // Do we have an attack?
                    if(this.attacks.length > 0) {
                        console.log("Our strategy elected to attack the heroe");
                        defer.resolve({action:this.attacks[0], target:target});
                    }

                }, this), 1500);

                return defer.promise;
            };

            this.isHeroe = function() { return false; };

            this.takeHit = function(dmg, type) {
                this.health -= dmg;
                return this.health;
            };
        },
        Attack:function(body, performer) {
            if(_.isObject(body)){
                _.extend(this, body);
            }
            else {
                var matches = body.match(/{attack:\s*(.*?)\s*\((\d+)\s*,\s*(.*?)\)\s*}/i);
                this.name = matches[1];
                this.hit = parseInt(matches[2]);
                this.dmg = matches[3];
            }

            this.hitBonus = 0;

            this.describe = function() {
                if(performer)
                    return performer + " hits you with " + this.name;
                else
                    return "You hit your opponent using your " + this.name;
            };

            this.applyOn = function(target) {
                console.log("Attack strength: ", this.adjustedHit());
                var dmgFactor = this.adjustedHit() - target.adjArmor()
                if(dmgFactor >= 0) {

                    dmgFactor = dmgFactor / target.adjArmor();

                    var dmg = Math.floor(GBE.Tools.roll(this.dmg ) * (1.0+dmgFactor));

                    console.log("Damage Factor: ", (1+dmgFactor));
                    console.log("Damage: ", dmg);

                    // Apply to target
                    var outcome = target.takeHit(dmg);
                    if(outcome <= 0) {
                        // This target is dead, let's report it
                        return "TARGET_DEAD";
                    }

                    // update armor
                    target.armor += -1 * (1+dmgFactor);

                }
                else {
                    dmgFactor = dmgFactor / target.adjArmor();
                    target.armor += -1 * ((1+dmgFactor)/2);
                }

                console.log("New armor value is ", target.adjArmor());
                return "NEXT_ACTION";
            };

            this.adjustedHit = function() {
                return this.hit + this.hitBonus;
            };

        },
        Treasure:function(body) {

        },
        Artefact:function(body) {

        },
        Tools: {
            roll: function(range) {
                if(_.isString(range)){
                    var factors = range.match(/\s*(\d+)\s*-\s*(\d+)\s*/);
                    return Math.round(Math.random() * parseInt(factors[2] - factors[1]) + parseInt(factors[1]));
                }
                else
                    return range;
            }
        }
    };

})(window);
