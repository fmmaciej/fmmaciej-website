const catalog = require("./music/events.json");
const buildEvents = require("../_lib/music/buildEvents.js");

const events = buildEvents(catalog);
const upcoming = events
    .filter((event) => event.section === "upcoming")
    .sort((left, right) => left.date.localeCompare(right.date));
const archive = events
    .filter((event) => event.section === "archive")
    .sort((left, right) => right.date.localeCompare(left.date));

const grouped = new Map();
for (const event of archive) {
    if (!grouped.has(event.year)) grouped.set(event.year, []);
    grouped.get(event.year).push(event);
}

const years = Array.from(grouped.keys()).sort((left, right) => right - left);
const groups = years.map((year) => {
    const items = grouped.get(year);

    return {
        year,
        name: String(year),
        slug: `y-${year}`,
        items,
        count: items.length,
        mediaCount: items.reduce((total, event) => total + (event.count || 0), 0)
    };
});

const decadesByYear = new Map();
for (const group of groups) {
    const decade = Math.floor(group.year / 10) * 10;
    if (!decadesByYear.has(decade)) decadesByYear.set(decade, []);
    decadesByYear.get(decade).push(group);
}

const decades = Array.from(decadesByYear.keys())
    .sort((left, right) => right - left)
    .map((decade) => {
        const yearGroups = decadesByYear.get(decade);

        return {
            decade,
            name: `${decade}s`,
            slug: `d-${decade}`,
            years: yearGroups,
            count: yearGroups.reduce((total, group) => total + group.count, 0),
            mediaCount: yearGroups.reduce((total, group) => total + group.mediaCount, 0)
        };
    });

module.exports = {
    all: [...upcoming, ...archive],
    upcoming,
    archive,
    groups,
    years,
    decades
};
