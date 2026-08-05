const buildEventData = require("./buildEventData.js");
const buildMixData = require("./buildMixData.js");
const buildPhotoData = require("./buildPhotoData.js");

const SITE_ORIGIN = "https://www.fmmaciej.com";
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function requireCatalog(catalogs, type) {
  const catalog = catalogs?.[type];
  if (!catalog || !Array.isArray(catalog.items)) {
    throw new TypeError(`${type} catalog is required`);
  }
  return catalog;
}

function captionDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    const [year, month, day] = value.split("-").map(Number);
    return `${day} ${MONTHS[month - 1]} ${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(value || "")) {
    const [year, month] = value.split("-").map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  }
  return String(value || "").trim();
}

function displayDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  }
  if (/^\d{4}-\d{2}$/.test(value || "")) {
    return `${value.slice(5, 7)}.${value.slice(0, 4)}`;
  }
  return String(value || "").trim();
}

function imageFrom(media) {
  const src = media?.display1600 || media?.thumb960 || media?.thumb480 || null;
  return src ? { src, alt: String(media.alt || "").trim() } : null;
}

function describeImage(image) {
  return image?.alt ? ` The central image is labeled: ${image.alt}.` : "";
}

function buildEventStory(catalogs, id) {
  const catalog = requireCatalog(catalogs, "events");
  const event = buildEventData(catalog).all.find((item) => item.id === id);
  if (!event) throw new RangeError(`event not found: ${id}`);

  const image = imageFrom(event.cover);
  const link = `${SITE_ORIGIN}${event.path}`;
  const date = captionDate(event.date);
  const storyText = [
    `${date} — ${event.title}${event.place ? `, ${event.place}` : ""}`,
    "",
    `Event details → ${link}`
  ].join("\n");

  return {
    format: "story",
    type: "event",
    label: "EVENT",
    id: event.id,
    title: event.title,
    overline: displayDate(event.date),
    details: event.place ? [event.place] : [],
    footer: "fmmaciej.com/music/events",
    image,
    storyText,
    link,
    accessibilityDescription: [
      `Black terminal-inspired Instagram Story for the event ${event.title}.`,
      `It shows the date ${date}${event.place ? ` and location ${event.place}` : ""}.`,
      describeImage(image).trim()
    ].filter(Boolean).join(" "),
    backgroundLines: [
      `fm@fmmaciej:~$ cat music/events/${event.id}`,
      `${displayDate(event.date)}  ${event.title}`,
      event.place || "LOCATION TBA",
      `fm@fmmaciej:~$ echo ${event.path}`,
      event.path
    ]
  };
}

function allMixes(catalog) {
  const data = buildMixData(catalog);
  return [...data.upcomingItems, ...data.archiveItems];
}

function buildMixStory(catalogs, id) {
  const catalog = requireCatalog(catalogs, "mixes");
  const mix = allMixes(catalog).find((item) => item.id === id);
  if (!mix) throw new RangeError(`mix not found: ${id}`);

  const image = mix.imageId && mix.img
    ? { src: mix.img, alt: String(mix.alt || mix.title).trim() }
    : null;
  const link = mix.url || `${SITE_ORIGIN}/music/mixes/#planned`;
  const date = captionDate(mix.date);
  const facts = [mix.duration, mix.genre, mix.platform].filter(Boolean);
  const callToAction = mix.url ? `Listen → ${link}` : `More mixes → ${link}`;
  const storyText = [
    `${mix.status === "published" ? "New mix" : "Coming soon"}: ${mix.title}`,
    [date, ...facts].filter(Boolean).join(" · "),
    "",
    callToAction
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join("\n");

  return {
    format: "story",
    type: "mix",
    label: "MIX",
    id: mix.id,
    title: mix.title,
    overline: [mix.displayDate, mix.platform].filter(Boolean).join(" · "),
    details: [mix.genre, mix.duration, mix.status === "planned" ? "COMING SOON" : null].filter(Boolean),
    footer: "fmmaciej.com/music/mixes",
    image,
    storyText,
    link,
    accessibilityDescription: image
      ? `Black terminal-inspired Instagram Story for the mix ${mix.title}. It shows ${[date, ...facts].filter(Boolean).join(", ")}.${describeImage(image)}`
      : `Black terminal-inspired text-only Instagram Story for the mix ${mix.title}. It shows ${[date, ...facts].filter(Boolean).join(", ")}.`,
    backgroundLines: [
      `fm@fmmaciej:~$ play music/mixes/${mix.id}`,
      `${mix.displayDate}  ${mix.title}`,
      facts.join("  "),
      `fm@fmmaciej:~$ echo ${link}`,
      link
    ].filter(Boolean)
  };
}

function photoCredit(set) {
  return set.authorInfo.instagram?.label || set.authorInfo.name || null;
}

function buildPhotoStory(catalogs, id) {
  const catalog = requireCatalog(catalogs, "photos");
  const sets = buildPhotoData(catalog).sets;
  const set = sets.find((item) => item.photos.some((photo) => photo.id === id));
  if (!set) throw new RangeError(`photo not found: ${id}`);

  const photo = set.photos.find((item) => item.id === id);
  const image = imageFrom(photo);
  const credit = photoCredit(set);
  const link = `${SITE_ORIGIN}/music/photos/#y-${set.year}`;
  const date = captionDate(set.date);
  const storyText = [
    set.title,
    [date, set.place].filter(Boolean).join(" · "),
    credit ? `Photo: ${credit}` : null,
    "",
    `More photos → ${link}`
  ].filter((line) => line !== null).join("\n");

  return {
    format: "story",
    type: "photo",
    label: "PHOTO",
    id: photo.id,
    title: set.title,
    overline: displayDate(set.date),
    details: [set.place, credit ? `PHOTO / ${credit}` : null].filter(Boolean),
    footer: "fmmaciej.com/music/photos",
    image,
    storyText,
    link,
    accessibilityDescription: [
      `Black terminal-inspired Instagram Story featuring photo ${photo.seq} from ${set.title}.`,
      `It shows the date ${date}${set.place ? ` and location ${set.place}` : ""}${credit ? `, with credit to ${credit}` : ""}.`,
      describeImage(image).trim()
    ].filter(Boolean).join(" "),
    backgroundLines: [
      `fm@fmmaciej:~$ identify music/photos/${photo.id}`,
      `${displayDate(set.date)}  ${set.title}  #${photo.seq}`,
      [set.place, credit].filter(Boolean).join("  "),
      `fm@fmmaciej:~$ echo /music/photos/#y-${set.year}`,
      `/music/photos/#y-${set.year}`
    ].filter(Boolean)
  };
}

function buildInstagramStory(catalogs, options = {}) {
  const type = options.type;
  const id = String(options.id || "").trim();
  if (!id) throw new TypeError("story id is required");

  if (type === "event") return buildEventStory(catalogs, id);
  if (type === "mix") return buildMixStory(catalogs, id);
  if (type === "photo") return buildPhotoStory(catalogs, id);
  throw new TypeError(`unsupported story type: ${type || "(missing)"}`);
}

module.exports = {
  SITE_ORIGIN,
  buildInstagramStory,
  captionDate,
  displayDate
};
