const eventImagePresets = require("./eventImagePresets.js");
const { resolveMedia, resolvePreset } = require("./mediaCatalog.js");

function urlSlug(slug) {
  return String(slug || "event").replace(/_/g, "-");
}

module.exports = function buildEvents(catalog) {
  const mediaById = new Map((catalog.media || []).map((media) => [media.id, media]));
  const mediaByGroup = new Map();

  for (const media of catalog.media || []) {
    if (!mediaByGroup.has(media.groupId)) mediaByGroup.set(media.groupId, []);
    mediaByGroup.get(media.groupId).push(media);
  }

  return (catalog.items || []).map((item) => {
    const eventMedia = (mediaByGroup.get(item.id) || [])
      .sort((left, right) => left.seq - right.seq)
      .map((media) => resolveMedia(media, "events", `${item.title} #${media.seq}`));
    const coverMedia = mediaById.get(item.coverId);
    const fallback = resolvePreset(
      eventImagePresets[catalog.defaults?.imagePreset || "upcoming-default"],
      item.title
    );
    const cover = coverMedia
      ? resolveMedia(coverMedia, "events", item.title)
      : fallback;
    const year = Number(item.date.slice(0, 4));

    return {
      ...item,
      name: item.title,
      year,
      count: eventMedia.length,
      items: eventMedia.length ? eventMedia : [{ ...fallback, date: item.date, seq: null, fallback: true }],
      cover,
      listHref: item.section === "upcoming" ? "/music/events/#upcoming" : `/music/events/#y-${year}`,
      listLabel: item.section === "upcoming" ? "Upcoming" : String(year),
      path: `/music/events/${item.date}-${urlSlug(item.slug)}/`
    };
  });
};
