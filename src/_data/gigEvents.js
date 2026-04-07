const gigMedia = require("./music/gig_media.json");
const rawGigsArchive = require("./music/gigs_archive.json");
const buildGigEvents = require("../_lib/music/buildGigEvents.js");

function normalizeEventName(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

const archiveByKey = new Map(
    (Array.isArray(rawGigsArchive) ? rawGigsArchive : [])
        .map((item) => {
            const date = item?.date?.date || null;
            const event = item?.event || null;
            return [date && event ? `${date}::${normalizeEventName(event)}` : null, item];
        })
        .filter(([key]) => key)
);

const archivePhotos = (Array.isArray(gigMedia) ? gigMedia : [])
    .filter((item) => item.kind === "archive")
    .map((item) => {
        const date = item?.date?.date || null;
        const event = item?.event || null;
        const key = date && event ? `${date}::${normalizeEventName(event)}` : null;
        const archive = key ? archiveByKey.get(key) : null;

        if (!archive) return null;

        return {
            ...item,
            place: archive.place ?? null,
            coverId: archive.coverId ?? null
        };
    })
    .filter(Boolean);

module.exports = buildGigEvents(archivePhotos, {
    section: "archive",
    pathPrefix: "/music/gigs"
});
