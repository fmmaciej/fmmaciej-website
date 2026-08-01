const groupSlug = require("./groupSlug.js");
const mixImagePresets = require("./mixImagePresets.js");
const { resolveMedia, resolvePreset } = require("./mediaCatalog.js");

function displayDate(item) {
  if (item.dateEnd) return `${item.date}–${item.dateEnd}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    return `${item.date.slice(8, 10)}.${item.date.slice(5, 7)}.${item.date.slice(0, 4)}`;
  }
  if (/^\d{4}-\d{2}$/.test(item.date)) {
    return `${item.date.slice(5, 7)}.${item.date.slice(0, 4)}`;
  }
  return item.date;
}

module.exports = function buildMixData(catalog) {
  const mediaById = new Map((catalog.media || []).map((media) => [media.id, media]));
  const fallback = resolvePreset(mixImagePresets[catalog.defaults?.imagePreset || "upcoming-default"]);
  const items = (catalog.items || []).map((item) => {
    const image = item.imageId ? resolveMedia(mediaById.get(item.imageId), "mixes", item.title) : null;
    return {
      ...item,
      displayDate: displayDate(item),
      img: image?.thumb960 || (item.status === "planned" ? fallback.thumb960 : null),
      alt: image?.alt || (item.status === "planned" ? fallback.alt : item.title)
    };
  });
  const archiveItems = items.filter((item) => item.status === "published");
  const upcomingItems = items
    .filter((item) => item.status === "planned")
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestItems = [...archiveItems]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const platformOrder = catalog.defaults?.platformOrder || ["YouTube", "Mixcloud", "SoundCloud", "Other"];
  const groups = platformOrder
    .map((name) => ({
      name,
      slug: groupSlug(name),
      items: archiveItems.filter((item) => (item.platform || "Other") === name)
    }))
    .filter((group) => group.items.length);

  return {
    archiveItems,
    latestItems,
    upcomingItems,
    groups,
    upcomingGroup: { name: "Planned", slug: "planned" },
    latestGroup: { name: "Latest", slug: "latest" }
  };
};
