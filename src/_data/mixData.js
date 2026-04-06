const mixes = require("./mixes.json");
const mixesTba = require("./mixesTba.js");

function parseMixDate(value) {
    if (!value || typeof value !== "string") return Number.NEGATIVE_INFINITY;

    const normalized = value.trim();
    if (!normalized) return Number.NEGATIVE_INFINITY;

    if (normalized.includes(" - ")) {
        return normalized
            .split(/\s+-\s+/)
            .map(parseMixDate)
            .reduce((latest, current) => Math.max(latest, current), Number.NEGATIVE_INFINITY);
    }

    let match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        return Date.UTC(Number(year), Number(month) - 1, Number(day));
    }

    match = normalized.match(/^(\d{2})\.(\d{4})$/);
    if (match) {
        const [, month, year] = match;
        return Date.UTC(Number(year), Number(month) - 1, 1);
    }

    match = normalized.match(/^(\d{4})$/);
    if (match) {
        const [, year] = match;
        return Date.UTC(Number(year), 0, 1);
    }

    const fallback = Date.parse(normalized);
    return Number.isNaN(fallback) ? Number.NEGATIVE_INFINITY : fallback;
}

function groupSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

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
