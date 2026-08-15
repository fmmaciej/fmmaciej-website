const MIN_STORY_EVENTS = 4;
const MAX_STORY_EVENTS = 6;
const CALENDAR_URL = "https://www.fmmaciej.com/music/events/";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function formatCaptionDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatDisplayDate(date) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

function selectEventItems(items) {
  const upcoming = items
    .filter((item) => item.section === "upcoming")
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, MAX_STORY_EVENTS);
  const recent = upcoming.length < MIN_STORY_EVENTS
    ? items
      .filter((item) => item.section === "archive")
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, MIN_STORY_EVENTS - upcoming.length)
    : [];

  return { upcoming, recent };
}

function auditInstagramEventCatalog(catalog) {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(catalog?.items) ? catalog.items : null;
  const media = Array.isArray(catalog?.media) ? catalog.media : [];
  const mediaIds = new Set(media.map((item) => item.id));

  if (!items) {
    return {
      errors: ["events catalog must contain an items array"],
      warnings,
      selectedIds: []
    };
  }

  const ids = new Set();
  items.forEach((item, index) => {
    const label = String(item?.id || `item ${index + 1}`);
    const id = String(item?.id || "").trim();
    const title = String(item?.title || "").trim();

    if (!id) errors.push(`${label}: id is required`);
    else if (ids.has(id)) errors.push(`${label}: duplicate id`);
    else ids.add(id);

    if (!title) errors.push(`${label}: title is required`);
    if (!isIsoDate(item?.date)) errors.push(`${label}: date must be a real YYYY-MM-DD date`);
    if (!new Set(["upcoming", "archive"]).has(item?.section)) {
      errors.push(`${label}: section must be upcoming or archive`);
    }
    if (item?.coverId && !mediaIds.has(item.coverId)) {
      errors.push(`${label}: coverId does not match any media item (${item.coverId})`);
    }
  });

  if (errors.length) return { errors, warnings, selectedIds: [] };

  const selected = selectEventItems(items);
  const selectedItems = [...selected.upcoming, ...selected.recent];

  selectedItems.forEach((item) => {
    const place = String(item.place || "").trim();
    const title = String(item.title || "").trim();

    if (!place) warnings.push(`${item.id}: place is missing`);
    if (/^t(?:o be announced|ba)$/i.test(title)) {
      warnings.push(`${item.id}: title is still a placeholder (${title})`);
    }
    if (!item.coverId) {
      warnings.push(`${item.id}: event-specific cover is missing; the shared fallback will be used`);
    }
  });

  return {
    errors,
    warnings,
    selectedIds: selectedItems.map((item) => item.id)
  };
}

function createEntry(item, isRecent) {
  return {
    id: item.id,
    title: item.title.trim(),
    date: item.date,
    displayDate: formatDisplayDate(item.date),
    captionDate: formatCaptionDate(item.date),
    place: String(item.place || "").trim() || (isRecent ? "" : "LOCATION TBA"),
    isRecent
  };
}

function buildInstagramEventStory(catalog) {
  const audit = auditInstagramEventCatalog(catalog);
  if (audit.errors.length) {
    throw new TypeError(`Instagram event data is invalid:\n- ${audit.errors.join("\n- ")}`);
  }

  const selected = selectEventItems(catalog.items);
  const upcoming = selected.upcoming.map((item) => createEntry(item, false));
  const recent = selected.recent.map((item) => createEntry(item, true));

  return {
    format: "story",
    upcoming,
    recent,
    entries: [...upcoming, ...recent]
  };
}

function describeEvent(event) {
  const place = event.place ? ` in ${event.place}` : "";
  return `${event.title} on ${event.captionDate}${place}`;
}

function buildInstagramStoryText(story) {
  const lines = story.upcoming.length
    ? ["Upcoming dates:", "", ...story.upcoming.map((event) => {
      const place = event.place ? `, ${event.place}` : "";
      return `${event.captionDate} — ${event.title}${place}`;
    })]
    : ["No upcoming dates are currently announced."];

  if (story.recent.length) {
    lines.push(
      "",
      "Recently played:",
      "",
      ...story.recent.map((event) => {
        const place = event.place ? `, ${event.place}` : "";
        return `${event.captionDate} — ${event.title}${place}`;
      })
    );
  }

  lines.push("", `Full calendar → ${CALENDAR_URL}`);
  return lines.join("\n");
}

function buildInstagramStoryAltText(story, options = {}) {
  const upcoming = story.upcoming.length
    ? `Upcoming events: ${story.upcoming.map(describeEvent).join("; ")}.`
    : "No upcoming events are listed.";
  const recent = story.recent.length
    ? ` Recently played events, shown crossed out: ${story.recent.map(describeEvent).join("; ")}.`
    : "";
  const background = options.background === "terminal"
    ? " A faint terminal transcript derived from the selected events appears in the background."
    : "";

  return `Black monochrome Instagram Story event calendar in a terminal-inspired card layout. ${upcoming}${recent}${background}`;
}

module.exports = {
  MIN_STORY_EVENTS,
  MAX_STORY_EVENTS,
  CALENDAR_URL,
  auditInstagramEventCatalog,
  buildInstagramEventStory,
  buildInstagramStoryText,
  buildInstagramStoryAltText,
  formatDisplayDate
};
