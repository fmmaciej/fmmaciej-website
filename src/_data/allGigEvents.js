const gigEvents = require("./gigEvents.js");
const gigUpcomingEvents = require("./gigUpcomingEvents.js");

module.exports = [
    ...(Array.isArray(gigUpcomingEvents) ? gigUpcomingEvents : []),
    ...(Array.isArray(gigEvents) ? gigEvents : [])
];
