const mixesArchive = require("./music/mixes_archive.json");
const mixesUpcoming = require("./mixesUpcoming.js");
const parseMixDate = require("../_lib/music/parseMixDate.js");
const groupSlug = require("../_lib/music/groupSlug.js");

module.exports = () => {
    const archiveItems = Array.isArray(mixesArchive?.items) ? mixesArchive.items : [];
    const upcomingItems = Array.isArray(mixesUpcoming?.items)
        ? [...mixesUpcoming.items].sort((a, b) => parseMixDate(a?.date) - parseMixDate(b?.date))
        : [];
    const latestItems = [...archiveItems]
        .sort((a, b) => parseMixDate(b?.date) - parseMixDate(a?.date))
        .slice(0, 5);

    const groupNames = Array.isArray(mixesArchive?.groups) && mixesArchive.groups.length
        ? mixesArchive.groups
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
        archive: mixesArchive || { groups: [], items: [] },
        upcoming: mixesUpcoming || { items: [], defaults: {} },
        upcomingGroup: { name: "Upcoming", slug: "upcoming" },
        latestGroup: { name: "Latest", slug: "latest" }
    };
};
