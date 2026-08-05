const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildInstagramStory
} = require("../src/_lib/music/buildInstagramStory.js");
const {
  findInstagramContent
} = require("../src/_lib/music/findInstagramContent.js");
const {
  WIDTH,
  HEIGHT,
  wrapText,
  renderInstagramStorySvg
} = require("../src/_lib/music/renderInstagramStorySvg.js");
const {
  parseArguments,
  outputPaths,
  localAssetPath,
  embedStoryImage,
  companionText,
  formatFindResults
} = require("../scripts/generate-instagram.js");

function media(id, groupId, seq = 1, extension = "webp") {
  return {
    id,
    groupId,
    seq,
    alt: `${id} alt`,
    image: {
      variants: {
        "480": { src: `${id}-480.${extension}`, width: 480, height: 600 },
        "960": { src: `${id}-960.${extension}`, width: 960, height: 1200 },
        "1600": { src: `${id}-1600.${extension}`, width: 1600, height: 2000 }
      }
    }
  };
}

function catalogs() {
  return {
    events: {
      defaults: { imagePreset: "upcoming-default" },
      items: [{
        id: "event-one",
        slug: "event_one",
        date: "2027-02-03",
        section: "upcoming",
        title: "Event & One",
        place: "Łódź < Hall",
        coverId: "event-one__01"
      }],
      media: [media("event-one__01", "event-one")]
    },
    mixes: {
      defaults: { imagePreset: "upcoming-default", platformOrder: ["SoundCloud", "YouTube"] },
      items: [
        {
          id: "mix-with-art",
          title: "Mix with art",
          date: "2027-02-03",
          dateEnd: null,
          status: "published",
          platform: "SoundCloud",
          url: "https://example.com/mix",
          duration: "1h",
          genre: "Techno",
          description: null,
          imageId: "mix-with-art__01"
        },
        {
          id: "mix-text-only",
          title: "Text only",
          date: "2027-03",
          dateEnd: null,
          status: "published",
          platform: "YouTube",
          url: "https://example.com/text-only",
          duration: null,
          genre: "Drum & Bass",
          description: null,
          imageId: null
        }
      ],
      media: [media("mix-with-art__01", "mix-with-art")]
    },
    photos: {
      defaults: {},
      items: [{
        id: "photo-set",
        slug: "photo-set",
        date: "2025-03-21",
        title: "Photo set",
        place: "P29",
        eventId: null,
        author: {
          name: "Photographer",
          instagram: "@camera.person",
          facebook: null,
          email: null
        }
      }],
      media: [
        media("photo-set__02", "photo-set", 2),
        media("photo-set__01", "photo-set", 1)
      ]
    }
  };
}

test("buildInstagramStory builds an event without mutating its catalog", () => {
  const input = catalogs();
  const before = structuredClone(input);

  const story = buildInstagramStory(input, { type: "event", id: "event-one" });

  assert.deepEqual(input, before);
  assert.equal(story.type, "event");
  assert.equal(story.image.src, "/assets/music/events/generated/event-one__01-1600.webp");
  assert.equal(story.link, "https://www.fmmaciej.com/music/events/2027-02-03-event-one/");
  assert.match(story.storyText, /3 Feb 2027 — Event & One, Łódź < Hall/);
});

test("buildInstagramStory builds mixes with artwork and a text-only fallback", () => {
  const input = catalogs();
  const withArt = buildInstagramStory(input, { type: "mix", id: "mix-with-art" });
  const textOnly = buildInstagramStory(input, { type: "mix", id: "mix-text-only" });

  assert.equal(withArt.image.src, "/assets/music/mixes/generated/mix-with-art__01-960.webp");
  assert.equal(withArt.link, "https://example.com/mix");
  assert.equal(textOnly.image, null);
  assert.match(textOnly.accessibilityDescription, /text-only Instagram Story/);
  assert.match(textOnly.storyText, /Mar 2027 · Drum & Bass · YouTube/);
});

test("buildInstagramStory resolves a photo and its parent set metadata", () => {
  const story = buildInstagramStory(catalogs(), { type: "photo", id: "photo-set__02" });

  assert.equal(story.title, "Photo set");
  assert.equal(story.image.src, "/assets/music/photos/generated/photo-set__02-1600.webp");
  assert.deepEqual(story.details, ["P29", "PHOTO / @camera.person"]);
  assert.equal(story.link, "https://www.fmmaciej.com/music/photos/#y-2025");
  assert.match(story.storyText, /Photo: @camera.person/);
});

