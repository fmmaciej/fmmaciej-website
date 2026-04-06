const rawMixesTba = require("./music/mixes_tba.json");
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
    const items = Array.isArray(rawMixesTba)
        ? rawMixesTba.map((item) => ({
            ...item,
            img: buildMixImage(item),
            alt: buildMixAlt(item)
        }))
        : [];

    return { items };
})();
