const rawGigs = require("./gigs.json");
const buildGigEvents = require("../_lib/music/buildGigEvents.js");

module.exports = buildGigEvents(rawGigs, {
    section: "archive",
    pathPrefix: "/music/gigs"
});
