const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MIN_STORY_EVENTS,
  MAX_STORY_EVENTS,
  CALENDAR_URL,
  auditInstagramEventCatalog,
  buildInstagramEventStory,
  buildInstagramStoryText,
  buildInstagramStoryAltText
} = require("../src/_lib/music/buildInstagramEventStory.js");
const {
  WIDTH,
  HEIGHT,
  SAFE_TOP,
  SAFE_BOTTOM,
  CONTENT_TOP,
  FOOTER_TEXT_Y,
  wrapText,
  renderInstagramEventStorySvg
} = require("../src/_lib/music/renderInstagramEventStorySvg.js");

function event(id, date, section, title = id, place = "Club", coverId = null) {
  return { id, date, section, title, place, coverId };
}

function catalog(items, media = []) {
  return { defaults: { imagePreset: "upcoming-default" }, items, media };
}

test("Story selection sorts up to 6 upcoming events without mutating the catalog", () => {
  const input = catalog([
    event("seven", "2027-07-07", "upcoming"),
    event("two", "2027-02-02", "upcoming"),
    event("one", "2027-01-01", "upcoming"),
    event("six", "2027-06-06", "upcoming"),
    event("four", "2027-04-04", "upcoming"),
    event("three", "2027-03-03", "upcoming"),
    event("five", "2027-05-05", "upcoming")
  ]);
  const before = structuredClone(input);

  const story = buildInstagramEventStory(input);

  assert.deepEqual(input, before);
  assert.equal(MIN_STORY_EVENTS, 4);
  assert.equal(MAX_STORY_EVENTS, 6);
  assert.deepEqual(story.upcoming.map((item) => item.id), ["one", "two", "three", "four", "five", "six"]);
  assert.deepEqual(story.recent, []);
});

test("Story selection fills fewer than 4 upcoming events with the latest archive entries", () => {
  const story = buildInstagramEventStory(catalog([
    event("future-three", "2027-03-03", "upcoming"),
    event("future-one", "2027-01-01", "upcoming"),
    event("future-two", "2027-02-02", "upcoming"),
    event("archive-old", "2025-01-01", "archive", "Old", "Old club"),
    event("archive-latest", "2026-12-01", "archive", "Latest", "Latest club")
  ]));

  assert.deepEqual(story.upcoming.map((item) => item.id), ["future-one", "future-two", "future-three"]);
  assert.deepEqual(story.recent.map((item) => item.id), ["archive-latest"]);
  assert.equal(story.entries.length, 4);
  assert.equal(story.recent[0].isRecent, true);
});

test("Story selection never invents filler events when the catalog contains fewer than 4", () => {
  const story = buildInstagramEventStory(catalog([
    event("future", "2027-01-01", "upcoming"),
    event("archive", "2026-01-01", "archive")
  ]));

  assert.equal(story.entries.length, 2);
  assert.deepEqual(story.entries.map((item) => item.id), ["future", "archive"]);
});

test("editorial audit blocks structural errors and reports actionable warnings", () => {
  const warnings = auditInstagramEventCatalog(catalog([
    event("placeholder", "2027-01-01", "upcoming", "TBA", "", null)
  ]));
  assert.deepEqual(warnings.errors, []);
  assert.match(warnings.warnings.join("\n"), /title is still a placeholder/);
  assert.match(warnings.warnings.join("\n"), /place is missing/);
  assert.match(warnings.warnings.join("\n"), /event-specific cover is missing/);

  const errors = auditInstagramEventCatalog(catalog([
    event("duplicate", "2027-01-01", "upcoming", "One", "Club", "missing-cover"),
    event("duplicate", "not-a-date", "planned", "Two")
  ]));
  assert.match(errors.errors.join("\n"), /duplicate id/);
  assert.match(errors.errors.join("\n"), /real YYYY-MM-DD date/);
  assert.match(errors.errors.join("\n"), /section must be upcoming or archive/);
  assert.match(errors.errors.join("\n"), /coverId does not match any media item/);
});

