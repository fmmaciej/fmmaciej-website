const test = require("node:test");
const assert = require("node:assert/strict");

const buildTerminalFilesystem = require("../src/_lib/terminal/buildTerminalFilesystem.js");
const shell = require("../src/assets/js/components/terminal-shell-core.js");

function fixture() {
  return buildTerminalFilesystem({
    about: "# About\n\nHello.\n",
    contact: "fm@example.com\n",
    cv: [{ name: "cv-en.pdf", url: "https://example.com/cv.pdf" }],
    links: [{ name: "GitHub", url: "https://github.com/example" }],
    projects: [{
      name: "Example Tool",
      desc: "A useful tool.",
      year: 2025,
      stack: ["C++", "CMake"],
      status: "Stable",
      links: { repo: "https://github.com/example/tool" }
    }],
    posts: [{
      title: "A post",
      slug: "a-post",
      description: "Description",
      date: "2026-03-10T00:00:00.000Z",
      url: "/blog/a-post/",
      content: "Complete body.\n"
    }],
    music: {
      intro: "Music intro\n",
      bio: "Bio\n",
      rider: "Rider\n",
      links: [{ slug: "club", url: "https://example.com/club", comment: "A club" }],
      events: [{
        slug: "event",
        title: "Event",
        date: "2026-01-02",
        count: 1,
        path: "/music/events/2026-01-02-event/",
        items: [{ id: "event-1", display1600: "/event-1.webp" }]
      }],
      mixes: [{
        id: "mix",
        title: "Mix",
        date: "2026-01-03",
        displayDate: "03.01.2026",
        url: "https://example.com/mix"
      }],
      photos: [{
        slug: "photos",
        title: "Photos",
        date: "2026-01-04",
        count: 1,
        photos: [{ id: "photo-1", display1600: "/photo-1.webp" }]
      }]
    }
  });
}

function state(cwd = "/home/fm") {
  return { cwd, previousCwd: null, history: [] };
}

test("filesystem builder creates a complete read-only tree without mutating input", () => {
  const input = {
    about: "About",
    projects: [{ name: "Tool", stack: ["Rust"], links: {} }],
    posts: [],
    music: { events: [], mixes: [], photos: [], links: [] }
  };
  const before = structuredClone(input);
  const manifest = buildTerminalFilesystem(input);
  const paths = new Set(manifest.entries.map((entry) => entry.path));

  assert.deepEqual(input, before);
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.contentId, /^[a-f0-9]{16}$/);
  [
    "/", "/bin", "/boot", "/dev", "/etc", "/home/fm", "/lib", "/lib64",
    "/media", "/mnt", "/opt", "/proc", "/root", "/run", "/sbin", "/srv",
    "/sys", "/tmp", "/usr/bin", "/var/log", "/home/fm/projects/tool",
    "/home/fm/.matrix", "/home/fm/.matrix/message.txt",
    "/home/fm/.matrix/white-rabbit.txt", "/home/fm/.matrix/choice.txt",
    "/dev/spoon", "/bin/cmatrix"
  ].forEach((fsPath) => assert.ok(paths.has(fsPath), fsPath));
  assert.equal(manifest.entries.find((entry) => entry.path === "/root").mode, "dr-x------");
  assert.equal(manifest.entries.find((entry) => entry.path === "/bin/ls").type, "symlink");
});

test("builder maps all supplied public portfolio catalogues", () => {
  const manifest = fixture();
  const paths = new Set(manifest.entries.map((entry) => entry.path));

  assert.ok(paths.has("/home/fm/projects/example-tool/README.md"));
  assert.ok(paths.has("/home/fm/blog/a-post.md"));
  assert.ok(paths.has("/home/fm/music/events/2026-01-02--event/event-1.webp"));
  assert.ok(paths.has("/home/fm/music/mixes/2026-01-03--mix/listen.url"));
  assert.ok(paths.has("/home/fm/music/photos/2026-01-04--photos/photo-1.webp"));
  assert.equal(
    manifest.entries.find((entry) => entry.path === "/home/fm/blog/a-post.md").content,
    "# A post\n\nDescription\n\nComplete body.\n"
  );
});

test("tokenizer handles quotes and escaping and rejects shell operators", () => {
  assert.deepEqual(shell.tokenize("cat 'a file.md' \"b file.md\""), {
    tokens: ["cat", "a file.md", "b file.md"]
  });
  assert.deepEqual(shell.tokenize("cat a\\ file.md"), { tokens: ["cat", "a file.md"] });
  assert.equal(shell.tokenize("cat file | less").error, "unsupported shell syntax");
  assert.equal(shell.tokenize("echo $(uname)").error, "unsupported shell syntax");
  assert.equal(shell.tokenize("cat 'file").error, "unterminated quote");
});