test("buildInstagramStory reports unsupported types and missing ids", () => {
  assert.throws(
    () => buildInstagramStory(catalogs(), { type: "video", id: "anything" }),
    /unsupported story type/
  );
  assert.throws(
    () => buildInstagramStory(catalogs(), { type: "event", id: "missing" }),
    /event not found: missing/
  );
  assert.throws(
    () => buildInstagramStory(catalogs(), { type: "photo" }),
    /story id is required/
  );
});

test("findInstagramContent matches words across fields without case or diacritics", () => {
  const input = catalogs();
  const before = structuredClone(input);

  const matches = findInstagramContent(input, { type: "event", query: "LODZ event" });

  assert.deepEqual(input, before);
  assert.deepEqual(matches.map((item) => item.id), ["event-one"]);
  assert.deepEqual(
    findInstagramContent(input, { type: "event", query: "event-on" }).map((item) => item.id),
    ["event-one"]
  );
  assert.deepEqual(findInstagramContent(input, { type: "event", query: "missing" }), []);
});

test("findInstagramContent lists media ids for photos in sequence order", () => {
  const matches = findInstagramContent(catalogs(), { type: "photo", query: "photographer camera photo" });

  assert.deepEqual(matches.map((item) => item.id), ["photo-set__01", "photo-set__02"]);
  assert.deepEqual(matches.map((item) => item.title), ["Photo set #1", "Photo set #2"]);
  assert.ok(matches.every((item) => item.details === "P29 · Photographer · @camera.person"));
});

test("findInstagramContent keeps the catalogue-specific display order", () => {
  const input = catalogs();
  input.events = {
    defaults: { imagePreset: "upcoming-default" },
    items: [
      { id: "archive-old", slug: "archive-old", date: "2020-01-01", section: "archive", title: "Old", coverId: null },
      { id: "upcoming-late", slug: "upcoming-late", date: "2028-02-01", section: "upcoming", title: "Late", coverId: null },
      { id: "archive-new", slug: "archive-new", date: "2021-01-01", section: "archive", title: "New", coverId: null },
      { id: "upcoming-soon", slug: "upcoming-soon", date: "2028-01-01", section: "upcoming", title: "Soon", coverId: null }
    ],
    media: []
  };

  assert.deepEqual(
    findInstagramContent(input, { type: "event", query: "" }).map((item) => item.id),
    ["upcoming-soon", "upcoming-late", "archive-new", "archive-old"]
  );
  assert.deepEqual(
    findInstagramContent(input, { type: "mix" }).map((item) => item.id),
    ["mix-text-only", "mix-with-art"]
  );
});

test("wrapText limits lines and ellipsizes overflowing copy", () => {
  const lines = wrapText("one two three four five six seven", { maxChars: 10, maxLines: 2 });

  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => Array.from(line).length <= 10));
  assert.match(lines[1], /…$/);
});

test("renderInstagramStorySvg embeds media without cropping and escapes text", () => {
  const story = buildInstagramStory(catalogs(), { type: "event", id: "event-one" });
  story.image.dataUri = "data:image/webp;base64,AAAA";

  const svg = renderInstagramStorySvg(story, { background: "terminal" });

  assert.match(svg, new RegExp(`width="${WIDTH}" height="${HEIGHT}"`));
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(svg, /EVENT &amp; ONE/);
  assert.match(svg, /ŁÓDŹ &lt; HALL/);
  assert.match(svg, /<g class="terminal-background"/);
  assert.equal(svg, renderInstagramStorySvg(story, { background: "terminal" }));
});

test("renderInstagramStorySvg supports a clean text-only layout", () => {
  const story = buildInstagramStory(catalogs(), { type: "mix", id: "mix-text-only" });
  const svg = renderInstagramStorySvg(story, { background: "none" });

  assert.match(svg, /MIX \/ TEXT MODE/);
  assert.doesNotMatch(svg, /<image /);
  assert.doesNotMatch(svg, /<g class="terminal-background"/);
});

test("CLI parser reserves the format position and validates options", () => {
  assert.deepEqual(
    parseArguments(["story", "event", "event-one"]),
    { format: "story", type: "event", id: "event-one", background: "terminal", out: null }
  );
  assert.equal(parseArguments(["story", "photo", "photo-one", "--background", "none"]).background, "none");
  assert.throws(() => parseArguments(["post", "event", "event-one"]), /only story is currently supported/);
  assert.throws(() => parseArguments(["story", "video", "video-one"]), /unsupported story type/);
  assert.throws(() => parseArguments(["story", "event", "..\/event"]), /id may contain only/);
  assert.throws(() => parseArguments(["story", "event", "event-one", "--background", "matrix"]), /none or terminal/);
});

