const gigEvents = require("./gigEvents.js");
const gigTbaEvents = require("./gigTbaEvents.js");

module.exports = [
    ...(Array.isArray(gigTbaEvents) ? gigTbaEvents : []),
    ...(Array.isArray(gigEvents) ? gigEvents : [])
];
