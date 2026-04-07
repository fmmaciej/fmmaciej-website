const gigImagePresets = require("./gigImagePresets.js");

const GIG_IMAGE_PREFIX = "/assets/music/gigs/_images/";

function slugify(s) {
    return (s || "event")
        .toLowerCase()
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function toIsoDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    if (typeof value === "string" && /^\d{8}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }

    if (value && typeof value === "object") {
        if (typeof value.date === "string" && /^\d{8}$/.test(value.date)) {
            return `${value.date.slice(0, 4)}-${value.date.slice(4, 6)}-${value.date.slice(6, 8)}`;
        }

        if (value.year && value.month && value.day) {
            return `${value.year}-${pad2(value.month)}-${pad2(value.day)}`;
        }
    }

    return null;
}

function toImageUrl(relativePath, prefix = GIG_IMAGE_PREFIX) {
    if (!relativePath) return null;
    if (/^(?:https?:)?\//.test(relativePath)) return relativePath;
    return `${prefix}${relativePath}`;
}

function pickVariantUrl(variants, size, prefix = GIG_IMAGE_PREFIX) {
    return toImageUrl(variants?.[String(size)], prefix);
}

function resolveImageFromPreset(presetKey, fallbackAlt) {
    const preset = gigImagePresets?.[presetKey];
    if (!preset) return null;

    const prefix = preset.prefix || GIG_IMAGE_PREFIX;
    const thumb = pickVariantUrl(preset.variants, preset.thumb || 480, prefix)
        || toImageUrl(preset.thumb, prefix)
        || toImageUrl(preset.src, prefix);
    const thumb480 = pickVariantUrl(preset.variants, 480, prefix) || thumb;
    const thumb960 = pickVariantUrl(preset.variants, 960, prefix) || thumb || thumb480;
    const display1600 = pickVariantUrl(preset.variants, 1600, prefix)
        || toImageUrl(preset.display, prefix)
        || toImageUrl(preset.src, prefix)
        || thumb960
        || thumb480;

    return {
        rel: presetKey,
        src: display1600 || thumb960 || thumb480,
        thumb,
        thumb480,
        thumb960,
        display1600,
        thumb_w: preset.width || preset.thumb_w || 480,
        thumb_h: preset.height || preset.thumb_h || 300,
        alt: preset.alt || fallbackAlt
    };
}

function parseImageId(value) {
    if (typeof value !== "string") return null;

    const match = value.match(/^(\d{8})_(.+?)(?:_(\d+))?$/);
    if (!match) return null;

    return {
        date: match[1],
        name: match[2] || null,
        seq: match[3] ? Number(match[3]) : null
    };
}

function buildAltText(name, date, seq) {
    const parts = [name || "Gig"];
    if (date) parts.push(date);
    if (seq) parts.push(`#${seq}`);
    return parts.join(" ");
}

function resolveDateParts(item, isoDate) {
    const objectDate = item.date && typeof item.date === "object" ? item.date : null;

    return {
        year: item.year ?? objectDate?.year ?? Number(isoDate?.slice(0, 4)),
        month: item.month ?? objectDate?.month ?? Number(isoDate?.slice(5, 7)),
        day: item.day ?? objectDate?.day ?? Number(isoDate?.slice(8, 10))
    };
}

function normalizeGigItem(item) {
    const parsedImageId = parseImageId(item.image?.id || item.rel);
    const isoDate = toIsoDate(item.date) || toIsoDate(parsedImageId?.date);
    const name = item.name || item.event || parsedImageId?.name || null;
    const seq = item.seq ?? parsedImageId?.seq ?? 1;
    const dateParts = resolveDateParts(item, isoDate);
    const fallbackAlt = item.alt || buildAltText(name, isoDate, seq);

    if (item.imagePreset && !item.image) {
        const presetImage = resolveImageFromPreset(item.imagePreset, fallbackAlt);

        return {
            ...item,
            date: isoDate,
            year: dateParts.year,
            month: dateParts.month,
            day: dateParts.day,
            name,
            seq,
            rel: presetImage?.rel || item.imagePreset,
            src: presetImage?.src || null,
            thumb: presetImage?.thumb || null,
            thumb480: presetImage?.thumb480 || null,
            thumb960: presetImage?.thumb960 || null,
            display1600: presetImage?.display1600 || null,
            thumb_w: presetImage?.thumb_w || 480,
            thumb_h: presetImage?.thumb_h || 300,
            alt: presetImage?.alt || fallbackAlt
        };
    }

    if (item.image) {
        const thumb = pickVariantUrl(item.image.variants, item.image.thumb || 480);
        const thumb480 = pickVariantUrl(item.image.variants, 480) || thumb;
        const thumb960 = pickVariantUrl(item.image.variants, 960) || thumb || thumb480;
        const display1600 = pickVariantUrl(item.image.variants, 1600)
            || pickVariantUrl(item.image.variants, item.image.display || 1600)
            || thumb960
            || thumb480;

        return {
            ...item,
            date: isoDate,
            year: dateParts.year,
            month: dateParts.month,
            day: dateParts.day,
            name,
            seq,
            rel: item.image.id || item.rel,
            src: display1600 || thumb960 || thumb480,
            thumb,
            thumb480,
            thumb960,
            display1600,
            thumb_w: item.image.thumb_w || item.thumb_w || 480,
            thumb_h: item.image.thumb_h || item.thumb_h || 300,
            alt: fallbackAlt
        };
    }

    return {
        ...item,
        date: isoDate,
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        name,
        seq,
        src: item.src || item.display1600 || item.thumb960 || item.thumb480 || item.thumb || null,
        alt: fallbackAlt
    };
}

module.exports = function buildGigEvents(rawGigs, options = {}) {
    const {
        section = "archive",
        listHref = null,
        listLabel = null,
        pathPrefix = "/music/gigs",
        sortOrder = "desc"
    } = options;

    const gigs = Array.isArray(rawGigs) ? rawGigs.map(normalizeGigItem) : [];
    const byKey = new Map();

    for (const it of gigs) {
        if (!it.date) continue;

        const year = it.year;
        const date = it.date;
        const name = it.name || null;
        const slug = name ? slugify(name) : null;
        const key = name ? `${date}-${slug}` : `${date}`;

        if (!byKey.has(key)) {
            byKey.set(key, {
                key,
                year,
                date,
                name,
                slug: slug || null,
                items: []
            });
        }

        byKey.get(key).items.push(it);
    }

    return Array.from(byKey.values())
        .map((ev) => {
            ev.items.sort((a, b) => {
                const seqOrder = (a.seq ?? 1) - (b.seq ?? 1);
                if (seqOrder !== 0) return seqOrder;
                return String(a.rel || a.src || "").localeCompare(String(b.rel || b.src || ""));
            });

            const cover = ev.items.find((item) => (item.seq ?? 1) === 1) || ev.items[0];
            ev.cover = {
                src: cover.src,
                thumb480: cover.thumb480 || cover.thumb || cover.src,
                thumb960: cover.thumb960 || cover.src,
                w: cover.thumb_w || 480,
                h: cover.thumb_h || 300,
                alt: cover.alt
            };
            ev.count = ev.items.length;
            ev.place = ev.items.find((item) => item.place)?.place || null;
            ev.section = section;
            ev.listHref = listHref || `/music/gigs#y-${ev.year}`;
            ev.listLabel = listLabel || String(ev.year);
            ev.path = `${pathPrefix}/${ev.key}/`;

            return ev;
        })
        .sort((a, b) => {
            if (a.date === b.date) return 0;

            if (sortOrder === "asc") {
                return a.date < b.date ? -1 : 1;
            }

            return a.date < b.date ? 1 : -1;
        });
};
