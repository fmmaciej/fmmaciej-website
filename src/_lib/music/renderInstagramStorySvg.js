const WIDTH = 1080;
const HEIGHT = 1920;
const LEFT = 72;
const CONTENT_WIDTH = WIDTH - (LEFT * 2);

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
  const maxChars = options.maxChars || 32;
  const maxLines = options.maxLines || 3;
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

function renderTextLines(lines, options) {
  return lines.map((line, index) => (
    `<tspan x="${options.x}" y="${options.y + (index * options.lineHeight)}">${escapeXml(line)}</tspan>`
  )).join("");
}

function renderTerminalBackground(story) {
  const lines = story.backgroundLines?.length
    ? story.backgroundLines
    : [`fm@fmmaciej:~$ cat music/${story.type}/${story.id}`, story.title];
  const rows = Array.from({ length: 58 }, (_, index) => {
    const line = lines[index % lines.length];
    const x = index % 3 === 1 ? 310 : (index % 3 === 2 ? -140 : 42);
    const y = 236 + (index * 28);
    return `<text x="${x}" y="${y}">${escapeXml(line)}</text>`;
  }).join("");

  return `<g class="terminal-background" clip-path="url(#background-clip)" filter="url(#terminal-background-blur)">${rows}</g>`;
}

function renderDetails(story, startY, x = LEFT) {
  let y = startY;
  const rows = [];

  for (const detail of story.details || []) {
    const lines = wrapText(visualUppercase(detail), { maxChars: 51, maxLines: 1 });
    if (!lines.length) continue;
    rows.push(`<text class="detail" x="${x}" y="${y}">${escapeXml(lines[0])}</text>`);
    y += 36;
  }

  return rows.join("");
}

function renderImageLayout(story) {
  const titleLines = wrapText(visualUppercase(story.title), { maxChars: 31, maxLines: 3 });
  const titleY = 1418;
  const detailY = titleY + (titleLines.length * 56) + 16;

  return `
    <rect class="media-frame" x="${LEFT}" y="256" width="${CONTENT_WIDTH}" height="1014" rx="12"/>
    <image x="${LEFT + 16}" y="272" width="${CONTENT_WIDTH - 32}" height="982" href="${escapeXml(story.image.dataUri)}" preserveAspectRatio="xMidYMid meet"/>
    <text class="overline" x="${LEFT}" y="1352">${escapeXml(visualUppercase(story.overline))}</text>
    <text class="title" x="${LEFT}">${renderTextLines(titleLines, { x: LEFT, y: titleY, lineHeight: 56 })}</text>
    ${renderDetails(story, detailY)}`;
}

function renderTextLayout(story) {
  const titleLines = wrapText(visualUppercase(story.title), { maxChars: 27, maxLines: 4 });
  const titleY = 644;
  const detailY = titleY + (titleLines.length * 64) + 54;

  return `
    <rect class="text-card" x="${LEFT}" y="338" width="${CONTENT_WIDTH}" height="1010" rx="12"/>
    <text class="prompt" x="${LEFT + 42}" y="430">&gt; ${escapeXml(story.label)} / TEXT MODE</text>
    <text class="overline" x="${LEFT + 42}" y="532">${escapeXml(visualUppercase(story.overline))}</text>
    <text class="title text-title" x="${LEFT + 42}">${renderTextLines(titleLines, { x: LEFT + 42, y: titleY, lineHeight: 64 })}</text>
    ${renderDetails({ details: story.details }, detailY, LEFT + 42)}`;
}

function renderInstagramStorySvg(story, options = {}) {
  if (!story || story.format !== "story") {
    throw new TypeError("a story view model is required");
  }
  if (story.image && !story.image.dataUri) {
    throw new TypeError("story image must include an embedded dataUri");
  }

  const background = options.background === "terminal" ? renderTerminalBackground(story) : "";
  const content = story.image ? renderImageLayout(story) : renderTextLayout(story);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(story.accessibilityDescription)}">
  <defs>
    <clipPath id="background-clip"><rect x="0" y="210" width="${WIDTH}" height="1510"/></clipPath>
    <filter id="terminal-background-blur" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>
  <style>
    .base { font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .header { fill: #eaeaea; font-size: 28px; font-weight: 700; letter-spacing: 1.8px; }
    .subheader { fill: #8a8a8a; font-size: 18px; letter-spacing: 1.2px; }
    .terminal-background { fill: #8a8a8a; font-size: 16px; letter-spacing: .5px; opacity: .12; }
    .media-frame, .text-card { fill: #050505; stroke: #1f1f1f; stroke-width: 2px; }
    .prompt { fill: #8a8a8a; font-size: 20px; font-weight: 700; letter-spacing: 1.1px; }
    .overline { fill: #8a8a8a; font-size: 22px; font-weight: 700; letter-spacing: 1.1px; }
    .title { fill: #eaeaea; font-size: 46px; font-weight: 700; letter-spacing: .4px; }
    .text-title { font-size: 52px; }
    .detail { fill: #b7b7b7; font-size: 21px; letter-spacing: .8px; }
    .footer { fill: #8a8a8a; font-size: 18px; letter-spacing: .8px; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000"/>
  <g class="base">
    <text class="header" x="${LEFT}" y="126">FM / MUSIC</text>
    <text class="subheader" x="${LEFT}" y="162">${escapeXml(story.label)}</text>
    <line x1="${LEFT}" x2="${LEFT + CONTENT_WIDTH}" y1="194" y2="194" stroke="#1a1a1a" stroke-width="2"/>
    ${background}
    ${content}
    <line x1="${LEFT}" x2="${LEFT + CONTENT_WIDTH}" y1="1746" y2="1746" stroke="#1a1a1a" stroke-width="2"/>
    <text class="footer" x="${LEFT}" y="1792">${escapeXml(story.footer)}</text>
  </g>
</svg>`;
}

module.exports = {
  WIDTH,
  HEIGHT,
  escapeXml,
  wrapText,
  renderTerminalBackground,
  renderInstagramStorySvg
};
