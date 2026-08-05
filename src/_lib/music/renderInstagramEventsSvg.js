const WIDTH = 1080;
const HEIGHT = 1350;
const LEFT = 72;
const CARD_WIDTH = WIDTH - (LEFT * 2);

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

function groupHeight(events) {
  if (!events.length) return 142;
  return 78 + (events.length * 146) + ((events.length - 1) * 14);
}

function renderTerminalBackground(post) {
  const events = post.entries.length
    ? post.entries
    : [{ displayDate: post.today, title: "NO EVENTS ANNOUNCED", place: "" }];
  const lines = [
    "fm@fmmaciej:~$ cat music/events",
    ...events.map((event) => `${event.displayDate}  ${event.title}${event.place ? `  ${event.place}` : ""}`),
    "fm@fmmaciej:~$ echo fmmaciej.com/music/events",
    "fmmaciej.com/music/events"
  ];
  const rows = Array.from({ length: 42 }, (_, index) => {
    const line = lines[index % lines.length];
    const x = index % 3 === 1 ? 286 : (index % 3 === 2 ? -118 : 50);
    const y = 188 + (index * 24);
    return `<text x="${x}" y="${y}">${escapeXml(line)}</text>`;
  }).join("");

  return `<g class="terminal-background" clip-path="url(#background-clip)" filter="url(#terminal-background-blur)">${rows}</g>`;
}

function renderCard(event, y) {
  const opacity = event.isRecent ? "0.42" : "1";
  const place = event.place
    ? `<text class="place" x="${LEFT + 28}" y="${y + 118}">${escapeXml(event.place)}</text>`
    : "";
  const strike = event.isRecent
    ? `<line class="strike" x1="${LEFT + 20}" x2="${LEFT + CARD_WIDTH - 20}" y1="${y + 76}" y2="${y + 76}"/>`
    : "";

  return `
    <g opacity="${opacity}">
      <rect class="card" x="${LEFT}" y="${y}" width="${CARD_WIDTH}" height="146" rx="10"/>
      <text class="date" x="${LEFT + 28}" y="${y + 38}">${escapeXml(event.displayDate)}</text>
      <text class="title" x="${LEFT + 28}" y="${y + 86}">${escapeXml(visualUppercase(event.title))}</text>
      ${place}
      ${strike}
    </g>`;
}

function renderGroup(label, events, y) {
  const header = `
    <text class="group-label" x="${LEFT}" y="${y + 27}">&gt; ${escapeXml(label)}</text>
    <line class="dots" x1="${LEFT + 250}" x2="${LEFT + CARD_WIDTH - 60}" y1="${y + 21}" y2="${y + 21}"/>
    <text class="count" x="${LEFT + CARD_WIDTH}" y="${y + 27}" text-anchor="end">${events.length}</text>`;

  if (!events.length) {
    return {
      svg: `${header}
        <rect class="empty-card" x="${LEFT}" y="${y + 48}" width="${CARD_WIDTH}" height="76" rx="10"/>
        <text class="empty" x="${LEFT + 28}" y="${y + 94}">NO UPCOMING EVENTS ANNOUNCED</text>`,
      height: groupHeight(events)
    };
  }

  return {
    svg: `${header}${events.map((event, index) => renderCard(event, y + 48 + (index * 160))).join("")}`,
    height: groupHeight(events)
  };
}

function renderInstagramEventsSvg(post, options = {}) {
  const topGroup = renderGroup("UPCOMING", post.upcoming, 196);
  const recentGroup = post.recent.length
    ? renderGroup("RECENTLY PLAYED", post.recent, 196 + topGroup.height + 34)
    : null;
  const background = options.background === "terminal" ? renderTerminalBackground(post) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img">
  <defs>
    <clipPath id="background-clip"><rect x="0" y="172" width="${WIDTH}" height="1030"/></clipPath>
    <filter id="terminal-background-blur" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>
  <style>
    .base { font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .header { fill: #eaeaea; font-size: 28px; font-weight: 700; letter-spacing: 1.8px; }
    .subheader { fill: #8a8a8a; font-size: 18px; letter-spacing: 1.2px; }
    .group-label, .count { fill: #eaeaea; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 22px; font-weight: 700; letter-spacing: 1.1px; }
    .dots { stroke: #454545; stroke-width: 1px; stroke-dasharray: 2 8; }
    .card, .empty-card { fill: #050505; stroke: #1a1a1a; stroke-width: 2px; }
    .date { fill: #8a8a8a; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 20px; font-weight: 700; letter-spacing: 1.1px; }
    .title { fill: #eaeaea; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 34px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
    .place { fill: #b7b7b7; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 18px; letter-spacing: .8px; text-transform: uppercase; }
    .empty { fill: #8a8a8a; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 19px; letter-spacing: .8px; }
    .strike { stroke: #b7b7b7; stroke-width: 3px; }
    .footer { fill: #8a8a8a; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 18px; letter-spacing: .8px; }
    .terminal-background { fill: #8a8a8a; font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 16px; letter-spacing: .5px; opacity: .16; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
  <g class="base">
    <text class="header" x="${LEFT}" y="100">FM / MUSIC</text>
    <text class="subheader" x="${LEFT}" y="132">EVENT CALENDAR</text>
    <line x1="${LEFT}" x2="${LEFT + CARD_WIDTH}" y1="157" y2="157" stroke="#1a1a1a" stroke-width="2"/>
    ${background}
    ${topGroup.svg}
    ${recentGroup ? recentGroup.svg : ""}
    <line x1="${LEFT}" x2="${LEFT + CARD_WIDTH}" y1="1228" y2="1228" stroke="#1a1a1a" stroke-width="2"/>
    <text class="footer" x="${LEFT}" y="1272">fmmaciej.com/music/events</text>
  </g>
</svg>`;
}

module.exports = {
  WIDTH,
  HEIGHT,
  escapeXml,
  visualUppercase,
  renderTerminalBackground,
  renderInstagramEventsSvg
};
