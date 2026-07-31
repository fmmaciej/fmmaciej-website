const eventEvents = require("./eventEvents.js");
const eventUpcomingEvents = require("./eventUpcomingEvents.js");

module.exports = [
    ...(Array.isArray(eventUpcomingEvents) ? eventUpcomingEvents : []),
    ...(Array.isArray(eventEvents) ? eventEvents : [])
];