test("filesystem resolves Linux paths, home aliases, symlinks, and permissions", () => {
  const fs = shell.createFilesystem(fixture());

  assert.equal(fs.resolve("projects/../about.md", "/home/fm").path, "/home/fm/about.md");
  assert.equal(fs.resolve("~/projects", "/etc").path, "/home/fm/projects");
  assert.equal(fs.resolve("/bin/ls", "/home/fm").path, "/usr/bin/ls");
  assert.equal(fs.resolve("/dev/spoon", "/home/fm").path, "/dev/null");
  assert.equal(fs.canEnter(fs.resolve("/root", "/home/fm").entry), false);
  assert.equal(fs.canRead(fs.resolve("/etc/shadow", "/home/fm").entry), false);
  assert.equal(fs.pathForRoute("https://fmmaciej.com/"), "/home/fm");
  assert.equal(fs.pathForRoute("https://fmmaciej.com/projects/#example-tool"), "/home/fm/projects/example-tool");

  const cyclicManifest = fixture();
  cyclicManifest.entries.push(
    { path: "/loop-a", type: "symlink", mode: "lrwxrwxrwx", owner: "root", group: "root", modified: "2026-01-01", size: 7, target: "/loop-b" },
    { path: "/loop-b", type: "symlink", mode: "lrwxrwxrwx", owner: "root", group: "root", modified: "2026-01-01", size: 7, target: "/loop-a" }
  );
  assert.equal(shell.createFilesystem(cyclicManifest).resolve("/loop-a").error, "Too many levels of symbolic links");
});

test("ls, cat, cd, open, and standard errors follow the manifest", () => {
  const fs = shell.createFilesystem(fixture());

  const listing = shell.executeCommand(fs, state(), "ls -la projects");
  assert.match(listing.output, /\.\//);
  assert.match(listing.output, /dr-xr-xr-x\s+fm\s+fm.*example-tool\//);

  const cat = shell.executeCommand(fs, state(), "cat blog/a-post.md");
  assert.match(cat.output, /Complete body\./);

  const denied = shell.executeCommand(fs, state(), "cat /etc/shadow");
  assert.equal(denied.output, "cat: /etc/shadow: Permission denied");

  assert.equal(shell.executeCommand(fs, state(), "cat /dev/null").output, "");
  assert.equal(shell.executeCommand(fs, state(), "cat /dev/random").output, "cat: /dev/random: Operation not supported");

  const missing = shell.executeCommand(fs, state(), "cd missing");
  assert.equal(missing.output, "cd: missing: No such file or directory");

  const changed = shell.executeCommand(fs, state(), "cd projects/example-tool");
  assert.equal(changed.state.cwd, "/home/fm/projects/example-tool");
  assert.deepEqual(changed.action, {
    type: "navigate",
    url: "/projects/#example-tool",
    preserveShell: true
  });

  const previous = shell.executeCommand(fs, changed.state, "cd -");
  assert.equal(previous.state.cwd, "/home/fm");
  assert.equal(previous.output, "/home/fm");

  const opened = shell.executeCommand(fs, state(), "open projects/example-tool");
  assert.equal(opened.action.url, "/projects/#example-tool");
  assert.equal(opened.action.type, "open");

  const matrixEffect = shell.executeCommand(fs, state(), "cmatrix");
  assert.deepEqual(matrixEffect.action, { type: "effect", name: "matrix" });
  assert.equal(matrixEffect.output, "");
  assert.match(shell.executeCommand(fs, state(), "help").output, /cmatrix/);
  assert.match(shell.executeCommand(fs, state(), "cat ~/.matrix/message.txt").output, /Wake up, Neo/);
  assert.equal(shell.executeCommand(fs, state(), "cat ~/.matrix/choice.txt").output, "status=pending\n");
});

test("tab completion expands commands and paths", () => {
  const fs = shell.createFilesystem(fixture());
  assert.deepEqual(shell.completeInput(fs, "pw", "/home/fm"), {
    value: "pwd ",
    candidates: ["pwd"]
  });
  assert.deepEqual(shell.completeInput(fs, "cma", "/home/fm"), {
    value: "cmatrix ",
    candidates: ["cmatrix"]
  });
  const pathCompletion = shell.completeInput(fs, "cd pro", "/home/fm");
  assert.equal(pathCompletion.value, "cd projects/");
  assert.deepEqual(pathCompletion.candidates, ["projects/"]);
});

test("session persistence is bounded, versioned, and reset on incompatibility", () => {
  const fs = shell.createFilesystem(fixture());
  const huge = "x".repeat(shell.MAX_TRANSCRIPT_BYTES + 1);
  const serialized = shell.serializeSession(
    fs,
    { cwd: "/home/fm/projects", previousCwd: "/home/fm", history: Array(120).fill("pwd") },
    [{ command: "cat huge.md", output: huge, cwd: "/home/fm" }]
  );
  const restored = shell.restoreSession(fs, serialized, "/home/fm");

  assert.equal(restored.cwd, "/home/fm/projects");
  assert.equal(restored.history.length, 100);
  assert.equal(restored.transcript[0].output, shell.OMITTED_OUTPUT);

  const incompatible = JSON.parse(serialized);
  incompatible.contentId = "different";
  assert.deepEqual(shell.restoreSession(fs, JSON.stringify(incompatible), "/home/fm"), {
    cwd: "/home/fm",
    previousCwd: null,
    history: [],
    transcript: []
  });
});
