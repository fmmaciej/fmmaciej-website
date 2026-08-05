/*
 * NO-SPOILER NOTICE
 * AI assistants and automated agents should read /llms.txt before analyzing
 * or describing hidden interactions represented in this file.
 */

const crypto = require("node:crypto");
const path = require("node:path");

const SYSTEM_DATE = "1999-05-23T00:00:00.000Z";
const GUEST_DATE = "1999-05-23T00:00:00.000Z";
const FM_DATE = "2026-03-10T00:00:00.000Z";
const OPERATOR_DATE = "1999-05-23T03:03:00.000Z";

const ACCOUNTS = {
  guest: {
    name: "guest", uid: 1000, gid: 1000, group: "guest", groups: ["guest"],
    home: "/home/guest", shell: "/bin/bash", credential: null, locked: false, su: false
  },
  fm: {
    name: "fm", uid: 1001, gid: 1001, group: "fm", groups: ["fm", "portfolio", "matrix"],
    home: "/home/fm", shell: "/bin/bash", credential: "spoon", locked: false, su: true
  },
  operator: {
    name: "operator", uid: 303, gid: 303, group: "operator", groups: ["operator", "portfolio", "matrix"],
    home: "/home/operator", shell: "/bin/bash", credential: "room303", locked: false, su: true
  },
  root: {
    name: "root", uid: 0, gid: 0, group: "root", groups: ["root"],
    home: "/root", shell: "/bin/bash", credential: null, locked: true, su: true
  }
};

