const catalog = require("./music/events.json");
const buildEvents = require("../_lib/music/buildEvents.js");

module.exports = buildEvents(catalog)
  .filter((event) => event.section === "upcoming")
  .sort((left, right) => left.date.localeCompare(right.date));
