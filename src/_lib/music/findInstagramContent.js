const buildEventData = require("./buildEventData.js");
const buildMixData = require("./buildMixData.js");
const buildPhotoData = require("./buildPhotoData.js");

const CATALOG_NAMES = {
  event: "events",
  mix: "mixes",
  photo: "photos"
};

function requireCatalog(catalogs, type) {
  const name = CATALOG_NAMES[type];
  const catalog = name ? catalogs?.[name] : null;
  if (!catalog || !Array.isArray(catalog.items)) {
    throw new TypeError(`${name || type} catalog is required`);
  }
  return catalog;
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .trim();
}

function eventRecords(catalog) {
  return buildEventData(catalog).all.map((event) => ({
    type: "event",
    id: event.id,
    date: event.date,
    title: event.title,
    details: event.place || ""
  }));
}

function mixRecords(catalog) {
  const data = buildMixData(catalog);
  const published = [...data.archiveItems]
    .sort((left, right) => right.date.localeCompare(left.date));

  return [...data.upcomingItems, ...published].map((mix) => ({
    type: "mix",
    id: mix.id,
    date: mix.dateEnd ? `${mix.date}–${mix.dateEnd}` : mix.date,
    title: mix.title,
    details: [mix.platform, mix.genre].filter(Boolean).join(" · ")
  }));
}

function photoCredit(set) {
  const name = set.authorInfo.name || "";
  const instagram = set.authorInfo.instagram?.label || "";
  if (name && instagram && normalizeSearch(name) === normalizeSearch(instagram.replace(/^@/, ""))) {
    return instagram;
  }
  return [name, instagram].filter(Boolean).join(" · ");
}

function photoRecords(catalog) {
  return buildPhotoData(catalog).sets.flatMap((set) => set.photos.map((photo) => ({
    type: "photo",
    id: photo.id,
    date: set.date,
    title: `${set.title} #${photo.seq}`,
    details: [set.place, photoCredit(set)].filter(Boolean).join(" · ")
  })));
}

function recordsFor(catalogs, type) {
  if (!Object.hasOwn(CATALOG_NAMES, type)) {
    throw new TypeError(`unsupported find type: ${type || "(missing)"}`);
  }
  const catalog = requireCatalog(catalogs, type);
  if (type === "event") return eventRecords(catalog);
  if (type === "mix") return mixRecords(catalog);
  if (type === "photo") return photoRecords(catalog);
}

function findInstagramContent(catalogs, options = {}) {
  const query = normalizeSearch(options.query);
  const tokens = query.split(/\s+/).filter(Boolean);
  const records = recordsFor(catalogs, options.type);
  if (!tokens.length) return records;

  return records.filter((record) => {
    const searchable = normalizeSearch([
      record.type,
      record.id,
      record.date,
      record.title,
      record.details
    ].join(" "));
    return tokens.every((token) => searchable.includes(token));
  });
}

module.exports = {
  findInstagramContent,
  normalizeSearch
};
