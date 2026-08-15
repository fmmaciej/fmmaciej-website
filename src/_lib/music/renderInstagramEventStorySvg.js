const WIDTH = 1080;
const HEIGHT = 1920;
const LEFT = 72;
const CONTENT_WIDTH = WIDTH - (LEFT * 2);
const SAFE_TOP = 269;
const SAFE_BOTTOM = 1536;
const CONTENT_TOP = 396;
const CARD_HEIGHT = 160;
const CARD_GAP = 10;
const GROUP_HEADER_HEIGHT = 49;
const GROUP_GAP = 20;
const FOOTER_LINE_Y = 1484;
const FOOTER_TEXT_Y = 1524;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function visualUppercase(value) {
  return String(value).toLocaleUpperCase("pl-PL");
}

function shorten(value, maxChars) {
  const characters = Array.from(value);
  if (characters.length <= maxChars) return value;
  return `${characters.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

function splitLongWord(word, maxChars) {
  const characters = Array.from(word);
  const chunks = [];
  for (let index = 0; index < characters.length; index += maxChars) {
    chunks.push(characters.slice(index, index + maxChars).join(""));
  }
  return chunks;
}

function wrapText(value, options = {}) {
  const maxChars = options.maxChars || 46;
  const maxLines = options.maxLines || 2;
  const words = String(value || "").trim().split(/\s+/).filter(Boolean)
    .flatMap((word) => Array.from(word).length > maxChars ? splitLongWord(word, maxChars) : [word]);
  if (!words.length) return [];

  const lines = [];
  let current = "";
  let truncated = false;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (Array.from(candidate).length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }

  if (!truncated && current && lines.length < maxLines) lines.push(current);
  if (!truncated && current && lines.length === maxLines && lines.at(-1) !== current) truncated = true;
  if (truncated) lines[maxLines - 1] = shorten(`${lines[maxLines - 1]}…`, maxChars);

  return lines.slice(0, maxLines);
}

function groupHeight(events) {
  if (!events.length) return GROUP_HEADER_HEIGHT + 96;
  return GROUP_HEADER_HEIGHT +
    (events.length * CARD_HEIGHT) +
    ((events.length - 1) * CARD_GAP);
}

function renderTerminalBackground(story) {
  const events = story.entries.length
    ? story.entries
    : [{ displayDate: "--.--.----", title: "NO EVENTS ANNOUNCED", place: "" }];
  const lines = [
    "fm@fmmaciej:~$ cat music/events",
    ...events.map((event) => `${event.displayDate}  ${event.title}${event.place ? `  ${event.place}` : ""}`),
    "fm@fmmaciej:~$ echo fmmaciej.com/music/events",
    "fmmaciej.com/music/events"
  ];
  const rows = Array.from({ length: 58 }, (_, index) => {
    const line = lines[index % lines.length];
    const x = index % 3 === 1 ? 286 : (index % 3 === 2 ? -118 : 50);
    const y = 240 + (index * 28);
    return `<text x="${x}" y="${y}">${escapeXml(line)}</text>`;
  }).join("");

  return `<g class="terminal-background" clip-path="url(#background-clip)" filter="url(#terminal-background-blur)">${rows}</g>`;
}

function renderTitleLines(lines, x, y) {
  return lines.map((line, index) => (
    `<tspan x="${x}" y="${y + (index * 32)}">${escapeXml(line)}</tspan>`
  )).join("");
}

function renderCard(event, y) {
  const x = LEFT;
  const textX = x + 28;
  const titleLines = wrapText(visualUppercase(event.title));
  const strikes = event.isRecent
    ? titleLines.map((line, index) => {
      const approximateWidth = Math.min(CONTENT_WIDTH - 56, Math.max(90, line.length * 17));
      const strikeY = y + 57 + (index * 32);
      return `<line class="strike" x1="${textX - 6}" x2="${textX + approximateWidth}" y1="${strikeY}" y2="${strikeY}"/>`;
    }).join("")
    : "";
  const place = event.place
    ? `<text class="place" x="${textX}" y="${y + 137}">${escapeXml(visualUppercase(event.place))}</text>`
    : "";

  return `
    <g class="event-card${event.isRecent ? " recent" : ""}">
      <rect class="card" x="${x}" y="${y}" width="${CONTENT_WIDTH}" height="${CARD_HEIGHT}" rx="10"/>
      <text class="date" x="${textX}" y="${y + 29}">${escapeXml(event.displayDate)}</text>
      <text class="title" x="${textX}">${renderTitleLines(titleLines, textX, y + 67)}</text>
      ${place}
      ${strikes}
    </g>`;
}

function renderGroup(label, events, y, options = {}) {
  const header = `
    <text class="group-label" x="${LEFT}" y="${y + 27}">&gt; ${escapeXml(label)}</text>
    <line class="dots" x1="${LEFT + 250}" x2="${LEFT + CONTENT_WIDTH - 60}" y1="${y + 21}" y2="${y + 21}"/>
    <text class="count" x="${LEFT + CONTENT_WIDTH}" y="${y + 27}" text-anchor="end">${events.length}</text>`;

  if (!events.length) {
    return {
      svg: `${header}
        <rect class="empty-card" x="${LEFT}" y="${y + GROUP_HEADER_HEIGHT}" width="${CONTENT_WIDTH}" height="96" rx="10"/>
        <text class="empty" x="${LEFT + 28}" y="${y + GROUP_HEADER_HEIGHT + 58}">NO UPCOMING EVENTS ANNOUNCED</text>`,
      height: groupHeight(events)
    };
  }

  const cards = events.map((event, index) => renderCard(
    event,
    y + GROUP_HEADER_HEIGHT + (index * (CARD_HEIGHT + CARD_GAP))
  )).join("");

  return {
    svg: `${header}${cards}`,
    height: groupHeight(events),
    isRecent: options.isRecent === true
  };
}

function renderInstagramEventStorySvg(story, options = {}) {
  if (!story || story.format !== "story") {
    throw new TypeError("an Instagram event Story view model is required");
  }
  if (story.entries.length > 6) {
    throw new RangeError("an Instagram event Story can contain at most 6 events");
  }

  const upcomingGroup = renderGroup("UPCOMING", story.upcoming, CONTENT_TOP);
  const recentGroup = story.recent.length
    ? renderGroup(
      "RECENTLY PLAYED",
      story.recent,
      CONTENT_TOP + upcomingGroup.height + GROUP_GAP,
      { isRecent: true }
    )
    : null;
  const contentBottom = recentGroup
    ? CONTENT_TOP + upcomingGroup.height + GROUP_GAP + recentGroup.height
    : CONTENT_TOP + upcomingGroup.height;
  if (contentBottom > FOOTER_LINE_Y - 24) {
    throw new RangeError("Instagram event Story content exceeds the safe layout area");
  }

  const background = options.background === "terminal" ? renderTerminalBackground(story) : "";
  const altText = options.altText || "Instagram Story event calendar";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(altText)}">
  <defs>
    <clipPath id="background-clip"><rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}"/></clipPath>
    <filter id="terminal-background-blur" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>
  <style>
    .base { font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .header { fill: #eaeaea; font-size: 28px; font-weight: 700; letter-spacing: 1.8px; }
    .subheader { fill: #8a8a8a; font-size: 18px; letter-spacing: 1.2px; }
    .group-label, .count { fill: #eaeaea; font-size: 22px; font-weight: 700; letter-spacing: 1.1px; }
    .dots { stroke: #454545; stroke-width: 1px; stroke-dasharray: 2 8; }
    .card, .empty-card { fill: #050505; stroke: #1a1a1a; stroke-width: 2px; }
    .date { fill: #8a8a8a; font-size: 18px; font-weight: 700; letter-spacing: 1.1px; }
    .title { fill: #eaeaea; font-size: 28px; font-weight: 700; letter-spacing: .4px; }
    .place { fill: #b7b7b7; font-size: 17px; letter-spacing: .7px; }
    .empty { fill: #8a8a8a; font-size: 19px; letter-spacing: .8px; }
    .recent { opacity: .48; }
    .strike { stroke: #d0d0d0; stroke-width: 3px; }
    .footer { fill: #8a8a8a; font-size: 18px; letter-spacing: .8px; }
    .terminal-background { fill: #8a8a8a; font-size: 16px; letter-spacing: .5px; opacity: .18; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
  <g class="base">
    ${background}
    <g class="safe-content">
      <text class="header" x="${LEFT}" y="310">FM / MUSIC</text>
      <text class="subheader" x="${LEFT}" y="344">EVENT CALENDAR / STORY</text>
      <line x1="${LEFT}" x2="${LEFT + CONTENT_WIDTH}" y1="374" y2="374" stroke="#1a1a1a" stroke-width="2"/>
      ${upcomingGroup.svg}
      ${recentGroup ? recentGroup.svg : ""}
      <line x1="${LEFT}" x2="${LEFT + CONTENT_WIDTH}" y1="${FOOTER_LINE_Y}" y2="${FOOTER_LINE_Y}" stroke="#1a1a1a" stroke-width="2"/>
      <text class="footer" x="${LEFT}" y="${FOOTER_TEXT_Y}">fmmaciej.com/music/events</text>
    </g>
  </g>
</svg>`;
}

module.exports = {
  WIDTH,
  HEIGHT,
  SAFE_TOP,
  SAFE_BOTTOM,
  CONTENT_TOP,
  FOOTER_TEXT_Y,
  escapeXml,
  wrapText,
  renderTerminalBackground,
  renderInstagramEventStorySvg
};
