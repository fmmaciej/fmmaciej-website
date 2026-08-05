#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildInstagramStory } = require("../src/_lib/music/buildInstagramStory.js");
const { findInstagramContent } = require("../src/_lib/music/findInstagramContent.js");
const { renderInstagramStorySvg } = require("../src/_lib/music/renderInstagramStorySvg.js");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const CATALOG_NAMES = {
  event: "events",
  mix: "mixes",
  photo: "photos"
};
const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function usage() {
  return [
    "Usage:",
    "  node scripts/generate-instagram.js story <event|mix|photo> <id> [--background terminal|none] [--out path.png]",
    "  node scripts/generate-instagram.js find <event|mix|photo> [query...]",
    "",
    "Examples:",
    "  npm run generate:instagram -- story event 20260912__totally_addicted_to_bass_talisa_b-day",
    "  npm run generate:instagram -- story mix unknown-stories-with-fm",
    "  npm run generate:instagram -- story photo 20250321__subterra__01",
    "  npm run generate:instagram -- find event talisa",
    "  npm run generate:instagram -- find mix \"unknown stories\"",
    "  npm run generate:instagram -- find photo subterra",
    "  npm run generate:instagram -- find event",
    "",
    "The story command writes a 1080 by 1920 PNG, its source SVG, and a text publishing companion.",
    "The find command only prints matching catalogue ids."
  ].join("\n");
}

function parseStoryArguments(argv) {
  const positional = [];
  const options = { background: "terminal", out: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--background" || argument === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new TypeError(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) throw new TypeError(`unknown option: ${argument}`);
    positional.push(argument);
  }

  if (positional.length !== 3) {
    throw new TypeError("expected a format, content type, and id");
  }

  const [format, type, id] = positional;
  if (format !== "story") throw new TypeError(`unsupported format: ${format} (only story is currently supported)`);
  if (!Object.hasOwn(CATALOG_NAMES, type)) {
    throw new TypeError(`unsupported story type: ${type}`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new TypeError("id may contain only letters, digits, underscores, and hyphens");
  }
  if (!new Set(["none", "terminal"]).has(options.background)) {
    throw new TypeError("--background must be either none or terminal");
  }

  return { ...options, format, type, id };
}

function parseFindArguments(argv) {
  if (argv.length < 2) throw new TypeError("find requires a content type");

  const [, type, ...queryParts] = argv;
  if (!Object.hasOwn(CATALOG_NAMES, type)) {
    throw new TypeError(`unsupported find type: ${type}`);
  }
  const option = queryParts.find((part) => part.startsWith("-"));
  if (option) throw new TypeError(`find does not accept options: ${option}`);

  return {
    action: "find",
    type,
    query: queryParts.join(" ").trim()
  };
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  if (argv[0] === "find") return parseFindArguments(argv);
  return parseStoryArguments(argv);
}

function outputPaths(options) {
  const png = options.out
    ? path.resolve(process.cwd(), options.out)
    : path.join(
      REPOSITORY_ROOT,
      "tmp",
      "instagram",
      `${options.format}-${options.type}-${options.id}${options.background === "terminal" ? "-terminal" : ""}.png`
    );

  if (path.extname(png).toLowerCase() !== ".png") {
    throw new TypeError("--out must end with .png");
  }

  const basename = png.slice(0, -4);
  return { png, svg: `${basename}.svg`, text: `${basename}.txt` };
}

function loadCatalog(type) {
  const name = CATALOG_NAMES[type];
  const catalogPath = path.join(REPOSITORY_ROOT, "src", "_data", "music", `${name}.json`);
  return { [name]: JSON.parse(fs.readFileSync(catalogPath, "utf8")) };
}

function localAssetPath(publicUrl) {
  if (typeof publicUrl !== "string" || !publicUrl.startsWith("/assets/")) {
    throw new TypeError(`story image must be a local /assets/ URL: ${publicUrl}`);
  }

  const sourceRoot = path.join(REPOSITORY_ROOT, "src");
  const assetPath = path.resolve(sourceRoot, publicUrl.slice(1));
  const relative = path.relative(sourceRoot, assetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TypeError(`story image resolves outside src: ${publicUrl}`);
  }
  return assetPath;
}

function embedStoryImage(story) {
  if (!story.image) return story;

  const assetPath = localAssetPath(story.image.src);
  const extension = path.extname(assetPath).toLowerCase();
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) throw new TypeError(`unsupported story image format: ${extension || "(none)"}`);
  if (!fs.existsSync(assetPath)) throw new Error(`story image does not exist: ${assetPath}`);

  return {
    ...story,
    image: {
      ...story.image,
      dataUri: `data:${mimeType};base64,${fs.readFileSync(assetPath).toString("base64")}`
    }
  };
}

function companionText(story) {
  return [
    "Story text",
    story.storyText,
    "",
    "Link",
    story.link,
    "",
    "Accessibility description",
    story.accessibilityDescription,
    ""
  ].join("\n");
}

function formatFindResults(records, options = {}) {
  if (!records.length) {
    const suffix = options.query ? ` for: ${options.query}` : "";
    return `No ${options.type} matches${suffix}.`;
  }

  const headers = ["ID", "DATE", "TITLE", "DETAILS"];
  const rows = records.map((record) => [
    String(record.id || ""),
    String(record.date || ""),
    String(record.title || ""),
    String(record.details || "")
  ]);
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => row[index].length)
  ));
  const formatRow = (row) => row.map((value, index) => (
    index === row.length - 1 ? value : value.padEnd(widths[index] + 2)
  )).join("").trimEnd();

  return [
    formatRow(headers),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow)
  ].join("\n");
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (options.action === "find") {
    const records = findInstagramContent(loadCatalog(options.type), options);
    process.stdout.write(`${formatFindResults(records, options)}\n`);
    return;
  }

  const story = embedStoryImage(buildInstagramStory(loadCatalog(options.type), options));
  const paths = outputPaths(options);
  const svg = renderInstagramStorySvg(story, { background: options.background });

  fs.mkdirSync(path.dirname(paths.png), { recursive: true });
  fs.writeFileSync(paths.svg, svg, "utf8");
  fs.writeFileSync(paths.text, companionText(story), "utf8");

  try {
    execFileSync("rsvg-convert", ["--output", paths.png, paths.svg], { stdio: "pipe" });
  } catch (error) {
    const reason = error.code === "ENOENT"
      ? "rsvg-convert is required to export PNG files. Install librsvg and try again."
      : (error.stderr || error.message).toString().trim();
    throw new Error(`Could not render Instagram Story PNG: ${reason}`);
  }

  process.stdout.write([
    `PNG: ${paths.png}`,
    `SVG: ${paths.svg}`,
    `Text: ${paths.text}`,
    "",
    story.storyText,
    "",
    `Link: ${story.link}`,
    "",
    `Accessibility description: ${story.accessibilityDescription}`
  ].join("\n") + "\n");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  usage,
  parseArguments,
  parseFindArguments,
  outputPaths,
  localAssetPath,
  embedStoryImage,
  companionText,
  formatFindResults
};
