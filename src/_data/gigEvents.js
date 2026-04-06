const rawGigs = require("./gigs.json");
const buildGigEvents = require("./buildGigEvents.js");

module.exports = buildGigEvents(rawGigs, {
    section: "archive",
    pathPrefix: "/music/gigs"
});
