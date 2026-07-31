const catalog = require("./music/events.json");
const buildEvents = require("../_lib/music/buildEvents.js");

module.exports = buildEvents(catalog)
  .filter((event) => event.section === "archive")
  .sort((left, right) => right.date.localeCompare(left.date));