test("Story publishing text describes upcoming and crossed-out recent events", () => {
  const story = buildInstagramEventStory(catalog([
    event("future", "2027-01-02", "upcoming", "Future", "Łódź"),
    event("recent", "2026-12-01", "archive", "Recent", "Warszawa")
  ]));
  const copy = buildInstagramStoryText(story);
  const alt = buildInstagramStoryAltText(story, { background: "terminal" });

  assert.match(copy, /Upcoming dates:[\s\S]+2 Jan 2027 — Future, Łódź/);
  assert.match(copy, /Recently played:[\s\S]+1 Dec 2026 — Recent, Warszawa/);
  assert.match(copy, new RegExp(CALENDAR_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(alt, /shown crossed out/);
  assert.match(alt, /terminal transcript/);
});

test("Story renderer keeps key content inside the safe area and wraps long titles", () => {
  const story = buildInstagramEventStory(catalog(Array.from({ length: 6 }, (_, index) => event(
    `event-${index + 1}`,
    `2027-0${index + 1}-01`,
    "upcoming",
    index === 0
      ? "An intentionally very long event title that must wrap and eventually be shortened because it cannot fit"
      : `Event ${index + 1}`,
    "Venue"
  ))));
  const altText = buildInstagramStoryAltText(story);
  const svg = renderInstagramEventStorySvg(story, { background: "terminal", altText });

  assert.match(svg, new RegExp(`width="${WIDTH}" height="${HEIGHT}"`));
  assert.ok(310 >= SAFE_TOP);
  assert.ok(CONTENT_TOP >= SAFE_TOP);
  assert.ok(FOOTER_TEXT_Y <= SAFE_BOTTOM);
  assert.match(svg, /<g class="safe-content">/);
  assert.match(svg, /<g class="terminal-background"/);
  assert.match(svg, /<tspan[^>]+>AN INTENTIONALLY VERY LONG EVENT TITLE THAT/);
  assert.match(svg, /…<\/tspan>/);
  assert.match(svg, /aria-label="Black monochrome Instagram Story/);
});

test("Story renderer crosses out recent titles and supports a clean background", () => {
  const story = buildInstagramEventStory(catalog([
    event("future", "2027-01-01", "upcoming", "Future"),
    event("recent", "2026-12-01", "archive", "Recent")
  ]));
  const svg = renderInstagramEventStorySvg(story, { background: "none" });

  assert.match(svg, /event-card recent/);
  assert.match(svg, /class="strike"/);
  assert.doesNotMatch(svg, /<g class="terminal-background"/);
  assert.equal(svg, renderInstagramEventStorySvg(story, { background: "none" }));
});

test("title wrapping uses no more than two lines and ellipsizes overflow", () => {
  const lines = wrapText(
    "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen",
    { maxChars: 20, maxLines: 2 }
  );

  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => Array.from(line).length <= 20));
  assert.match(lines[1], /…$/);
});

test("CLI enables only story and keeps post and all as explicit TODOs", () => {
  const {
    parseArguments,
    outputPaths,
    formatEditorialAudit
  } = require("../scripts/generate-instagram-events.js");

  assert.deepEqual(parseArguments([]), {
    out: null,
    background: "terminal",
    format: "story",
    check: false
  });
  assert.equal(parseArguments(["--format", "story", "--check"]).check, true);
  assert.equal(parseArguments(["--background", "none"]).background, "none");
  assert.throws(() => parseArguments(["--format", "post"]), /inactive and tracked as a TODO/);
  assert.throws(() => parseArguments(["--format", "all"]), /inactive and tracked as a TODO/);
  assert.throws(() => parseArguments(["--format", "both"]), /must be story/);
  assert.throws(() => parseArguments(["--today", "2026-08-15"]), /unknown option/);
  assert.match(outputPaths("2026-08-15", null).png, /events-story-2026-08-15-terminal\.png$/);
  assert.match(formatEditorialAudit({ errors: [], warnings: ["Review title"] }), /1 warning/);
});

const canRenderPng = ["rsvg-convert", "magick"].every((command) => {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return result.status === 0;
});

test("CLI writes one 1080 by 1920 Story, SVG, and publishing companion", { skip: !canRenderPng }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-event-story-"));
  const output = path.join(directory, "events-story.png");

  try {
    const result = spawnSync(process.execPath, [
      "scripts/generate-instagram-events.js",
      "--format", "story",
      "--background", "terminal",
      "--out", output
    ], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(output));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".svg")));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".txt")));
    assert.match(result.stdout, /^PNG:/m);
    assert.match(result.stdout, /Accessibility description:/);
    assert.match(fs.readFileSync(output.replace(/\.png$/, ".txt"), "utf8"), /Story text[\s\S]+Link[\s\S]+Accessibility description/);

    const dimensions = spawnSync("magick", ["identify", "-format", "%w x %h", output], {
      encoding: "utf8"
    });
    assert.equal(dimensions.status, 0, dimensions.stderr);
    assert.equal(dimensions.stdout.trim(), "1080 x 1920");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
