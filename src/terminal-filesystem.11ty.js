const fs = require("node:fs");
const buildTerminalFilesystem = require("./_lib/terminal/buildTerminalFilesystem.js");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() + "\n" : "";
}

function stripFrontmatter(value) {
  return String(value || "").replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

module.exports = class TerminalFilesystemTemplate {
  data() {
    return {
      permalink: "/assets/terminal/filesystem.json",
      eleventyExcludeFromCollections: true
    };
  }

  render(data) {
    const posts = (data.collections?.blog || []).map((post) => ({
      title: post.data.title,
      description: post.data.description || "",
      date: post.date,
      slug: post.fileSlug,
      url: post.url,
      content: stripFrontmatter(post.rawInput)
    }));

    const manifest = buildTerminalFilesystem({
      about: readText("src/me/_content/me.md"),
      contact: "fm@fmmaciej.com\n",
      cv: [
        {
          name: "cv-en.pdf",
          url: "https://raw.githubusercontent.com/fmmaciej/fmmaciej-cv/main/build/cv-organisciak-maciej-en.pdf"
        },
        {
          name: "cv-pl.pdf",
          url: "https://raw.githubusercontent.com/fmmaciej/fmmaciej-cv/main/build/cv-organisciak-maciej-pl.pdf"
        }
      ],
      links: [
        { name: "github", url: "https://github.com/fmmaciej" },
        { name: "linkedin", url: "https://www.linkedin.com/in/organisciak-maciej/" },
        { name: "stackoverflow", url: "https://stackoverflow.com/users/8387639/maciej-fm" },
        { name: "resident-advisor", url: "https://pl.ra.co/dj/fmpl" },
        { name: "instagram", url: "https://instagram.com/fmmaciej" },
        { name: "mixcloud", url: "https://www.mixcloud.com/fmmaciej" },
        { name: "soundcloud", url: "https://www.soundcloud.com/fmmaciej" }
      ],
      projects: data.projects?.items || [],
      posts,
      puzzles: data.terminalPuzzles,
      music: {
        intro: [readText("src/music/_content/intro/index.md"), readText("src/music/_content/outro/index.md")].join("\n"),
        bio: [readText("src/music/_content/intro/bio.md"), readText("src/music/_content/pages/bio.md")].join("\n"),
        rider: [readText("src/music/_content/intro/rider.md"), readText("src/music/_content/pages/rider.md")].join("\n"),
        links: data.music?.links || [],
        events: data.eventData?.all || [],
        mixes: [
          ...(data.mixData?.upcomingItems || []),
          ...(data.mixData?.archiveItems || [])
        ],
        photos: data.photoData?.sets || []
      }
    });

    return JSON.stringify(manifest, null, 2);
  }
};
