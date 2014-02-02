var util = require('util'),
    colors = require('colors');

module.exports = function(err) {
    console.log(util.format("Unable to build gamebook. %s".red, err));
};
