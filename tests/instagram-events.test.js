const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildInstagramEventPost,
  buildInstagramCaption,
  buildInstagramAltText
} = require("../src/_lib/music/buildInstagramEventPost.js");
const {
  HEIGHT,
  WIDTH,
  renderInstagramEventsSvg
} = require("../src/_lib/music/renderInstagramEventsSvg.js");

function event(id, date, section, title, place = null) {
  return { id, date, section, title, place };
}

test("buildInstagramEventPost sorts, limits, and fills the post with recent events", () => {
  const catalog = {
    items: [
      event("four", "2027-04-04", "upcoming", "Four"),
      event("two", "2027-02-02", "upcoming", "Two", "Łódź"),
      event("one", "2027-01-01", "upcoming", "One"),
      event("three", "2027-03-03", "upcoming", "Three"),
      event("five", "2027-05-05", "upcoming", "Five"),
      event("recent-old", "2026-01-01", "archive", "Old"),
      event("recent-new", "2026-02-02", "archive", "New"),
      event("future-archive", "2027-06-06", "archive", "Future")
    ]
  };
  const before = structuredClone(catalog);

  const post = buildInstagramEventPost(catalog, { today: "2026-03-01" });

  assert.deepEqual(catalog, before);
  assert.deepEqual(post.upcoming.map((item) => item.id), ["one", "two", "three", "four"]);
  assert.equal(post.recent.length, 0);
  assert.equal(post.upcoming[0].place, "LOCATION TBA");
  assert.equal(post.upcoming[1].place, "Łódź");
});

test("buildInstagramEventPost marks the latest archive entries as recent", () => {
  const post = buildInstagramEventPost({
    items: [
      event("upcoming", "2027-04-04", "upcoming", "Future"),
      event("older", "2026-01-01", "archive", "Older", "Club"),
      event("latest", "2026-02-02", "archive", "Latest", "Hall"),
      event("not-yet", "2026-04-04", "archive", "Not yet")
    ]
  }, { today: "2026-03-01" });

  assert.deepEqual(post.recent.map((item) => item.id), ["latest", "older"]);
  assert.ok(post.recent.every((item) => item.isRecent));
  assert.deepEqual(post.recent.map((item) => item.place), ["Hall", "Club"]);
  assert.match(buildInstagramCaption(post), /4 Apr 2027 — Future, LOCATION TBA/);
  assert.match(buildInstagramAltText(post), /shown crossed out/);
});

test("buildInstagramEventPost allows an empty calendar and validates dates", () => {
  const post = buildInstagramEventPost({ items: [] }, { today: "2026-03-01" });
  assert.deepEqual(post.entries, []);
  assert.match(buildInstagramCaption(post), /No upcoming dates/);
  assert.throws(
    () => buildInstagramEventPost({ items: [] }, { today: "2026-02-30" }),
    /real calendar date/
  );
});

test("renderInstagramEventsSvg escapes event copy and preserves the Instagram dimensions", () => {
  const post = buildInstagramEventPost({
    items: [event("drum", "2027-02-02", "upcoming", "Drum & Bass", "A < B")]
  }, { today: "2026-03-01" });
  const svg = renderInstagramEventsSvg(post);

  assert.match(svg, new RegExp(`width=\"${WIDTH}\" height=\"${HEIGHT}\"`));
  assert.match(svg, /DRUM &amp; BASS/);
  assert.match(svg, /A &lt; B/);
});

test("renderInstagramEventsSvg adds a deterministic terminal background only when requested", () => {
  const post = buildInstagramEventPost({
    items: [event("drum", "2027-02-02", "upcoming", "Drum & Bass", "Łódź")]
  }, { today: "2026-03-01" });

  const plain = renderInstagramEventsSvg(post);
  const terminal = renderInstagramEventsSvg(post, { background: "terminal" });

  assert.doesNotMatch(plain, /<g class="terminal-background"/);
  assert.match(terminal, /<g class="terminal-background"[^>]+filter="url\(#terminal-background-blur\)"/);
  assert.match(terminal, /terminal-background[^}]+opacity: .16/);
  assert.match(terminal, /<feGaussianBlur stdDeviation="1.1"\/>/);
  assert.match(terminal, /Drum &amp; Bass/);
  assert.match(buildInstagramAltText(post, { background: "terminal" }), /terminal transcript/);
});

test("renderInstagramEventsSvg keeps an archive event place visible", () => {
  const post = buildInstagramEventPost({
    items: [
      event("upcoming", "2027-02-02", "upcoming", "Future"),
      event("recent", "2026-02-01", "archive", "Recent", "Club Hall")
    ]
  }, { today: "2026-03-01" });

  const svg = renderInstagramEventsSvg(post);

  assert.match(svg, /Club Hall/);
});

test("CLI options default to the terminal background and allow a clean override", () => {
  const { parseArguments, outputPaths } = require("../scripts/generate-instagram-events.js");

  assert.equal(parseArguments([]).background, "terminal");
  assert.equal(parseArguments(["--background", "terminal"]).background, "terminal");
  assert.equal(parseArguments(["--background", "none"]).background, "none");
  assert.throws(() => parseArguments(["--background", "matrix"]), /none or terminal/);
  assert.match(outputPaths("2026-08-05", null).png, /events-2026-08-05-terminal\.png$/);
  assert.match(outputPaths("2026-08-05", null, "terminal").png, /events-2026-08-05-terminal\.png$/);
});

const canRenderPng = ["rsvg-convert", "magick"].every((command) => {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return result.status === 0;
});

test("CLI writes a 1080 by 1350 PNG, SVG, and text file", { skip: !canRenderPng }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-events-"));
  const output = path.join(directory, "events.png");

  try {
    const result = spawnSync(process.execPath, [
      "scripts/generate-instagram-events.js", "--today", "2026-08-05", "--background", "terminal", "--out", output
    ], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(output));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".svg")));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".txt")));

    const dimensions = spawnSync("magick", ["identify", "-format", "%w x %h", output], {
      encoding: "utf8"
    });
    assert.equal(dimensions.status, 0, dimensions.stderr);
    assert.equal(dimensions.stdout.trim(), "1080 x 1350");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
