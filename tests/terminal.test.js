const test = require("node:test");
const assert = require("node:assert/strict");

const buildTerminalFilesystem = require("../src/_lib/terminal/buildTerminalFilesystem.js");
const shell = require("../src/assets/js/components/terminal-shell-core.js");
const puzzles = require("../src/_data/terminal/puzzles.json");

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
    puzzles,
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

function state(cwd = "/home/fm", user = "fm") {
  return { user, cwd, previousCwd: null, history: [], loginStack: [] };
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
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.defaultUser, "guest");
  assert.equal(manifest.system.distribution, "Slackware");
  assert.equal(manifest.system.release, "4.0");
  assert.deepEqual(manifest.accounts.operator.groups, ["operator", "portfolio", "matrix"]);
  assert.match(manifest.contentId, /^[a-f0-9]{16}$/);
  [
    "/", "/bin", "/boot", "/dev", "/etc", "/home/guest", "/home/fm",
    "/home/operator", "/lib", "/mnt", "/opt", "/proc", "/root", "/sbin",
    "/tmp", "/usr/bin", "/var/log", "/home/fm/projects/tool",
    "/home/guest/.matrix", "/home/guest/.matrix/message.txt",
    "/home/guest/.matrix/white-rabbit.txt", "/home/guest/.matrix/choice.txt",
    "/home/guest/.matrix/exit", "/home/guest/.matrix/exit/operator.log",
    "/home/guest/.matrix/exit/trace.log", "/home/guest/.matrix/exit/door.txt",
    "/home/fm/.matrix", "/home/operator/solutions.txt", "/var/log/timesync.log",
    "/dev/spoon", "/bin/cmatrix", "/bin/date", "/bin/su", "/bin/🐇", "/usr/bin/🐇"
  ].forEach((fsPath) => assert.ok(paths.has(fsPath), fsPath));
  assert.equal(manifest.entries.find((entry) => entry.path === "/root").mode, "dr-x------");
  assert.equal(manifest.entries.find((entry) => entry.path === "/bin/ls").type, "symlink");
  assert.equal(manifest.entries.find((entry) => entry.path === "/bin/🐇").target, "/usr/bin/🐇");
  assert.equal(manifest.entries.find((entry) => entry.path === "/usr/bin/🐇").type, "executable");
  assert.equal(manifest.entries.some((entry) => entry.path === "/etc/os-release"), false);
  assert.equal(manifest.entries.find((entry) => entry.path === "/home/fm/.matrix").target, "/home/guest/.matrix");
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
  assert.deepEqual(shell.tokenize("🐇"), { tokens: ["🐇"] });
  assert.equal(shell.tokenize("cat file | less").error, "unsupported shell syntax");
  assert.equal(shell.tokenize("echo $(uname)").error, "unsupported shell syntax");
  assert.equal(shell.tokenize("cat 'file").error, "unterminated quote");
});

