const rawGigsTba = require("./gigs_tba.json");
const buildGigEvents = require("./buildGigEvents.js");

module.exports = buildGigEvents(rawGigsTba, {
    section: "tba",
    listHref: "/music/gigs#tba",
    listLabel: "To Be Announced",
    pathPrefix: "/music/gigs/tba"
});
