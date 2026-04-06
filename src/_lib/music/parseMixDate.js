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

module.exports = parseMixDate;
