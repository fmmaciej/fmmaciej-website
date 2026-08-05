#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  buildInstagramEventPost,
  buildInstagramCaption,
  buildInstagramAltText
} = require("../src/_lib/music/buildInstagramEventPost.js");
const {
  renderInstagramEventsSvg
} = require("../src/_lib/music/renderInstagramEventsSvg.js");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const EVENTS_PATH = path.join(REPOSITORY_ROOT, "src", "_data", "music", "events.json");

function todayInWarsaw(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function usage() {
  return [
    "Usage: node scripts/generate-instagram-events.js [--today YYYY-MM-DD] [--background terminal|none] [--out path.png]",
    "",
    "Reads src/_data/music/events.json and writes PNG, SVG, and caption text."
  ].join("\n");
}

function parseArguments(argv) {
  const options = { today: null, out: null, background: "terminal" };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--today" || argument === "--out" || argument === "--background") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new TypeError(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new TypeError(`unknown option: ${argument}`);
  }

  if (!new Set(["none", "terminal"]).has(options.background)) {
    throw new TypeError("--background must be either none or terminal");
  }

  return options;
}

function outputPaths(today, out, background = "terminal") {
  const png = out
    ? path.resolve(process.cwd(), out)
    : path.join(
      REPOSITORY_ROOT,
      "tmp",
      "instagram",
      `events-${today}${background === "terminal" ? "-terminal" : ""}.png`
    );
  if (path.extname(png).toLowerCase() !== ".png") {
    throw new TypeError("--out must end with .png");
  }

  const basename = png.slice(0, -4);
  return { png, svg: `${basename}.svg`, text: `${basename}.txt` };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const today = options.today || todayInWarsaw();
  const catalog = JSON.parse(fs.readFileSync(EVENTS_PATH, "utf8"));
  const post = buildInstagramEventPost(catalog, { today });
  const paths = outputPaths(today, options.out, options.background);
  const caption = buildInstagramCaption(post);
  const altText = buildInstagramAltText(post, { background: options.background });

  fs.mkdirSync(path.dirname(paths.png), { recursive: true });
  fs.writeFileSync(paths.svg, renderInstagramEventsSvg(post, { background: options.background }), "utf8");
  fs.writeFileSync(paths.text, `Caption\n${caption}\n\nAlt text\n${altText}\n`, "utf8");

  try {
    execFileSync("rsvg-convert", ["--output", paths.png, paths.svg], { stdio: "pipe" });
  } catch (error) {
    const reason = error.code === "ENOENT"
      ? "rsvg-convert is required to export PNG files. Install librsvg and try again."
      : (error.stderr || error.message).toString().trim();
    throw new Error(`Could not render Instagram PNG: ${reason}`);
  }

  process.stdout.write([
    `PNG: ${paths.png}`,
    `SVG: ${paths.svg}`,
    `Text: ${paths.text}`,
    "",
    caption,
    "",
    `Alt text: ${altText}`
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
  parseArguments,
  outputPaths,
  todayInWarsaw
};
