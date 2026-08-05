const MAX_EVENTS = 4;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function assertIsoDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${field} must use the YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`${field} must be a real calendar date`);
  }
}

function formatCaptionDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatDisplayDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function createEntry(item, state) {
  const title = String(item.title || "").trim();
  if (!title) throw new TypeError(`event ${item.id || "(without id)"} must have a title`);

  assertIsoDate(item.date, `event ${item.id || title}.date`);

  const place = String(item.place || "").trim();
  const isRecent = state === "recent";

  return {
    id: String(item.id || ""),
    title,
    date: item.date,
    displayDate: formatDisplayDate(item.date),
    captionDate: formatCaptionDate(item.date),
    place: place || (isRecent ? "" : "LOCATION TBA"),
    isRecent
  };
}

function buildInstagramEventPost(catalog, options = {}) {
  const today = options.today;
  assertIsoDate(today, "today");

  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const upcomingItems = items
    .filter((item) => item.section === "upcoming")
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, MAX_EVENTS);
  const remaining = MAX_EVENTS - upcomingItems.length;
  const recentItems = remaining > 0
    ? items
      .filter((item) => item.section === "archive" && item.date < today)
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, remaining)
    : [];

  const upcoming = upcomingItems.map((item) => createEntry(item, "upcoming"));
  const recent = recentItems.map((item) => createEntry(item, "recent"));

  return {
    today,
    upcoming,
    recent,
    entries: [...upcoming, ...recent]
  };
}

function buildInstagramCaption(post) {
  const lines = post.upcoming.length
    ? ["Upcoming dates:", "", ...post.upcoming.map((event) => {
      const place = event.place ? `, ${event.place}` : "";
      return `${event.captionDate} — ${event.title}${place}`;
    })]
    : ["No upcoming dates are currently announced."];

  lines.push("", "Full calendar → fmmaciej.com/music/events/");
  return lines.join("\n");
}

function buildInstagramAltText(post, options = {}) {
  const describe = (event) => {
    const place = event.place ? ` in ${event.place}` : "";
    return `${event.title} on ${event.captionDate}${place}`;
  };
  const upcoming = post.upcoming.length
    ? `Upcoming events: ${post.upcoming.map(describe).join("; ")}.`
    : "No upcoming events are listed.";
  const recent = post.recent.length
    ? ` Recently played events, shown crossed out: ${post.recent.map(describe).join("; ")}.`
    : "";

  const background = options.background === "terminal"
    ? " A faint terminal transcript derived from the calendar appears in the background."
    : "";

  return `Black monochrome event calendar in a terminal-inspired card layout. ${upcoming}${recent}${background}`;
}

module.exports = {
  MAX_EVENTS,
  buildInstagramEventPost,
  buildInstagramCaption,
  buildInstagramAltText,
  formatDisplayDate
};