test("filesystem resolves Linux paths, home aliases, symlinks, and permissions", () => {
  const fs = shell.createFilesystem(fixture());

  assert.equal(fs.resolve("projects/../about.md", "/home/fm", { user: "fm" }).path, "/home/fm/about.md");
  assert.equal(fs.resolve("~/projects", "/etc", { user: "fm" }).path, "/home/fm/projects");
  assert.equal(fs.resolve("/bin/ls", "/home/fm", { user: "fm" }).path, "/usr/bin/ls");
  assert.equal(fs.resolve("/dev/spoon", "/home/fm", { user: "fm" }).path, "/dev/null");
  assert.equal(fs.canEnter(fs.resolve("/root", "/home/fm", { user: "fm" }).entry, "fm"), false);
  assert.equal(fs.canRead(fs.resolve("/etc/shadow", "/home/fm", { user: "fm" }).entry, "fm"), false);
  assert.equal(fs.pathForRoute("https://fmmaciej.com/", "guest"), "/home/guest");
  assert.equal(fs.pathForRoute("https://fmmaciej.com/", "fm"), "/home/fm");
  assert.equal(fs.pathForRoute("https://fmmaciej.com/projects/#example-tool", "operator"), "/home/fm/projects/example-tool");

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
  const help = shell.executeCommand(fs, state(), "help").output;
  assert.match(help, /cmatrix/);
  assert.doesNotMatch(help, /🐇/);
  const rabbit = shell.executeCommand(fs, state(), "🐇");
  assert.equal(rabbit.output, "...");
  assert.equal(rabbit.action, undefined);
  assert.deepEqual(rabbit.state.history, ["🐇"]);
  assert.match(shell.executeCommand(fs, state(), "cat ~/.matrix/message.txt").output, /Wake up, Neo/);
  assert.match(shell.executeCommand(fs, state(), "cat ~/.matrix/white-rabbit.txt").output, /\${10}/);
  assert.equal(shell.executeCommand(fs, state(), "cat ~/.matrix/choice.txt").output, "status=pending\n");
  assert.equal(shell.executeCommand(fs, state(), "cat ~/.matrix/exit/operator.log").output, [
    "MR. WIZARD REQUESTED EXTRACTION",
    "",
    "I got a patch on an old exit.",
    "Wabash and Lake.",
    "A hotel.",
    "",
    "[transmission interrupted]",
    ""
  ].join("\n"));
  assert.equal(shell.executeCommand(fs, state(), "cat ~/.matrix/exit/trace.log").output, [
    "Watch the rabbit.",
    "Count the steps.",
    "Mind what lies between.",
    ""
  ].join("\n"));

  const door = shell.executeCommand(fs, state(), "cat ~/.matrix/exit/door.txt").output;
  assert.equal(door, [
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
  ].join("\n"));
  assert.ok(door.split("\n").every((line) => line.length <= 28));

  for (const fsPath of [
    "/home/guest/.matrix/exit/operator.log",
    "/home/guest/.matrix/exit/trace.log",
    "/home/guest/.matrix/exit/door.txt"
  ]) {
    const entry = fs.entries.get(fsPath);
    assert.equal(entry.owner, "fm");
    assert.equal(entry.group, "matrix");
    assert.equal(entry.mode, "-r--r-----");
  }
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
  assert.deepEqual(shell.completeInput(fs, "🐇", "/home/fm"), {
    value: "🐇 ",
    candidates: ["🐇"]
  });
  const pathCompletion = shell.completeInput(fs, "cd pro", "/home/fm", "fm");
  assert.equal(pathCompletion.value, "cd projects/");
  assert.deepEqual(pathCompletion.candidates, ["projects/"]);
});

test("session persistence is bounded, versioned, and reset on incompatibility", () => {
  const fs = shell.createFilesystem(fixture());
  const huge = "x".repeat(shell.MAX_TRANSCRIPT_BYTES + 1);
  const serialized = shell.serializeSession(
    fs,
    { user: "fm", cwd: "/home/fm/projects", previousCwd: "/home/fm", history: Array(120).fill("pwd"), loginStack: [] },
    [{ command: "cat huge.md", output: huge, cwd: "/home/fm", user: "fm" }]
  );
  const restored = shell.restoreSession(fs, serialized, "/home/fm");

  assert.equal(restored.cwd, "/home/fm/projects");
  assert.equal(restored.history.length, 100);
  assert.equal(restored.transcript[0].output, shell.OMITTED_OUTPUT);

  const incompatible = JSON.parse(serialized);
  incompatible.contentId = "different";
  assert.deepEqual(shell.restoreSession(fs, JSON.stringify(incompatible), "/home/guest"), {
    user: "guest",
    cwd: "/home/guest",
    previousCwd: null,
    history: [],
    loginStack: [],
    transcript: []
  });
});

