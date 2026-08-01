const catalog = require("./music/mixes.json");
const buildMixData = require("../_lib/music/buildMixData.js");

module.exports = buildMixData(catalog);
