const rawGigsTba = require("./music/gigs_tba.json");
const rawGigMedia = require("./music/gig_media.json");
const buildGigEvents = require("../_lib/music/buildGigEvents.js");

const defaultItem = (Array.isArray(rawGigsTba) ? rawGigsTba : []).find((item) => item?.event === "__default__") || {};

const defaultTba = {
    imagePreset: defaultItem.imagePreset || "tba-default"
};

const posterById = new Map(
    (Array.isArray(rawGigMedia) ? rawGigMedia : [])
        .filter((item) => item.kind === "tba")
        .filter((item) => item?.image?.id)
        .map((item) => [item.image.id, item])
);

const tbaWithPosters = (Array.isArray(rawGigsTba) ? rawGigsTba : [])
    .filter((item) => item?.event !== "__default__")
    .map((item) => {
    const merged = {
        ...defaultTba,
        ...item
    };

    if (!merged.coverId) return merged;

    const poster = posterById.get(merged.coverId);
    if (!poster?.image) return merged;

    return {
        ...merged,
        image: poster.image
    };
});

module.exports = buildGigEvents(tbaWithPosters, {
    section: "tba",
    listHref: "/music/gigs#tba",
    listLabel: "To Be Announced",
    pathPrefix: "/music/gigs/tba",
    sortOrder: "asc"
});
