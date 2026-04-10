const gigEvents = require("./gigEvents.js");

module.exports = () => {
    const events = gigEvents || [];

    const grouped = new Map();
    for (const ev of events) {
        if (!grouped.has(ev.year)) grouped.set(ev.year, []);
        grouped.get(ev.year).push(ev);
    }

    const years = Array.from(grouped.keys()).sort((a, b) => b - a);

    const groups = years.map((year) => {
        const items = grouped.get(year);
        const count = items.length;
        const photoCount = items.reduce((acc, ev) => acc + (ev.count || 0), 0);

        return {
            year,
            name: String(year),
            slug: `y-${year}`,
            items,
            count,
            photoCount
        };
    });

    const decadesByYear = new Map();
    for (const group of groups) {
        const decade = Math.floor(group.year / 10) * 10;
        if (!decadesByYear.has(decade)) decadesByYear.set(decade, []);
        decadesByYear.get(decade).push(group);
    }

    const decades = Array.from(decadesByYear.keys())
        .sort((a, b) => b - a)
        .map((decade) => {
            const yearGroups = decadesByYear.get(decade) || [];
            return {
                decade,
                name: `${decade}s`,
                slug: `d-${decade}`,
                years: yearGroups,
                count: yearGroups.reduce((acc, yearGroup) => acc + (yearGroup.count || 0), 0),
                photoCount: yearGroups.reduce((acc, yearGroup) => acc + (yearGroup.photoCount || 0), 0)
            };
        });

    return { events, groups, years, decades };
};