test("CLI parser accepts find queries and rejects generation options", () => {
  assert.deepEqual(
    parseArguments(["find", "event"]),
    { action: "find", type: "event", query: "" }
  );
  assert.deepEqual(
    parseArguments(["find", "mix", "unknown", "stories"]),
    { action: "find", type: "mix", query: "unknown stories" }
  );
  assert.throws(() => parseArguments(["find"]), /requires a content type/);
  assert.throws(() => parseArguments(["find", "video", "clip"]), /unsupported find type/);
  assert.throws(() => parseArguments(["find", "event", "talisa", "--out", "result.png"]), /does not accept options/);
  assert.throws(() => parseArguments(["find", "event", "--background", "none"]), /does not accept options/);
});

test("formatFindResults prints full ids and a successful empty result", () => {
  const records = findInstagramContent(catalogs(), { type: "photo", query: "photo" });
  const table = formatFindResults(records, { type: "photo", query: "photo" });

  assert.match(table, /^ID\s+DATE\s+TITLE\s+DETAILS/m);
  assert.match(table, /photo-set__01\s+2025-03-21\s+Photo set #1\s+P29 · Photographer · @camera\.person/);
  assert.equal(
    formatFindResults([], { type: "event", query: "nothing" }),
    "No event matches for: nothing."
  );
});

test("CLI helpers create companion paths, embed local media, and reject remote media", () => {
  const paths = outputPaths({
    format: "story",
    type: "event",
    id: "event-one",
    background: "terminal",
    out: null
  });
  assert.match(paths.png, /story-event-event-one-terminal\.png$/);
  assert.throws(
    () => outputPaths({ format: "story", type: "event", id: "event-one", background: "none", out: "story.jpg" }),
    /must end with .png/
  );
  assert.match(localAssetPath("/assets/music/fallbacks/upcoming.png"), /src\/assets\/music\/fallbacks\/upcoming\.png$/);
  assert.throws(() => localAssetPath("https://example.com/image.webp"), /must be a local/);

  const embedded = embedStoryImage({
    image: { src: "/assets/music/fallbacks/upcoming.png", alt: "Upcoming" }
  });
  assert.match(embedded.image.dataUri, /^data:image\/png;base64,/);
  assert.equal(embedStoryImage({ image: null }).image, null);
  assert.match(companionText({
    storyText: "Copy",
    link: "https://example.com",
    accessibilityDescription: "Description"
  }), /^Story text\nCopy\n\nLink\nhttps:\/\/example\.com\n\nAccessibility description\nDescription\n$/);
});

const canRenderPng = ["rsvg-convert", "magick"].every((command) => {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return result.status === 0;
});

test("CLI writes a 1080 by 1920 PNG, SVG, and text file", { skip: !canRenderPng }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-story-"));
  const output = path.join(directory, "event.png");

  try {
    const result = spawnSync(process.execPath, [
      "scripts/generate-instagram.js",
      "story",
      "event",
      "20260912__totally_addicted_to_bass_talisa_b-day",
      "--background",
      "none",
      "--out",
      output
    ], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(output));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".svg")));
    assert.ok(fs.existsSync(output.replace(/\.png$/, ".txt")));
    assert.match(fs.readFileSync(output.replace(/\.png$/, ".txt"), "utf8"), /Story text[\s\S]+Accessibility description/);

    const dimensions = spawnSync("magick", ["identify", "-format", "%w x %h", output], {
      encoding: "utf8"
    });
    assert.equal(dimensions.status, 0, dimensions.stderr);
    assert.equal(dimensions.stdout.trim(), "1080 x 1920");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("find CLI prints matches without creating files and treats no matches as success", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-find-"));
  const script = path.resolve(__dirname, "..", "scripts", "generate-instagram.js");

  try {
    const match = spawnSync(process.execPath, [script, "find", "event", "talisa", "lodz"], {
      cwd: directory,
      encoding: "utf8"
    });
    assert.equal(match.status, 0, match.stderr);
    assert.match(match.stdout, /20260912__totally_addicted_to_bass_talisa_b-day/);
    assert.match(match.stdout, /Łódź, Willa/);

    const missing = spawnSync(process.execPath, [script, "find", "photo", "definitely-missing"], {
      cwd: directory,
      encoding: "utf8"
    });
    assert.equal(missing.status, 0, missing.stderr);
    assert.match(missing.stdout, /No photo matches for: definitely-missing\./);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
