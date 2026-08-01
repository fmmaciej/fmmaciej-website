const { resolveMedia } = require("./mediaCatalog.js");

function normalizeHandle(value) {
  if (!value || typeof value !== "string") return null;
  return value.trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
}

function normalizeUrl(value) {
  if (!value || typeof value !== "string") return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function authorInfo(author = {}) {
  const instagram = normalizeHandle(author.instagram);
  const facebook = normalizeUrl(author.facebook);
  return {
    name: author.name || null,
    instagram: instagram ? { href: `https://instagram.com/${instagram}`, label: `@${instagram}` } : null,
    facebook: facebook ? { href: facebook, label: facebook.replace(/^https?:\/\/(?:www\.)?/i, "") } : null,
    email: author.email ? { href: `mailto:${author.email}`, label: author.email } : null
  };
}

module.exports = function buildPhotoData(catalog) {
  const byGroup = new Map();
  for (const media of catalog.media || []) {
    if (!byGroup.has(media.groupId)) byGroup.set(media.groupId, []);
    byGroup.get(media.groupId).push(media);
  }

  const sets = (catalog.items || [])
    .map((item) => {
      const photos = (byGroup.get(item.id) || [])
        .sort((left, right) => left.seq - right.seq)
        .map((media) => resolveMedia(media, "photos", `${item.title} #${media.seq}`));
      return {
        ...item,
        year: Number(item.date.slice(0, 4)),
        authorInfo: authorInfo(item.author),
        photos,
        count: photos.length
      };
    })
    .filter((set) => set.count)
    .sort((left, right) => right.date.localeCompare(left.date));

  const grouped = new Map();
  for (const set of sets) {
    if (!grouped.has(set.year)) grouped.set(set.year, []);
    grouped.get(set.year).push(set);
  }

  const years = Array.from(grouped.keys()).sort((left, right) => right - left);
  const groups = years.map((year) => ({
    year,
    name: String(year),
    slug: `y-${year}`,
    items: grouped.get(year),
    count: grouped.get(year).length,
    photoCount: grouped.get(year).reduce((total, set) => total + set.count, 0)
  }));

  return { sets, groups, years };
};
