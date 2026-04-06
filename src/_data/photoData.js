const fs = require("fs");
const path = require("path");

function readPhotoItems() {
    const filePath = path.join(__dirname, "music", "photos.json");

    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return Array.isArray(raw) ? raw : [];
    } catch (_) {
        return [];
    }
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

function formatLabel(value, fallback = "Unknown") {
    if (!value || typeof value !== "string") {
        return fallback;
    }

    return value.replace(/-/g, " ");
}

function normalizeHandle(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    return value
        .trim()
        .replace(/^@+/, "")
        .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
        .replace(/\/+$/, "");
}

function normalizeUrl(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function toImageUrl(relativePath) {
    if (!relativePath) return null;
    if (/^(?:https?:)?\//.test(relativePath)) return relativePath;
    return `/assets/music/photos/_images/${relativePath}`;
}

function pickVariantUrl(variants, size) {
    return toImageUrl(variants?.[String(size)]);
}

function normalizePhotoItem(item) {
    const isoDate = toIsoDate(item?.date);
    const image = item?.image || {};
    const thumb480 = pickVariantUrl(image.variants, 480);
    const thumb960 = pickVariantUrl(image.variants, 960) || thumb480;
    const display1600 = pickVariantUrl(image.variants, 1600) || thumb960 || thumb480;
    const year = item?.date?.year ?? Number(isoDate?.slice(0, 4));
    const place = formatLabel(item?.place);
    const authorInfo = item?.author && typeof item.author === "object"
        ? item.author
        : { name: item?.author };
    const author = formatLabel(authorInfo?.name);
    const instagramHandle = normalizeHandle(authorInfo?.instagram);
    const facebookUrl = normalizeUrl(authorInfo?.facebook);
    const email = authorInfo?.email || null;

    return {
        date: isoDate,
        year,
        place,
        author,
        authorInfo: {
            name: author,
            instagram: instagramHandle ? {
                href: `https://instagram.com/${instagramHandle}`,
                label: `@${instagramHandle}`,
            } : null,
            facebook: facebookUrl ? {
                href: facebookUrl,
                label: facebookUrl.replace(/^https?:\/\/(?:www\.)?/i, ""),
            } : null,
            email: email ? {
                href: `mailto:${email}`,
                label: email,
            } : null,
        },
        seq: item?.seq ?? null,
        thumb480,
        thumb960,
        display1600,
        thumb_w: image.thumb_w || 480,
        thumb_h: image.thumb_h || 300,
        alt: `${place} ${isoDate || ""} ${author}`.trim()
    };
}

module.exports = () => {
    const items = readPhotoItems()
        .map(normalizePhotoItem)
        .filter((item) => item.date && item.thumb480)
        .sort((a, b) => {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            return (a.seq ?? 0) - (b.seq ?? 0);
        });

    const grouped = new Map();
    for (const item of items) {
        if (!grouped.has(item.year)) grouped.set(item.year, []);
        grouped.get(item.year).push(item);
    }

    const years = Array.from(grouped.keys()).sort((a, b) => b - a);
    const groups = years.map((year) => ({
        year,
        name: String(year),
        slug: `y-${year}`,
        items: grouped.get(year),
        count: grouped.get(year).length
    }));

    return { items, groups, years };
};
