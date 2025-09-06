const gigEvents = require("./gigEvents.js");

module.exports = () => {
    const events = gigEvents || [];

    // year -> events[]
    const grouped = new Map();
    for (const ev of events) {
        if (!grouped.has(ev.year)) grouped.set(ev.year, []);
        grouped.get(ev.year).push(ev);
    }

    const years = Array.from(grouped.keys()).sort((a, b) => b - a);

    const groups = years.map(year => {
        const items = grouped.get(year);
        const count = items.length;
        const photoCount = items.reduce((acc, ev) => acc + (ev.count || 0), 0);

        return { year, items, count, photoCount };
    });

    return { events, groups, years };
};