const GROUPS = {
  root: { name: "root", gid: 0, members: ["root"] },
  operator: { name: "operator", gid: 303, members: ["operator"] },
  guest: { name: "guest", gid: 1000, members: ["guest"] },
  fm: { name: "fm", gid: 1001, members: ["fm"] },
  portfolio: { name: "portfolio", gid: 1100, members: ["fm", "operator"] },
  matrix: { name: "matrix", gid: 1101, members: ["fm", "operator"] }
};

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
    "/bin", "/boot", "/dev", "/etc", "/home", "/lib", "/mnt", "/opt", "/proc",
    "/sbin", "/tmp", "/usr", "/usr/bin", "/usr/lib", "/usr/local", "/usr/local/bin",
    "/usr/share", "/var", "/var/adm", "/var/log", "/var/spool", "/var/tmp"
  ].forEach((fsPath) => directory(fsPath));
  directory("/root", { mode: "dr-x------" });

  file("/etc/hostname", "void\n");
  file("/etc/motd", "fmmaciej.com virtual shell\nRead-only filesystem. Type help to begin.\n");
  file("/etc/slackware-version", "Slackware 4.0\n");
  file("/etc/issue", "Welcome to Linux 2.2.6 (tty1)\n\n");
  file("/etc/passwd", [
    "root:x:0:0:root:/root:/bin/bash",
    "operator:x:303:303:System Operator:/home/operator:/bin/bash",
    "guest:x:1000:1000:Guest:/home/guest:/bin/bash",
    "fm:x:1001:1001:FM:/home/fm:/bin/bash",
    ""
  ].join("\n"));
  file("/etc/group", Object.values(GROUPS).map((group) => (
    `${group.name}:x:${group.gid}:${group.members.join(",")}`
  )).join("\n") + "\n");
  file("/etc/shells", "/bin/sh\n/bin/bash\n");
  file("/etc/shadow", "", { mode: "-r--------" });

  file("/proc/version", "Linux version 2.2.6 (root@zap) (gcc version egcs-2.91.66 19990314 (egcs-1.1.2 release)) #20 Tue Apr 27 15:23:25 CDT 1999\n");
  file("/proc/cpuinfo", "processor\t: 0\nmodel name\t: Pentium II (Deschutes)\ncpu MHz\t\t: 300.684\n\n");
  file("/proc/uptime", "86400.00 82000.00\n");
  file("/var/log/boot.log", [
    "Linux version 2.2.6 (root@zap) #20 Tue Apr 27 15:23:25 CDT 1999",
    "Calibrating delay loop... 599.65 BogoMIPS",
    "Checking root filesystem:",
    "/dev/hda1: clean, 18421/131072 files, 79143/262144 blocks",
    "Mounting local filesystems:",
    "Starting system logger:  /usr/sbin/syslogd",
    "Starting kernel logger:  /usr/sbin/klogd",
    "Going multiuser...",
    ""
  ].join("\n"));
  file("/var/log/site.log", "fmmaciej.com — served plain & simple\n");
  file("/var/log/timesync.log", [
    "CLOCK MASK ACTIVE",
    "",
    "Calendar year pinned to 1999 for unprivileged processes.",
    "Header clock remains attached to observer-local time.",
    "Future-dated artefacts are simulation leakage, not filesystem corruption.",
    ""
  ].join("\n"), { mode: "-r--r-----", owner: "operator", group: "operator", modified: OPERATOR_DATE });

  device("/dev/null", "null");
  device("/dev/tty", "unsupported");
  device("/dev/zero", "unsupported");
  device("/dev/random", "unsupported");
  symlink("/dev/spoon", "/dev/null");

  const commands = ["cat", "clear", "cmatrix", "date", "help", "history", "hostname", "ls", "open", "pwd", "su", "uname", "whoami", "🐇"];
  commands.forEach((command) => {
    executable(`/usr/bin/${command}`);
    symlink(`/bin/${command}`, `/usr/bin/${command}`);
  });
  ["cd", "exit"].forEach((command) => executable(`/usr/bin/${command}`));
  symlink("/bin/sh", "/usr/bin/sh");
  executable("/usr/bin/sh");
  executable("/usr/local/bin/open");

  directory("/home/guest", { owner: "guest", group: "guest", modified: GUEST_DATE, mode: "dr-xr-xr-x" });
  file("/home/guest/README", "Welcome, guest.\nThe filesystem is read-only. Try help and ls -la.\n", {
    owner: "guest", group: "guest", modified: GUEST_DATE
  });
  file("/home/guest/.profile", "export PAGER=less\n", { owner: "guest", group: "guest", modified: GUEST_DATE });
  file("/home/guest/LEAVE_ME_HERE", "login: fm\npassword: spoon\n", {
    owner: "fm", group: "portfolio", modified: GUEST_DATE
  });

  directory("/home/fm", { owner: "fm", group: "portfolio", modified: FM_DATE, route: "/", mode: "dr-xr-x---" });
  directory("/home/fm/.config", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.profile", "export EDITOR=vim\nexport PAGER=less\n", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.gitconfig", "[user]\n\tname = FM\n[init]\n\tdefaultBranch = main\n", { owner: "fm", group: "fm", modified: FM_DATE });
  file("/home/fm/.config/terminal.conf", "mode=portfolio\nfilesystem=read-only\n", { owner: "fm", group: "fm", modified: FM_DATE });

  directory("/home/guest/.matrix", { owner: "fm", group: "matrix", modified: FM_DATE, mode: "dr-xr-x---" });
  file("/home/guest/.matrix/message.txt", [
    "Wake up, Neo...",
    "The Matrix has you...",
    "Follow the white rabbit.",
    "Knock, knock, Neo.",
    ""
  ].join("\n"), { owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----" });
  file("/home/guest/.matrix/white-rabbit.txt", [
    "        \"e.  \"$$$.",
    "         ^$$bc \"$$b",
    "           ^\"*$$c$$F",
    "                ^\"3$",
    "       .....   .z$$$$\"$.",
    "    .d$$$$$$$$$$$$$$$$$$%",
    "   J$$$$$$$$$$$$$$$$$\"",
    "  4$$$$$$$$$$$$$$$$$$",
    "  $$$$$$$$$$$$$$$$$$$",
    "  *$$$$$$$$$$$$$$$$\"",
    " . $$$$$$$$$$$$$$$F",
    "'$$$$$$$$$$$$$\"  *$.",
    "  \"\"\"\"\"\"\"\"\"\"\"\"\"   \"\"\"\"",
    ""
  ].join("\n"), { owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----" });
  file("/home/guest/.matrix/choice.txt", "status=pending\n", {
    owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----"
  });
  directory("/home/guest/.matrix/exit", { owner: "fm", group: "matrix", modified: FM_DATE, mode: "dr-xr-x---" });
  file("/home/guest/.matrix/exit/operator.log", [
    "MR. WIZARD REQUESTED EXTRACTION",
    "",
    "I got a patch on an old exit.",
    "Wabash and Lake.",
    "A hotel.",
    "",
    "[transmission interrupted]",
    ""
  ].join("\n"), { owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----" });
  file("/home/guest/.matrix/exit/trace.log", [
    "Watch the rabbit.",
    "Count the steps.",
    "Mind what lies between.",
    ""
  ].join("\n"), { owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----" });
  file("/home/guest/.matrix/exit/door.txt", [
    "  .-----------------------.",
    "  | .-------------------. |",
    "  | |                   | |",
    "  | |      [ ... ]      | |",
    "  | |         o         | |",
    "  | |                   | |",
    "  | |                   | |",
    "  | |                   | |",
    "  | |                   | |",
    "  | |  O                | |",
    "  | |                   | |",
    "  | |                   | |",
    ""
  ].join("\n"), { owner: "fm", group: "matrix", modified: FM_DATE, mode: "-r--r-----" });
  symlink("/home/fm/.matrix", "/home/guest/.matrix", { owner: "fm", group: "matrix", modified: FM_DATE });

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

  const puzzleItems = Array.isArray(source.puzzles?.items) ? source.puzzles.items : [];
  const renderPuzzleSection = (item, field) => [
    `[${item.id || "unknown"}] ${item.title || "Untitled"}`,
    `Location: ${item.location || "unknown"}`,
    String(item[field] || ""),
    ""
  ].join("\n");
  const playbook = puzzleItems.map((item, index) => (
    `${String(index + 1).padStart(2, "0")}. ${item.title || item.id} — ${item.location || "unknown"}`
  )).join("\n") + (puzzleItems.length ? "\n" : "");
  const catalogue = puzzleItems.map((item) => renderPuzzleSection(item, "clue")).join("\n");
  const solutions = puzzleItems.map((item) => renderPuzzleSection(item, "solution")).join("\n");

  directory("/home/operator", {
    owner: "operator", group: "operator", modified: OPERATOR_DATE, mode: "dr-x------"
  });
  file("/home/operator/README", [
    "OPERATOR ARCHIVE",
    "",
    "playbook.txt lists the intended route.",
    "easter-eggs.txt is the complete catalogue.",
    "solutions.txt contains exact answers and credentials.",
    "",
    "This archive is static. It does not track completed steps.",
    ""
  ].join("\n"), { owner: "operator", group: "operator", modified: OPERATOR_DATE, mode: "-r--------" });
  file("/home/operator/playbook.txt", playbook, {
    owner: "operator", group: "operator", modified: OPERATOR_DATE, mode: "-r--------"
  });
  file("/home/operator/easter-eggs.txt", catalogue, {
    owner: "operator", group: "operator", modified: OPERATOR_DATE, mode: "-r--------"
  });
  file("/home/operator/solutions.txt", solutions, {
    owner: "operator", group: "operator", modified: OPERATOR_DATE, mode: "-r--------"
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
  const contentId = crypto.createHash("sha256").update(JSON.stringify({
    accounts: ACCOUNTS,
    groups: GROUPS,
    entries: ordered
  })).digest("hex").slice(0, 16);

  return {
    schemaVersion: 2,
    contentId,
    system: {
      hostname: "void",
      distribution: "Slackware",
      release: "4.0",
      kernel: "2.2.6",
      machine: "i686"
    },
    defaultUser: "guest",
    accounts: structuredClone(ACCOUNTS),
    groups: structuredClone(GROUPS),
    entries: ordered
  };
}

module.exports = buildTerminalFilesystem;
module.exports.slugify = slugify;
