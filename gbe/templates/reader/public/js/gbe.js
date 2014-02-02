(function(window, undefined){

    var converter = new Showdown.converter();

    function toHash(attrArray){
        var hash = {};
        if(attrArray) {
            const VALUEPAIR = /(\w+):(.*)/;
            attrArray.forEach(function(attr){
                var parts = attr.match(VALUEPAIR);
                hash[parts[1]] = parts[2];
            });
        }
        return hash;
    }

    Array.prototype.remove = function() {
        var what, a = arguments, L = a.length, ax;
        while (L && this.length) {
            what = a[--L];
            while ((ax = this.indexOf(what)) !== -1) {
                this.splice(ax, 1);
            }
        }
        return this;
    };


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
                return _.find(_this.scenes, function(s){ return s.start; });
            };

            this.endScene = function() {
                return _.find(_this.scenes, function(s){ return s.end; });
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
                            var key, text;
                            var location = m.match(/:([\w\s|]+)/);
                            var idx = location[1].indexOf('|');
                            if(idx != -1) {
                                key = location[1].substring(0, idx);
                                text = location[1].substring(idx+1);
                            }
                            else {
                                key = location[1];
                                text = location[1];
                            }
                            _this.references.push({
                                name:key
                            });
                            result = result.replace(m, "<span class='location'>"+text+"</span>");
                        });
                    }
                }

                return result;
            }

            function parseCharacters(content) {
                var result = content;

                if(/{\s*[Cc]haracter:(.*)}/.test(content)) {
                    var matches = content.match(/{\s*([Cc]haracter):([^}]*)}/g);
                    if(matches) {
                        matches.forEach(function(m) {
                            var key, text;
                            var character = m.match(/:([\w\s|]+)/);
                            var idx = character[1].indexOf('|');
                            if(idx != -1) {
                                key = character[1].substring(0, idx);
                                text = character[1].substring(idx+1);
                            }
                            else {
                                key = character[1];
                                text = character[1];
                            }
                            _this.references.push({
                                name:key
                            });
                            result = result.replace(m, "<span class='character'>"+text+"</span>");
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
                            var key = a.match(/:\s*(\w+)\s*,\s*(.*?)\s*}/);
                            _this.assets.push({
                                name:key[1],
                                key: key[2]
                            });
                            result = result.replace(a, "<a href='#"+ $.trim(key[2])+"' data-action='show-asset'>"+key[1]+"</a>");
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

            function parseActions(content) {
                var result = content;
                var actions = content.match(/{\s*[Aa]ction\s*:\s*([^}]*)\s*}(.*?){\/[Aa]ction\s*}/);
                while(actions) {
                    var action = new GBE.Action(actions[1], actions[2], actions.index);
                    _this.actions.push(action);
                    result = result.replace(actions[0], "<a href='#' class='btn btn-info btn-mini' data-action-index='"+(_this.actions.length-1)+"' data-action='"+action.verb+"' data-param='"+action.param+"'>"+action.text+"</a>");
                    actions = result.match(/{\s*[Aa]ction\s*:\s*([^}]*)}(.*?){\/[Aa]ction\s*}/);
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

            function parseEffects(content) {
                var result = content;
                var effects = content.match(/{\s*[Ee]ffect\s*:\s*([^}]*)\s*}(.*?){\/[Ee]ffect\s*}/);
                while(effects) {
                    _this.effects.push(new GBE.Effect(effects[1], effects[2], effects.index));
                    result = result.replace(effects[0], effects[2]);
                    effects = result.match(/{\s*[Ee]ffect\s*:\s*([^}]*)}(.*?){\/[Ee]ffect\s*}/);
                }

                return result;
            }


            function parseStructure(content) {
                return content.replace(/{\s*para\s*}/ig, "\n\n");
            }

            this.parse = function(lines, attrs, idx, cb) {

                _this.no = parseInt(attrs.Scene);
                _this.start = attrs.start;
                _this.end = attrs.end;
                _this.lang = attrs.lang;
                _this.rating = attrs.rating;
                if(attrs.title)
                    _this.title = attrs.title.match(/\"(.*?)\"/)[1];
                _this.references = [];
                _this.blocks = [];
                _this.selectors = [];
                _this.effects = [];
                _this.assets = [];
                _this.actions = [];
                _this.milestone = attrs.milestone;


                var content = [];
                while(idx < lines.length && lines[idx].length != 0) {
                    content.push(lines[idx++]);
                }
                _this.content = content.join(" ");
                _this.origContent = _this.content;

                // Parse all special tags
                _this.content = parseActions(_this.content);
                _this.content = parseLocations(_this.content);
                _this.content = parseCharacters(_this.content);
                _this.content = parseBlocks(_this.content);
                _this.content = parseAssets(_this.content);
                _this.content = parseEffects(_this.content);

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

                // Parse scene structure (paragraph)
                _this.content = parseStructure(_this.content);

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

                return converter.makeHtml(html);
            };

            this.activate = function(heroe, cb) {

                // Execute any effects
                _.each(this.effects, function(e){
                    e.apply(heroe);
                });

                cb(this);
            };

            this.findAsset = function(key) {
                return _.find(this.assets, function(a) { return a.key === key });
            };

            this.selectOutcomes = function(action, selector, done) {
                this.content = this.origContent;

                var applicableOutcomes = [];

                // Replace the action with all applicable outcomes content
                _.each(action.outcomes, function(outcome) {
                    if(selector(_this, outcome)) {
                        applicableOutcomes.push(outcome);
                    }
                });

                console.log("Found %d applicable outcomes", applicableOutcomes.length);

                // Replace the action using all applicable outcomes
                var endIdx = _this.content.indexOf("{/Action}", action.index) + 9;
                var newContent =_this.content.substring(0, action.index);
                _.each(applicableOutcomes, function(outcome){
                    _this.content += outcome.body;
                });
                _this.content = newContent +_this.content.substring(endIdx+1);

                // Perform a full parsing of the new content

                // Parse all special tags
                _this.content = parseActions(_this.content);
                _this.content = parseLocations(_this.content);
                _this.content = parseCharacters(_this.content);
                _this.content = parseBlocks(_this.content);
                _this.content = parseAssets(_this.content);
                _this.content = parseEffects(_this.content);

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

                // Parse scene structure (paragraph)
                _this.content = parseStructure(_this.content);

                // Call the done callback when complete
                done(_this);
            };

        },
        Block: function(expr, content, idx) {
            this.expr = expr;
            this.content = content.replace(/{\s*para\s*}/ig, "\n\n");
            this.index = idx;

            this.isApplicable = function(heroe) {
                var expr = new GBE.Expression(this.expr);
                return expr(heroe);
            }
        },
        Action: function(expr, content, idx) {
            var params = expr.match(/(\w+)\s*:\s*([^}\s,]+)\s*(\s*(.*))?/);
            this.verb = params[1];
            this.param = params[2];
            this.text = params[3] || content;
            this.content = content;
            this.index = idx;
            this.outcomes = [];

            console.dir(this);

            // indicate that we have an amount
            var amountIdx = this.param.indexOf('#');
            if(amountIdx != -1) {
                var range = this.param.substring(amountIdx+1);
                this.amount = GBE.Tools.roll(range);

                // Replace any amount reference in the content
                this.text = this.text.replace('{{amount}}', this.amount);

                if(this.amount > 1)
                    this.text += 's';

                // Replace the param with the computed amount
                this.param = this.param.substring(0, amountIdx) + '#' + this.amount;
            }

            // Register all outcomes
            if(params[3]) {
                var result = this.content;
                var outcomes = content.match(/{\s*[Oo]utcome\s*:\s*([^}]*)\s*}(.*?){\/[Oo]utcome\s*}/);
                while(outcomes) {
                    this.outcomes.push(new GBE.ActionOutcome(outcomes[1], outcomes[2], outcomes.index));
                    result = result.replace(outcomes[0], "$outcome("+(this.outcomes.length-1)+")");
                    outcomes = result.match(/{\s*[Oo]utcome\s*:\s*([^}]*)\s*}(.*?){\/[Oo]utcome\s*}/);
                }
            }
            else
                console.log("Action has no special outcome(s)");

            this.execute = function(heroe, scene) {
                console.log("Reader is executing action ", this.expr);
            };

        },
        ActionOutcome: function(type, body, index) {
            this.type = type;
            this.body = body;
            this.index = index;
        },
        Effect: function(effect, content, idx) {
            this.effect = effect;
            this.content = content;
            this.index = idx;

            this.apply = function(heroe) {
                if(/[Ii]ncrease.*/.test(this.effect)) {
                    var fragments = this.effect.match(/[Ii]ncrease\s*\((\w+)\s*,\s*(\d+)\s*\)/);
                    heroe.increase(fragments[1], parseInt(fragments[2]));
                }
                else if(/[Dd]ecrease.*/.test(this.effect)) {
                    var fragments = this.effect.match(/[Dd]ecrease\s*\((\w+)\s*,\s*(\d+)\s*\)/);
                    heroe.decrease(fragments[1], parseInt(fragments[2]));
                }
                else {
                    console.log("Unknown effect", this.effect);
                }
            };
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

            // Extract all monsters
            var monsters = body.match(/{\s*monster\s*:\s*(.*?)}\s*(.*?)\s*{\/monster\s*}/ig);
            _.each(monsters, _.bind(function(monsterBody) {
                var type = monsterBody.match(/{monster\s*:\s*([^,}\s]+).*?}/i)[1];
                this.monsters[type] = new GBE.Monster(monsterBody);
            }, this));

            // Extract all outcomes
            var outcomes = body.match(/{\s*outcome\s*(.*?){1}\s*(.*?)}/ig);
            _.each(outcomes, _.bind(function(outcomeBody) {
                var outcomeSpec = outcomeBody.match(/{outcome\s*([^:]+):\s*(.*?)\s*}/i);
                var outcome = new GBE.Outcome(outcomeSpec[1].toLowerCase(), outcomeSpec[2]);
                this.outcomes[outcome.type] = outcome;
            }, this));

            this.addAction = function(action, extraClass) {
                this.actions.push({text:action, extraClass:extraClass});
            };

            this.applyOutcome = function(key, scene, gamebook) {
                var outcome = this.outcomes[key.toLowerCase()];
                if(outcome) {
                    // Either return a scene or add a selector to the current scene
                    return outcome.apply(scene, gamebook);
                }
                else
                    console.log("No outcome for specified key", key, this.outcomes);
            };

            this.canRetreat = function() {
                return _.find(this.outcomes, function(o) {return o.type === 'retreat'});
            };

        },
        Outcome: function(type, expr) {
            this.type = type;
            this.expr = expr;

            // We have a param
            if(type && type.indexOf('#') != -1) {
                this.type = type.substring(0, type.indexOf('#'));
                this.param = type.substring(type.indexOf('#')+1);
            }

            this.apply = function(scene, gamebook) {
                var selector;

                var infos = this.expr.match(/(.*?):(.*)/i);
                if(infos && infos[1].toLowerCase() === 'selector') {
                    var args = infos[2].match(/\s*([\w\(\)]+)\s*((?:,\s*)(.*))?/i);
                    selector = new GBE.Selector(args[1], args[3]);
                    scene.selectors.push(selector);
                }
                else {
                    // Evaluate expression and produce a scene
                    selector = new GBE.Selector(this.expr);
                    var sceneNo = selector.nextScene(gamebook);
                    return gamebook.getScene(sceneNo);
                }
            };
        },
        SpecialAttack: function(config) {
            this.damageRules = [];
            this.range = config.match(/{.*?range\s*:\s*([^}\s,]+).*?}/i)[1];

            this.addDamageRule = function(damageConfig) {
                // {Damage case:1-4, stamina:4, max:3, msg:__special damage!__ it has rung your neck}
                var attributeString = damageConfig.match(/damage\s*([^}]+)/i)[1];
                var rule = {applied:0};
                var attributes = attributeString.match(/([^:,\s]+?)\s*:\s*([^,}]+)\s*/g);
                _.each(attributes, function(a) {
                    var idx = a.indexOf(':');
                    rule[a.substring(0, idx)] = a.substring(idx+1);
                });
                this.damageRules.push(rule);
            };

            this.inflictDamage = function(heroe) {
                var result = {};

                console.log("Inflicting special damage to heroe");
                var roll = GBE.Tools.roll(this.range);

                _.each(this.damageRules, function(rule) {

                    // Only apply one rule
                    if(GBE.Tools.within(roll, rule.case)) {
                        if(rule.stamina)
                            heroe.decrease('stamina', parseInt(rule.stamina));
                        if(rule.skill)
                            heroe.decrease('skill', parseInt(rule.skill));
                        if(rule.luck)
                            heroe.decrease('luck', parseInt(rule.luck));

                        rule.applied++;

                        if(rule.max) {
                            if(rule.applied == parseInt(rule.max)) {
                                result.outcome = "HEROE_DEAD";
                            }
                        }

                        result.msg = converter.makeHtml(rule.msg);
                    }
                });

                return result;
            };
        },
        Selector: function(expr, content, idx) {
            this.expr = expr;
            this.content = content;
            this.index = idx;

            console.dir(this);

            // Called when the selector is rendered
            this.render = function(gamebook, heroe, scene) {
                var checkFields = this.expr.match(/\s*[Cc]heck\((.+)\)\s*/);
                if(checkFields) {
                    var check = new GBE.AttributeCheck(checkFields[1]);
                    var result = heroe.check(check);
                    this.expr = "Go("+result.value()+")";

                    // Replace any value field
                    this.content = this.content.replace("{{value}}", result.score);

                    console.log("Updated content", this.content);
                }
                else if(/[Ii]nventory/.test(this.expr)) {
                    console.log(this.expr);

                    // Extract outcome to replace expression
                    var outcomes = this.expr.match(/[Ii]nventory\s*:\s*([\w\d]+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                    var e = new GBE.Expression(this.expr);
                    if(e(heroe)) {
                        console.log("Heroe has object in inventory!");
                        this.expr = "Go("+outcomes[2]+")";
                        console.log("checking for split context");

                        // Handle double text
                        var splitIdx = this.content.indexOf('||');
                        if(splitIdx != -1) {
                            this.content = this.content.substring(0, splitIdx);
                        }
                        else
                            console.log("No split content");
                    }
                    else {
                        console.log("Heroe doesn't have object");
                        this.expr = "Go("+outcomes[3]+")";

                        console.log("checking for split context");

                        // Handle double text
                        var splitIdx = this.content.indexOf('||');
                        if(splitIdx != -1) {
                            this.content = this.content.substring(splitIdx+2);
                        }
                        else
                            console.log("No split content");
                    }
                }
                else if(/[Hh]istory/.test(this.expr)) {
                    console.log(this.expr);

                    // Extract outcome to replace expression
                    var outcomes = this.expr.match(/[Hh]istory\s*:\s*([\w\d]+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                    var e = new GBE.Expression(this.expr);
                    if(e(heroe)) {
                        console.log("Heroe has object in inventory!");
                        this.expr = "Go("+outcomes[2]+")";
                        console.log("checking for split context");

                        // Handle double text
                        var splitIdx = this.content.indexOf('||');
                        if(splitIdx != -1) {
                            this.content = this.content.substring(0, splitIdx);
                        }
                        else
                            console.log("No split content");
                    }
                    else {
                        console.log("Heroe doesn't have object");
                        this.expr = "Go("+outcomes[3]+")";

                        console.log("checking for split context");

                        // Handle double text
                        var splitIdx = this.content.indexOf('||');
                        if(splitIdx != -1) {
                            this.content = this.content.substring(splitIdx+2);
                        }
                        else
                            console.log("No split content");
                    }
                }

                return this.content;
            };

            this.nextScene = function(gamebook) {
                var sceneKey = this.expr.match(/\s*[Gg]o\((\d+)\)\s*/);
                if(sceneKey) {
                    return sceneKey[1];
                }
                else if(this.expr.toLowerCase() === 'dead') {
                    if(gamebook) {
                        return gamebook.endScene().no;
                    }
                }
                else if(this.expr.toLowerCase() === 'titlepage') {
                    return -1;
                }

                return null;
            };
        },
        AttributeCheck: function(expr) {
            var fragments = expr.match(/\s*(\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*/);
            this.attrKey = fragments[1];
            this.winOutcome = fragments[2];
            this.failOutcome = fragments[3];
            this.deduce = 0;

            if(this.attrKey === 'luck') {
                this.deduce = 1;
            }
        },
        Expression: function(expr) {
            if(expr) {
                var fragments = expr.match(/([^><=\s:]+)\s*([><=:]+)\s*([^<>=\s:]+)/);

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
                    else if(fragments[2] === ':') {
                        if(/[Ii]nventory/.test(fragments[1])) {
                            console.log("Checking if object %s is in inventory", fragments[3]);
                            if(fragments[3].indexOf('!') != -1)
                                return !heroe.getItem(fragments[3].substring(1));
                            else
                                return _.isObject(heroe.getItem(fragments[3]));
                        }
                        else if(/[Hh]istory/.test(fragments[1])) {
                            console.log("Analyzing history");
                            if(fragments[3].indexOf('!') != -1) {
                                var r = _.isObject(_.find(heroe.history, function(s){ return s.no === parseInt(fragments[3].substring(1))} ));
                                console.log("Not Looking for %s in history, result = ", fragments[3], r);
                                return !r;
                            }
                            else {
                                var r = _.find(heroe.history, function(s){ return s.no === parseInt(fragments[3])} );
                                console.log("Look for %s in history, result = ", fragments[3], r);
                                return r;
                            }
                        }
                        else
                            return heroe.check(new GBE.AttributeCheck(fragments[1], fragments[3]));
                    }
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
            var _this = this;
            _.extend(this, data);

            if(!this.inventory)
                this.inventory = [];

            this.history = [];

            // Compute values for all attributes
            this.states = {};
            this.bonus = {};
            this.maxes = {};

            _.each(this.attributes, function(attr) {
                _this.states[attr.key] = GBE.Tools.roll(attr.score);
                _this.maxes[attr.key] = _this.states[attr.key] || 12;
                _this.bonus[attr.key] = 0;
            });

            // Convert data into objects
            var attacks= [];
            _.each(this.attacks, function(a) {
                attacks.push(new GBE.Attack(a));
            });
            this.attacks = attacks;

            var spells = [];
            _.each(this.spells, function(s) {
                spells.push(new GBE.Spell(s));
            });
            this.spells = spells;

            this.type = 'Heroe';

            this.value = function(key) {
                return Math.round(this.states[key] + this.bonus[key]);
            };

            this.max = function(key) {
                return Math.round(this.maxes[key] + this.bonus[key]);
            };

            this.ratio = function(key) {
                return this.value(key) / this.max(key) * 100;
            };

            this.increase = function(key, offset) {
                this.states[key] += offset;
                if(this.states[key] > this.maxes[key])
                    this.states[key] = this.maxes[key];
            };

            this.decrease = function(key, offset){
                this.states[key] -= offset;
            };

            this.check = function(check) {
                var _this = this;
                var roll = GBE.Tools.rollDices(2, 6);
                console.log("Checking attribute %s.", check.attrKey, roll, this.value(check.attrKey));
                // Reduce the score if required by the check
                this.states[check.attrKey] -= check.deduce;
                return {
                    value: function() {
                        return roll <= _this.value(check.attrKey) ? check.winOutcome : check.failOutcome;
                    },
                    score: roll
                }
            };

            this.simpleCheck = function(key) {
                var roll = GBE.Tools.rollDices(2, 6);
                var result = roll <= this.states[key];

                if(key === 'luck') {
                    this.states[key]--;
                }

                return result;
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

            this.cast = function(spell) {
                if(this.nextAction) {
                    this.nextAction.resolve({action:spell, target:this.currentTarget});
                }
                else
                    console.log("No nextAction has been installed...");
            };

            this.takeHit = function(dmg, type) {
                this.stamina -= dmg;
                return this.stamina;
            };

            this.addItem = function(key, desc, unit, active) {

                var existing = _.find(this.inventory, function(i){ return i.key === key });
                if(existing) {
                    existing.unit += unit;
                    existing.active = active;
                }
                else {
                    this.inventory.push({
                        key:key,
                        name:desc,
                        unit:unit,
                        active:active || false
                    });
                }
            };

            this.getItem = function(key) {
                return _.find(this.inventory, function(i){ return i.key == key;});
            };

            this.setWeapon = function(weapon) {
                if(this.attacks.length > 0 && this.attacks[0].key != weapon.key) {
                    this.maxes.skill += weapon.skill_bonus;
                    this.increase('skill', weapon.skill_bonus);
                    this.attacks = [];
                    this.attacks.push(new GBE.Attack(weapon));
                }
                else
                    console.log("Already using a similar weapon");
            };

        },
        Monster: function(body) {
            this.type = body.match(/{monster\s*:\s*(.*?)\s*,/i)[1];
            this.count = parseInt(body.match(/{.*?count\s*:\s*(\d+).*?}/i)[1]);
            this.maxes = {};
            this.stamina = this.maxes.stamina = parseInt(body.match(/{.*?stamina\s*:\s*(\d+).*?}/i)[1]);
            this.skill = this.maxes.skill = parseInt(body.match(/{.*?skill\s*:\s*(\d+).*?}/i)[1]);
            this.attacks = [];
            this.treasures = [];
            this.artefacts = [];
            this.outcomes = [];
            this.specialAttacks = [];

            // Handle any internal elements
            var internal = body.match(/{monster\s*:.*?\s*}\s*(.*?)\s*{\/monster\s*}/i);
            var configs = internal[1].match(/{\s*(.*?)\s*:\s*(.*?)}/ig);
            _.each(configs, _.bind(function(config) {

                // Extract the type
                var type = config.match(/{\s*(\w+)[^}].*?}/i)[1];
                console.log("processing config type", type);

                // Key Objects
                if(type.match(/SpecialAttack/i)) {
                    console.log("Detected a special attack", config);
                    this.specialAttacks.push(new GBE.SpecialAttack(config));
                }
                else if(type.match(/attack/i)) {
                    this.attacks.push(new GBE.Attack(config, this.type));
                }
                else if(type.match(/treasure/i)) {
                    this.treasures.push(new GBE.Treasure(config));
                }
                else if(type.match(/artefact/i)) {
                    this.artefacts.push(new GBE.Artefact(config));
                }
                else if(type.match(/damage/i)) {
                    this.specialAttacks[this.specialAttacks.length - 1].addDamageRule(config);
                }
                else
                    console.log("Unsupported monster configuration type: ", type);
            }, this));

            this.value = function(key) {
                return this[key];
            };

            this.max = function(key) {
                return this.maxes[key];
            };

            this.ratio = function(key) {
                return this.value(key) / this.max(key) * 100;
            };

            this.increase = function(key, val) {
                this[key] += val;
            };

            this.decrease = function(key, val) {
                this[key] -= val;
            };

            this.appendDetails = function(data) {
                _.extend(this, data);
            };

            this.label = function() {
                return this.type.toLowerCase();
            };

            this.act = function(target) {
                var defer = Q.defer();
                setTimeout(_.bind(function() {

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
                this.stamina -= dmg;
                return this.stamina;
            };

            this.hasSpecialAttacks = function() {
                return this.specialAttacks.length > 0;
            };

            this.applySpecialAttacks = function(heroe) {
                var result = [];

                _.each(this.specialAttacks,function(a) {
                    result.push(a.inflictDamage(heroe));
                });

                return result;
            };

        },
        Attack:function(config) {
            if(config) {
                this.name = config.name;
                this.key = config.key;
            }
            this.heroe_roll = 0;
            this.target_roll = 0;

            this.describe = function() {
                var str = "Your attack roll is "+this.heroe_roll+". Your target roll is "+this.target_roll;

                if(this.heroe_roll > this.target_roll) {
                    str += ". You inflict 2 damage";
                }
                else if(this.target_roll > this.heroe_roll) {
                    str += ". You loose 2 stamina point";
                }
                else
                    str += ". You both avoided your attacks";

                return str;
            };

            this.applyOn = function(heroe, target) {
                var outcome = {};

                this.heroe_roll = GBE.Tools.rollDices(2, 6) + heroe.value('skill');
                this.target_roll = GBE.Tools.rollDices(2, 6) + target.value('skill');
                this.target = target;

                if(this.heroe_roll > this.target_roll) {
                    console.log("target has lost");
                    target.decrease('stamina', 2);
                    this.applyLuck = function(lucky) {
                        console.log("applying luck result", lucky);
                        if(lucky) {
                            target.decrease('stamina',1);

                            if(target.value('stamina') <= 0) {
                                return {
                                    outcome: 'TARGET_DEAD',
                                    msg:"You were lucky and inflicted 1 additional point to your ennemy"
                                }
                            }
                            else {
                                return {
                                    outcome: 'NEXT_ACTION',
                                    msg:"You were lucky and inflicted 1 additional point to your ennemy"
                                }
                            }
                        }
                        else {
                            target.increase('stamina',1);
                            return {
                                msg:"You were unlucky. Your blow was less effective!",
                                outcome:'NEXT_ACTION'
                            };
                        }
                    };
                }
                else if(this.heroe_roll < this.target_roll) {
                    console.log("heroe has lost");

                    if(target.hasSpecialAttacks()) {
                        console.log("Applying special attack effect");

                        var results = target.applySpecialAttacks(heroe);

                        //NOTE: We support a single special attack right now
                        if(results.length > 0)
                            outcome = results[0];

                        this.applyLuck = function(lucky) {
                            console.log("applying luck result", lucky);
                            if(lucky) {
                                heroe.increase('stamina',1);
                                return {
                                    outcome:'NEXT_ACTION',
                                    msg:"You were lucky. Your ennemy blow was nearly avoided"
                                }
                            }
                            else {
                                heroe.decrease('stamina',1);
                                if(heroe.value('stamina') <= 0) {
                                    return {
                                        outcome: 'HEROE_DEAD',
                                        msg:"You were unlucky. Your ennemy blow was more powerful!"
                                    }
                                }
                                else {
                                    return {
                                        outcome: 'NEXT_ACTION',
                                        msg:"You were unlucky. Your ennemy blow was more powerful!"
                                    }
                                }
                            }
                        };
                    }
                    else {
                        heroe.decrease('stamina', 2);
                        this.applyLuck = function(lucky) {
                            console.log("applying luck result", lucky);
                            if(lucky) {
                                heroe.increase('stamina',1);
                                return {
                                    outcome:'NEXT_ACTION',
                                    msg:"You were lucky. Your ennemy blow was nearly avoided"
                                }
                            }
                            else {
                                heroe.decrease('stamina',1);
                                if(heroe.value('stamina') <= 0) {
                                    return {
                                        outcome: 'HEROE_DEAD',
                                        msg:"You were unlucky. Your ennemy blow was more powerful!"
                                    }
                                }
                                else {
                                    return {
                                        outcome: 'NEXT_ACTION',
                                        msg:"You were unlucky. Your ennemy blow was more powerful!"
                                    }
                                }
                            }
                        };
                    }

                }

                // if we haven't already determine an outcome (special attack)
                if(!outcome.outcome) {
                    // Apply to target
                    if(target.value('stamina') <= 0) {
                        // This target is dead, let's report it
                        outcome.outcome = "TARGET_DEAD";
                    }
                    else {
                        if(heroe.value('stamina') <= 0) {
                            outcome.outcome = "HEROE_DEAD";
                        }
                        else
                            outcome.outcome = "NEXT_ACTION";
                    }
                }

                return outcome;
            };

        },
        Spell: function(body, performer) {
            if(_.isObject(body)){
                _.extend(this, body);
            }

            this.describe = function(){
                if(performer){
                    return performer + "casts a "+this.name+" spell";
                }
                else
                    return "You cast a "+this.name+" spell";
            };

            this.applyOn = function(target) {
                return "NEXT_ACTION";
            }

        },
        Treasure:function(body) {
            this.items = [];

            function match(type) {
                var regex = new RegExp("{treasure:.*?"+type+":\\s*([^,\\s]+)", "i");
                var p = body.match(regex);
                if(p)
                    return GBE.Tools.roll(p[1]);
                return 0;
            }

            var golds = match('gold');
            if(golds > 0)
                this.items.push({key: 'gold_coin', name:'Golds', value:golds});
            var gems = match('gems');
            if(gems > 0)
                this.items.push({key: 'gem', name:'Gems', value:gems});

            var p = body.match(/{treasure:.*?item:\s*"(.*?)":(\d+)/i);
            while(p != null) {
                this.items.push(new GBE.Artefact({description:p[1], value:parseInt(p[2])}));
                body = body.replace(p[0], "");
                p = body.match(/{treasure:.*?item:\s*"(.*?)":(\d+)/i);
            }

        },
        Artefact:function(data) {
            if(_.isString(data)) {

            }
            else {
                this.description = data.description;
                this.value = data.value;
            }
        },
        Tools: {
            roll: function(range) {

                if(_.isString(range)) {

                    if(range.indexOf('-') != -1) {
                        var factors = range.match(/\s*(\d+)\s*-\s*(\d+)\s*/);
                        return Math.round(Math.random() * parseInt(factors[2] - factors[1]) + parseInt(factors[1]));
                    }
                    else {
                        return parseInt(range);
                    }
                }
                else
                    return range;
            },
            rollDices: function(count, sides) {
                var total = 0;
                for(var i=0; i<count; i++) {
                    total += Math.round(Math.random() * (sides-1) + 1);
                }
                console.log("Rolled %dd%d. Total=", count, sides, total);
                return total;
            },
            within: function(roll, range) {
                var idx = range.indexOf('-');
                var low = parseInt(range.substring(0, idx));
                var high = parseInt(range.substring(idx+1));
                return roll >= low && roll <= high;
            }
        }
    };

})(window);
