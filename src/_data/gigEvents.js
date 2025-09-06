// src/_data/gigEvents.js
const gigs = require("./gigs.json");

// prościutki slug
function slugify(s) {
    return (s || "event")
        .toLowerCase()
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

module.exports = (() => {
    const byKey = new Map();
    for (const it of gigs) {
        const year = it.year;
        const date = it.date; // YYYY-MM-DD
        const name = it.name || null;
        const slug = name ? slugify(name) : null;

        const key = name ? `${date}-${slug}` : `${date}`; // unikalny identyfikator eventu

        if (!byKey.has(key)) {
        byKey.set(key, {
            key,            // "2025-03-01-void-club" lub "2025-03-01"
            year,           // 2025
            date,           // "2025-03-01"
            name,           // "Void Club" lub null
            slug: slug || null,
            items: []       // wszystkie zdjęcia tego eventu
        });
        }
        byKey.get(key).items.push(it);
    }

    // posortuj wewnątrz eventu po seq, a eventy po dacie malejąco
    const events = Array.from(byKey.values())
        .map(ev => {
        ev.items.sort((a,b) =>
            (a.seq||1) - (b.seq||1) || (a.src < b.src ? -1 : 1)
        );
        // cover: najczęściej seq==1; jeśli nie ma – pierwszy
        const cover = ev.items.find(x => (x.seq||1) === 1) || ev.items[0];
        ev.cover = {
            src: cover.src,
            thumb480: cover.thumb480 || cover.thumb || cover.src,
            thumb960: cover.thumb960 || cover.src,
            w: cover.thumb_w || 480,
            h: cover.thumb_h || 300,
            alt: cover.alt
        };
        ev.count = ev.items.length;
        return ev;
        })
        .sort((a,b) => (a.date < b.date ? 1 : -1));

    return events;
})();
