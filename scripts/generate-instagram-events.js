#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  CALENDAR_URL,
  auditInstagramEventCatalog,
  buildInstagramEventStory,
  buildInstagramStoryText,
  buildInstagramStoryAltText
} = require("../src/_lib/music/buildInstagramEventStory.js");
const {
  renderInstagramEventStorySvg
} = require("../src/_lib/music/renderInstagramEventStorySvg.js");

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
    "Usage: node scripts/generate-instagram-events.js [--format story] [--background terminal|none] [--out path.png] [--check]",
    "",
    "Generates one 1080 by 1920 Story calendar with 4 to 6 events.",
    "Fewer than 4 upcoming events are filled with recent, crossed-out events when available.",
    "The post and all formats are inactive TODOs."
  ].join("\n");
}

function parseArguments(argv) {
  const options = { out: null, background: "terminal", format: "story", check: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--check") {
      options.check = true;
      continue;
    }
    if (argument === "--out" || argument === "--background" || argument === "--format") {
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
  if (options.format === "post" || options.format === "all") {
    throw new TypeError(`--format ${options.format} is inactive and tracked as a TODO; use story`);
  }
  if (options.format !== "story") {
    throw new TypeError("--format must be story");
  }

  return options;
}

function outputPaths(date, out, background = "terminal") {
  const png = out
    ? path.resolve(process.cwd(), out)
    : path.join(
      REPOSITORY_ROOT,
      "tmp",
      "instagram",
      `events-story-${date}${background === "terminal" ? "-terminal" : ""}.png`
    );
  if (path.extname(png).toLowerCase() !== ".png") {
    throw new TypeError("--out must end with .png");
  }

  const basename = png.slice(0, -4);
  return { png, svg: `${basename}.svg`, text: `${basename}.txt` };
}

function formatEditorialAudit(audit) {
  const lines = [
    `Editorial check: ${audit.errors.length} error(s), ${audit.warnings.length} warning(s).`
  ];
  audit.errors.forEach((message) => lines.push(`ERROR: ${message}`));
  audit.warnings.forEach((message) => lines.push(`WARNING: ${message}`));
  return lines.join("\n");
}

function renderPng(paths, svg) {
  fs.mkdirSync(path.dirname(paths.png), { recursive: true });
  fs.writeFileSync(paths.svg, svg, "utf8");

  try {
    execFileSync("rsvg-convert", ["--output", paths.png, paths.svg], { stdio: "pipe" });
  } catch (error) {
    const reason = error.code === "ENOENT"
      ? "rsvg-convert is required to export PNG files. Install librsvg and try again."
      : (error.stderr || error.message).toString().trim();
    throw new Error(`Could not render Instagram Story PNG: ${reason}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const catalog = JSON.parse(fs.readFileSync(EVENTS_PATH, "utf8"));
  const audit = auditInstagramEventCatalog(catalog);
  const auditText = formatEditorialAudit(audit);

  if (options.check) {
    process.stdout.write(`${auditText}\n`);
    if (audit.errors.length) process.exitCode = 1;
    return;
  }
  if (audit.errors.length) throw new TypeError(auditText);
  if (audit.warnings.length) process.stderr.write(`${auditText}\n`);

  const story = buildInstagramEventStory(catalog);
  const storyText = buildInstagramStoryText(story);
  const altText = buildInstagramStoryAltText(story, { background: options.background });
  const paths = outputPaths(todayInWarsaw(), options.out, options.background);

  fs.mkdirSync(path.dirname(paths.png), { recursive: true });
  fs.writeFileSync(paths.text, [
    "Story text",
    storyText,
    "",
    "Link",
    CALENDAR_URL,
    "",
    "Accessibility description",
    altText,
    ""
  ].join("\n"), "utf8");
  renderPng(
    paths,
    renderInstagramEventStorySvg(story, { background: options.background, altText })
  );

  process.stdout.write([
    `PNG: ${paths.png}`,
    `SVG: ${paths.svg}`,
    `Text: ${paths.text}`,
    "",
    storyText,
    "",
    `Link: ${CALENDAR_URL}`,
    "",
    `Accessibility description: ${altText}`
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
  outputPaths,
  formatEditorialAudit,
  todayInWarsaw
};