test("guest sees the onboarding files but Matrix and portfolio require fm", () => {
  const fs = shell.createFilesystem(fixture());
  const guest = state("/home/guest", "guest");

  const listing = shell.executeCommand(fs, guest, "ls -la ~").output;
  assert.match(listing, /\.matrix\//);
  assert.match(listing, /LEAVE_ME_HERE/);
  assert.equal(
    shell.executeCommand(fs, guest, "cat LEAVE_ME_HERE").output,
    "login: fm\npassword: spoon\n"
  );
  assert.equal(
    shell.executeCommand(fs, guest, "cat ~/.matrix/message.txt").output,
    "cat: ~/.matrix/message.txt: Permission denied"
  );
  assert.equal(
    shell.executeCommand(fs, guest, "cd /home/fm/projects").output,
    "cd: /home/fm/projects: Permission denied"
  );
});

test("su authenticates interactive logins, restores nested frames, and keeps root locked", () => {
  const fs = shell.createFilesystem(fixture());
  let current = state("/home/guest", "guest");

  const fmRequest = shell.executeCommand(fs, current, "su - fm");
  assert.deepEqual(fmRequest.auth, { target: "fm", login: true, command: null });
  assert.deepEqual(fmRequest.state.history, ["su - fm"]);

  const rejected = shell.completeAuthentication(fs, fmRequest.state, fmRequest.auth, "wrong");
  assert.equal(rejected.output, "su: Authentication failure");
  assert.equal(rejected.state.user, "guest");

  const fmLogin = shell.completeAuthentication(fs, fmRequest.state, fmRequest.auth, "spoon");
  current = fmLogin.state;
  assert.equal(current.user, "fm");
  assert.equal(current.cwd, "/home/fm");
  assert.equal(current.loginStack.length, 1);

  const operatorRequest = shell.executeCommand(fs, current, "su - operator");
  current = shell.completeAuthentication(fs, operatorRequest.state, operatorRequest.auth, "room303").state;
  assert.equal(current.user, "operator");
  assert.equal(current.cwd, "/home/operator");
  assert.equal(current.loginStack.length, 2);
  assert.match(shell.executeCommand(fs, current, "cat solutions.txt").output, /room303/);
  assert.match(shell.executeCommand(fs, current, "cat /var/log/timesync.log").output, /CLOCK MASK ACTIVE/);

  current = shell.executeCommand(fs, current, "exit").state;
  assert.equal(current.user, "fm");
  current = shell.executeCommand(fs, current, "exit").state;
  assert.equal(current.user, "guest");
  assert.equal(shell.executeCommand(fs, current, "exit").exit, true);

  const rootRequest = shell.executeCommand(fs, current, "su");
  assert.equal(rootRequest.auth.target, "root");
  assert.equal(
    shell.completeAuthentication(fs, rootRequest.state, rootRequest.auth, "").output,
    "su: Authentication failure"
  );
  assert.equal(shell.executeCommand(fs, current, "su guest").output, "su: account guest is not available");
});

test("su -c runs one command with isolated identity and working directory", () => {
  const fs = shell.createFilesystem(fixture());
  const guest = state("/home/guest", "guest");
  const request = shell.executeCommand(fs, guest, "su -c 'cd /home/fm/music' fm");
  const result = shell.completeAuthentication(fs, request.state, request.auth, "spoon");

  assert.equal(result.authenticated, true);
  assert.equal(result.ephemeral, true);
  assert.equal(result.state.user, "guest");
  assert.equal(result.state.cwd, "/home/guest");
  assert.deepEqual(result.action, {
    type: "navigate",
    url: "/music/",
    preserveShell: false,
    ephemeral: true
  });

  const loginRequest = shell.executeCommand(fs, guest, "su -c pwd - fm");
  const loginResult = shell.completeAuthentication(fs, loginRequest.state, loginRequest.auth, "spoon");
  assert.equal(loginResult.output, "/home/fm");
  assert.equal(loginResult.state.cwd, "/home/guest");
  const compoundRequest = shell.executeCommand(fs, guest, "su -c 'pwd; whoami' fm");
  assert.equal(
    shell.completeAuthentication(fs, compoundRequest.state, compoundRequest.auth, "spoon").output,
    "shell: unsupported shell syntax"
  );
});

test("date masks the year, recomputes the weekday, and clamps leap day", () => {
  const fs = shell.createFilesystem(fixture());
  const august = shell.executeCommand(fs, state(), "date", {
    now: new Date(2026, 7, 5, 14, 32, 17)
  }).output;
  const leapDay = shell.formatSimulatedDate(new Date(2024, 1, 29, 9, 8, 7));

  assert.match(august, /^Thu Aug  5 14:32:17 .+ 1999$/);
  assert.match(leapDay, /^Sun Feb 28 09:08:07 .+ 1999$/);
});

test("session v2 preserves identity and login stack without persisting credentials", () => {
  const fs = shell.createFilesystem(fixture());
  const session = {
    user: "operator",
    cwd: "/home/operator",
    previousCwd: null,
    history: ["su - operator"],
    loginStack: [
      { user: "guest", cwd: "/home/guest", previousCwd: null },
      { user: "fm", cwd: "/home/fm", previousCwd: null }
    ]
  };
  const serialized = shell.serializeSession(fs, session, [
    { command: "su - operator", output: "", cwd: "/home/fm", user: "fm" }
  ]);
  const restored = shell.restoreSession(fs, serialized, "/home/guest");

  assert.equal(JSON.parse(serialized).version, 2);
  assert.doesNotMatch(serialized, /spoon|room303|password/i);
  assert.equal(restored.user, "operator");
  assert.equal(restored.loginStack.length, 2);
  assert.equal(restored.transcript[0].user, "fm");

  const invalid = JSON.parse(serialized);
  invalid.loginStack[0].cwd = "/root";
  assert.equal(shell.restoreSession(fs, JSON.stringify(invalid), "/home/guest").user, "guest");
});
