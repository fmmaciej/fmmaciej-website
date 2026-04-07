const rawMixesUpcoming = require("./music/mixes_upcoming.json");
const mixImagePresets = require("../_lib/music/mixImagePresets.js");

function buildMixImage(item) {
    if (item?.img) {
        return item.img;
    }

    if (!item?.imagePreset) {
        return null;
    }

    const preset = mixImagePresets?.[item.imagePreset];
    if (!preset) {
        return null;
    }

    return preset.variants?.["960"] || preset.variants?.["480"] || null;
}

function buildMixAlt(item) {
    if (item?.alt) {
        return item.alt;
    }

    if (item?.imagePreset && mixImagePresets?.[item.imagePreset]?.alt) {
        return mixImagePresets[item.imagePreset].alt;
    }

    return item?.title || "Upcoming mix";
}

module.exports = (() => {
    const defaultItem = Array.isArray(rawMixesUpcoming)
        ? rawMixesUpcoming.find((item) => item?.title === "__default__")
        : null;

    const defaults = {
        imagePreset: defaultItem?.imagePreset || "upcoming-default"
    };

    const items = Array.isArray(rawMixesUpcoming)
        ? rawMixesUpcoming
            .filter((item) => item?.title !== "__default__")
            .map((item) => {
                const merged = {
                    ...defaults,
                    ...item
                };

                return {
                    ...merged,
                    img: buildMixImage(merged),
                    alt: buildMixAlt(merged)
                };
            })
        : [];

    return { items, defaults };
})();
