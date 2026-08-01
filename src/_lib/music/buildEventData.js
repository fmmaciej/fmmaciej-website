const eventImagePresets = require("./eventImagePresets.js");
const { resolveMedia, resolvePreset } = require("./mediaCatalog.js");

function urlSlug(slug) {
  return String(slug || "event").replace(/_/g, "-");
}

module.exports = function buildEventData(catalog) {
  const mediaById = new Map((catalog.media || []).map((media) => [media.id, media]));
  const mediaByGroup = new Map();

  for (const media of catalog.media || []) {
    if (!mediaByGroup.has(media.groupId)) mediaByGroup.set(media.groupId, []);
    mediaByGroup.get(media.groupId).push(media);
  }

  const events = (catalog.items || []).map((item) => {
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

  const upcoming = events
    .filter((event) => event.section === "upcoming")
    .sort((left, right) => left.date.localeCompare(right.date));
  const archive = events
    .filter((event) => event.section === "archive")
    .sort((left, right) => right.date.localeCompare(left.date));

  const grouped = new Map();
  for (const event of archive) {
    if (!grouped.has(event.year)) grouped.set(event.year, []);
    grouped.get(event.year).push(event);
  }

  const years = Array.from(grouped.keys()).sort((left, right) => right - left);
  const groups = years.map((year) => {
    const items = grouped.get(year);

    return {
      year,
      name: String(year),
      slug: `y-${year}`,
      items,
      count: items.length,
      mediaCount: items.reduce((total, event) => total + (event.count || 0), 0)
    };
  });

  const decadesByYear = new Map();
  for (const group of groups) {
    const decade = Math.floor(group.year / 10) * 10;
    if (!decadesByYear.has(decade)) decadesByYear.set(decade, []);
    decadesByYear.get(decade).push(group);
  }

  const decades = Array.from(decadesByYear.keys())
    .sort((left, right) => right - left)
    .map((decade) => {
      const yearGroups = decadesByYear.get(decade);

      return {
        decade,
        name: `${decade}s`,
        slug: `d-${decade}`,
        years: yearGroups,
        count: yearGroups.reduce((total, group) => total + group.count, 0),
        mediaCount: yearGroups.reduce((total, group) => total + group.mediaCount, 0)
      };
    });

  return {
    all: [...upcoming, ...archive],
    upcoming,
    archive,
    groups,
    years,
    decades
  };
};
