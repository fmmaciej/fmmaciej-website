const mixes = require("./music/mixes.json");
const mixesTba = require("./mixesTba.js");
const parseMixDate = require("../_lib/music/parseMixDate.js");
const groupSlug = require("../_lib/music/groupSlug.js");

module.exports = () => {
    const archiveItems = Array.isArray(mixes?.items) ? mixes.items : [];
    const upcomingItems = Array.isArray(mixesTba?.items)
        ? [...mixesTba.items].sort((a, b) => parseMixDate(a?.date) - parseMixDate(b?.date))
        : [];
    const latestItems = [...archiveItems]
        .sort((a, b) => parseMixDate(b?.date) - parseMixDate(a?.date))
        .slice(0, 5);

    const groupNames = Array.isArray(mixes?.groups) && mixes.groups.length
        ? mixes.groups
        : Array.from(new Set(archiveItems.map((item) => (item.group || "Other").trim())));

    const groups = groupNames
        .map((name) => ({
            name,
            slug: groupSlug(name),
            items: archiveItems.filter((item) => ((item.group || "Other").trim().toLowerCase() === name.trim().toLowerCase()))
        }))
        .filter((group) => group.items.length);

    return {
        archiveItems,
        latestItems,
        upcomingItems,
        groups,
        upcomingGroup: { name: "Upcoming", slug: "upcoming" },
        latestGroup: { name: "Latest", slug: "latest" }
    };
};
