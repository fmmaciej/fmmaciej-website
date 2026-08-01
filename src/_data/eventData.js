const catalog = require("./music/events.json");
const buildEventData = require("../_lib/music/buildEventData.js");

module.exports = buildEventData(catalog);
