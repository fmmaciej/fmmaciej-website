const rawGigsUpcoming = require("./music/gigs_upcoming.json");
const rawGigMedia = require("./music/gig_media.json");
const buildGigEvents = require("../_lib/music/buildGigEvents.js");

const defaultItem = (Array.isArray(rawGigsUpcoming) ? rawGigsUpcoming : []).find((item) => item?.event === "__default__") || {};

const defaultUpcoming = {
    imagePreset: defaultItem.imagePreset || "upcoming-default"
};

const posterById = new Map(
    (Array.isArray(rawGigMedia) ? rawGigMedia : [])
        .filter((item) => item.kind === "upcoming")
        .filter((item) => item?.image?.id)
        .map((item) => [item.image.id, item])
);

const upcomingWithPosters = (Array.isArray(rawGigsUpcoming) ? rawGigsUpcoming : [])
    .filter((item) => item?.event !== "__default__")
    .map((item) => {
        const merged = {
            ...defaultUpcoming,
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

module.exports = buildGigEvents(upcomingWithPosters, {
    section: "upcoming",
    listHref: "/music/gigs#upcoming",
    listLabel: "Upcoming",
    pathPrefix: "/music/gigs/upcoming",
    sortOrder: "asc"
});
