const crypto = require("node:crypto");
const path = require("node:path");

const SYSTEM_DATE = "2026-01-01T00:00:00.000Z";
const FM_DATE = "2026-03-10T00:00:00.000Z";

function normalizeFsPath(value) {
  if (!value) return "/";
  const normalized = path.posix.normalize(value.startsWith("/") ? value : `/${value}`);
  return normalized === "." ? "/" : normalized;
}

function slugify(value) {
  return String(value || "item")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function textSize(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function buildTerminalFilesystem(input = {}) {
  const source = structuredClone(input);
  const entries = new Map();

  function add(entry) {
    const fsPath = normalizeFsPath(entry.path);
    const normalized = {
      path: fsPath,
      type: entry.type,
      mode: entry.mode,
      owner: entry.owner || "root",
      group: entry.group || entry.owner || "root",
      modified: entry.modified || SYSTEM_DATE
    };

    ["content", "target", "route", "openUrl", "download", "deviceBehavior"].forEach((key) => {
      if (entry[key] !== undefined && entry[key] !== null) normalized[key] = entry[key];
    });

    if (entry.type === "file" || entry.type === "executable") {
      normalized.size = textSize(entry.content);
    } else if (entry.type === "symlink") {
      normalized.size = textSize(entry.target);
    } else {
      normalized.size = 0;
    }

    entries.set(fsPath, normalized);
    return normalized;
  }

  function directory(fsPath, options = {}) {
    return add({
      path: fsPath,
      type: "directory",
      mode: options.mode || "dr-xr-xr-x",
      ...options
    });
  }

  function file(fsPath, content, options = {}) {
    return add({
      path: fsPath,
      type: "file",
      mode: options.mode || "-r--r--r--",
      content: String(content || ""),
      ...options
    });
  }

  function executable(fsPath, options = {}) {
    return add({
      path: fsPath,
      type: "executable",
      mode: "-r-xr-xr-x",
      content: options.content || "",
      ...options
    });
  }

  function symlink(fsPath, target, options = {}) {
    return add({
      path: fsPath,
      type: "symlink",
      mode: "lrwxrwxrwx",
      target,
      ...options
    });
  }

  function device(fsPath, deviceBehavior) {
    return add({
      path: fsPath,
      type: "device",
      mode: "crw-rw-rw-",
      owner: "root",
      group: "tty",
      deviceBehavior
    });
  }

  directory("/", { mode: "dr-xr-xr-x" });
  [
    "/bin", "/boot", "/dev", "/etc", "/home", "/lib", "/lib64", "/media", "/mnt",
    "/opt", "/proc", "/run", "/sbin", "/srv", "/sys", "/tmp", "/usr", "/usr/bin",
    "/usr/lib", "/usr/local", "/usr/local/bin", "/usr/share", "/var", "/var/cache",
    "/var/lib", "/var/log", "/var/tmp"
  ].forEach((fsPath) => directory(fsPath));
  directory("/root", { mode: "dr-x------" });

  file("/etc/hostname", "void\n");
  file("/etc/motd", "fmmaciej.com virtual shell\nRead-only portfolio filesystem. Type help to begin.\n");
  file("/etc/os-release", [
    'NAME="Void"',
    'ID="void"',
    'PRETTY_NAME="Void Linux (portfolio edition)"',
    'HOME_URL="https://voidlinux.org/"',
    ""
  ].join("\n"));
  file("/etc/passwd", [
    "root:x:0:0:root:/root:/bin/sh",
    "fm:x:1000:1000:FM:/home/fm:/bin/sh",
    ""
  ].join("\n"));
  file("/etc/shells", "/bin/sh\n/bin/bash\n");
  file("/etc/shadow", "", { mode: "-r--------" });

  file("/proc/version", "Linux version 6.10.12_1 (void@fmmaciej.com) #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n");
  file("/proc/cpuinfo", "processor\t: 0\nmodel name\t: Virtual portfolio CPU\ncpu cores\t: 1\n\n");
  file("/proc/uptime", "86400.00 82000.00\n");
  file("/var/log/boot.log", "[ OK ] runit: portfolio filesystem mounted read-only\n[ OK ] terminal: idle animator ready\n[ OK ] shell: deterministic commands ready\n");
  file("/var/log/site.log", "fmmaciej.com — served plain & simple\n");

  device("/dev/null", "null");
  device("/dev/tty", "unsupported");
  device("/dev/zero", "unsupported");
  device("/dev/random", "unsupported");

  const commands = ["cat", "clear", "help", "history", "hostname", "ls", "open", "pwd", "uname", "whoami"];
  commands.forEach((command) => {
    executable(`/usr/bin/${command}`);
    symlink(`/bin/${command}`, `/usr/bin/${command}`);
  });
  ["cd", "exit"].forEach((command) => executable(`/usr/bin/${command}`));
  symlink("/bin/sh", "/usr/bin/sh");
  executable("/usr/bin/sh");
  executable("/usr/local/bin/open");

  directory("/home/fm", { owner: "fm", group: "fm", modified: FM_DATE, route: "/" });
  directory("/home/fm/.config", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.profile", "export EDITOR=vim\nexport PAGER=less\n", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.gitconfig", "[user]\n\tname = FM\n[init]\n\tdefaultBranch = main\n", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.config/terminal.conf", "mode=portfolio\nfilesystem=read-only\n", { owner: "fm", group: "fm", modified: FM_DATE });

  file("/home/fm/about.md", source.about || "", {
    owner: "fm", group: "fm", modified: FM_DATE, route: "/", openUrl: "/"
  });
  file("/home/fm/contact.txt", source.contact || "fm@fmmaciej.com\n", {
    owner: "fm", group: "fm", modified: FM_DATE, openUrl: "mailto:fm@fmmaciej.com"
  });

  directory("/home/fm/cv", { owner: "fm", group: "fm", route: "/" });
  (source.cv || []).forEach((item) => {
    file(`/home/fm/cv/${item.name}`, `${item.url}\n`, {
      owner: "fm", group: "fm", openUrl: item.url, download: true, modified: item.modified || FM_DATE
    });
  });

  directory("/home/fm/links", { owner: "fm", group: "fm" });
  (source.links || []).forEach((item) => {
    file(`/home/fm/links/${slugify(item.name)}.url`, `${item.url}\n`, {
      owner: "fm", group: "fm", openUrl: item.url, modified: FM_DATE
    });
  });

  directory("/home/fm/projects", { owner: "fm", group: "fm", route: "/projects/" });
  (source.projects || []).forEach((project) => {
    const projectSlug = slugify(project.name);
    const projectPath = `/home/fm/projects/${projectSlug}`;
    const modified = `${project.year || 2020}-01-01T00:00:00.000Z`;
    const primaryUrl = project.links?.docs || project.links?.repo || project.links?.download;
    const readme = [
      `# ${project.name}`,
      "",
      project.desc || "",
      "",
      `Status: ${project.status || "Unknown"}`,
      `Year: ${project.year || "Unknown"}`,
      ""
    ].join("\n");

    directory(projectPath, {
      owner: "fm", group: "fm", modified, route: `/projects/#${projectSlug}`, openUrl: primaryUrl
    });
    file(`${projectPath}/README.md`, readme, {
      owner: "fm", group: "fm", modified, route: `/projects/#${projectSlug}`, openUrl: primaryUrl
    });
    file(`${projectPath}/stack.txt`, `${(project.stack || []).join("\n")}\n`, { owner: "fm", group: "fm", modified });
    file(`${projectPath}/status.txt`, `${project.status || "Unknown"}\n`, { owner: "fm", group: "fm", modified });
    directory(`${projectPath}/links`, { owner: "fm", group: "fm", modified });
    Object.entries(project.links || {}).forEach(([name, url]) => {
      file(`${projectPath}/links/${slugify(name)}.url`, `${url}\n`, {
        owner: "fm", group: "fm", modified, openUrl: url, download: name === "download"
      });
    });
  });

  directory("/home/fm/blog", { owner: "fm", group: "fm", route: "/blog/" });
  (source.posts || []).forEach((post) => {
    const postSlug = slugify(post.slug || post.title);
    const modified = new Date(post.date || FM_DATE).toISOString();
    const body = [
      `# ${post.title}`,
      post.description ? `\n${post.description}\n` : "",
      post.content || ""
    ].filter(Boolean).join("\n").trim() + "\n";
    file(`/home/fm/blog/${postSlug}.md`, body, {
      owner: "fm", group: "fm", modified, route: post.url, openUrl: post.url
    });
  });

  const music = source.music || {};
  directory("/home/fm/music", { owner: "fm", group: "fm", route: "/music/" });
  ["bio", "rider", "events", "mixes", "photos", "links"].forEach((section) => {
    directory(`/home/fm/music/${section}`, {
      owner: "fm", group: "fm", route: `/music/${section}/`
    });
  });
  file("/home/fm/music/README.md", music.intro || "", { owner: "fm", group: "fm", route: "/music/", openUrl: "/music/" });
  file("/home/fm/music/bio/README.md", music.bio || "", { owner: "fm", group: "fm", route: "/music/bio/", openUrl: "/music/bio/" });
  file("/home/fm/music/rider/README.md", music.rider || "", { owner: "fm", group: "fm", route: "/music/rider/", openUrl: "/music/rider/" });

  (music.links || []).forEach((item) => {
    file(`/home/fm/music/links/${slugify(item.slug)}.url`, `${item.url}\n# ${item.comment || ""}\n`, {
      owner: "fm", group: "fm", openUrl: item.url
    });
  });

  (music.events || []).forEach((event) => {
    const eventSlug = `${event.date || "unknown"}--${slugify(event.slug || event.title)}`;
    const eventPath = `/home/fm/music/events/${eventSlug}`;
    const modified = new Date(`${event.date || "2020-01-01"}T00:00:00.000Z`).toISOString();
    directory(eventPath, { owner: "fm", group: "fm", modified, route: event.path, openUrl: event.path });
    file(`${eventPath}/README.md`, [
      `# ${event.title || event.name}`,
      "",
      `Date: ${event.date || "Unknown"}`,
      event.place ? `Place: ${event.place}` : "",
      `Materials: ${event.count || 0}`,
      ""
    ].filter(Boolean).join("\n"), { owner: "fm", group: "fm", modified, route: event.path, openUrl: event.path });
    (event.items || []).filter((item) => !item.fallback).forEach((item) => {
      const imageUrl = item.display1600 || item.thumb960 || item.thumb480;
      if (!imageUrl) return;
      const name = imageUrl.split("/").pop() || `${slugify(item.id)}.webp`;
      file(`${eventPath}/${name}`, `${imageUrl}\n`, { owner: "fm", group: "fm", modified, openUrl: imageUrl });
    });
  });

  (music.mixes || []).forEach((mix) => {
    const mixSlug = `${mix.date || "unknown"}--${slugify(mix.id || mix.title)}`;
    const mixPath = `/home/fm/music/mixes/${mixSlug}`;
    const modified = new Date(`${String(mix.date || "2020-01-01").padEnd(10, "-01").replace(/-01-01-01$/, "-01-01")}T00:00:00.000Z`);
    const safeModified = Number.isNaN(modified.valueOf()) ? FM_DATE : modified.toISOString();
    directory(mixPath, { owner: "fm", group: "fm", modified: safeModified, route: "/music/mixes/", openUrl: mix.url || "/music/mixes/" });
    file(`${mixPath}/README.md`, [
      `# ${mix.title}`,
      "",
      `Date: ${mix.displayDate || mix.date || "Unknown"}`,
      mix.duration ? `Duration: ${mix.duration}` : "",
      mix.genre ? `Genre: ${mix.genre}` : "",
      mix.platform ? `Platform: ${mix.platform}` : "",
      mix.status ? `Status: ${mix.status}` : "",
      mix.description || "",
      ""
    ].filter(Boolean).join("\n"), { owner: "fm", group: "fm", modified: safeModified, route: "/music/mixes/", openUrl: mix.url || "/music/mixes/" });
    if (mix.url) file(`${mixPath}/listen.url`, `${mix.url}\n`, { owner: "fm", group: "fm", modified: safeModified, openUrl: mix.url });
    if (mix.img) {
      const name = mix.img.split("/").pop() || "cover.webp";
      file(`${mixPath}/${name}`, `${mix.img}\n`, { owner: "fm", group: "fm", modified: safeModified, openUrl: mix.img });
    }
  });

  (music.photos || []).forEach((set) => {
    const setSlug = `${set.date || "unknown"}--${slugify(set.slug || set.title)}`;
    const setPath = `/home/fm/music/photos/${setSlug}`;
    const modified = new Date(`${set.date || "2020-01-01"}T00:00:00.000Z`).toISOString();
    directory(setPath, { owner: "fm", group: "fm", modified, route: "/music/photos/", openUrl: "/music/photos/" });
    file(`${setPath}/README.md`, [
      `# ${set.title}`,
      "",
      `Date: ${set.date}`,
      set.place ? `Place: ${set.place}` : "",
      set.authorInfo?.name ? `Author: ${set.authorInfo.name}` : "",
      `Photos: ${set.count || 0}`,
      ""
    ].filter(Boolean).join("\n"), { owner: "fm", group: "fm", modified, route: "/music/photos/", openUrl: "/music/photos/" });
    (set.photos || []).forEach((photo) => {
      const imageUrl = photo.display1600 || photo.thumb960 || photo.thumb480;
      if (!imageUrl) return;
      const name = imageUrl.split("/").pop() || `${slugify(photo.id)}.webp`;
      file(`${setPath}/${name}`, `${imageUrl}\n`, { owner: "fm", group: "fm", modified, openUrl: imageUrl });
    });
  });

  const allEntries = Array.from(entries.values());
  allEntries
    .filter((entry) => entry.type === "directory")
    .sort((a, b) => b.path.length - a.path.length)
    .forEach((entry) => {
      const prefix = entry.path === "/" ? "/" : `${entry.path}/`;
      const latestChild = allEntries
        .filter((candidate) => candidate.path.startsWith(prefix) && candidate.path !== entry.path)
        .map((candidate) => candidate.modified)
        .filter(Boolean)
        .sort()
        .pop();
      if (latestChild && latestChild > entry.modified) entry.modified = latestChild;
    });

  const ordered = allEntries.sort((a, b) => a.path.localeCompare(b.path));
  const contentId = crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex").slice(0, 16);

  return {
    schemaVersion: 1,
    contentId,
    user: { name: "fm", group: "fm", host: "void", home: "/home/fm" },
    entries: ordered
  };
}

module.exports = buildTerminalFilesystem;
module.exports.slugify = slugify;
