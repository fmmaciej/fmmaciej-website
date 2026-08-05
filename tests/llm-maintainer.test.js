const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  DISABLED_DIGEST,
  LlmMaintainerError,
  checkMaintainerAccess,
  computeDigest,
  createToken,
  initMaintainer,
  revokeMaintainer,
  rotateMaintainer,
  runCli
} = require('../scripts/llm-maintainer.js');

function createPaths(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmmaciej-llm-maintainer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    keyPath: path.join(root, 'tools', '.llm-maintainer-key'),
    digestPath: path.join(root, 'scripts', 'llm-maintainer.sha256')
  };
}

function randomFilledWith(value) {
  return (size) => Buffer.alloc(size, value);
}

function writeValidAuthorization(paths, value = 0x11) {
  const token = createToken(randomFilledWith(value));
  fs.mkdirSync(path.dirname(paths.keyPath), { recursive: true });
  fs.mkdirSync(path.dirname(paths.digestPath), { recursive: true });
  fs.writeFileSync(paths.keyPath, token, { mode: 0o600 });
  fs.chmodSync(paths.keyPath, 0o600);
  fs.writeFileSync(paths.digestPath, computeDigest(token), 'ascii');
  return token;
}

test('creates a 256-bit lowercase hexadecimal token with one LF', () => {
  const token = createToken(randomFilledWith(0xab));
  assert.equal(token.length, 65);
  assert.equal(token.toString('ascii'), `${'ab'.repeat(32)}\n`);
  assert.match(computeDigest(token), /^[0-9a-f]{64}\n$/);
  assert.throws(
    () => createToken(() => Buffer.alloc(31)),
    LlmMaintainerError
  );
});

test('init creates the ignored key and tracked digest without exposing the token', (t) => {
  const paths = createPaths(t);
  fs.mkdirSync(path.dirname(paths.digestPath), { recursive: true });
  fs.writeFileSync(paths.digestPath, DISABLED_DIGEST, 'ascii');

  const result = initMaintainer({
    ...paths,
    randomBytes: randomFilledWith(0x22)
  });

  assert.deepEqual(result, {
    keyPath: paths.keyPath,
    digestPath: paths.digestPath
  });
  assert.equal(fs.readFileSync(paths.keyPath, 'ascii'), `${'22'.repeat(32)}\n`);
  assert.equal(fs.lstatSync(paths.keyPath).mode & 0o777, 0o600);
  assert.equal(
    fs.readFileSync(paths.digestPath, 'ascii'),
    computeDigest(fs.readFileSync(paths.keyPath))
  );
  assert.equal(checkMaintainerAccess(paths), true);
});

test('init refuses to overwrite an existing key or active digest', (t) => {
  const withKey = createPaths(t);
  fs.mkdirSync(path.dirname(withKey.keyPath), { recursive: true });
  fs.writeFileSync(withKey.keyPath, 'existing\n', { mode: 0o600 });
  assert.throws(() => initMaintainer(withKey), /already configured/);

  const withDigest = createPaths(t);
  fs.mkdirSync(path.dirname(withDigest.digestPath), { recursive: true });
  fs.writeFileSync(withDigest.digestPath, `${'a'.repeat(64)}\n`, 'ascii');
  assert.throws(() => initMaintainer(withDigest), /already configured/);
});

test('check denies missing, disabled, malformed, mismatched, and public keys', (t) => {
  const paths = createPaths(t);
  assert.equal(checkMaintainerAccess(paths), false);

  fs.mkdirSync(path.dirname(paths.digestPath), { recursive: true });
  fs.writeFileSync(paths.digestPath, DISABLED_DIGEST, 'ascii');
  fs.mkdirSync(path.dirname(paths.keyPath), { recursive: true });
  fs.writeFileSync(paths.keyPath, `${'1'.repeat(64)}\n`, { mode: 0o600 });
  fs.chmodSync(paths.keyPath, 0o600);
  assert.equal(checkMaintainerAccess(paths), false);

  fs.writeFileSync(paths.digestPath, 'not-a-digest\n', 'ascii');
  assert.equal(checkMaintainerAccess(paths), false);

  fs.writeFileSync(paths.digestPath, `${'2'.repeat(64)}\n`, 'ascii');
  assert.equal(checkMaintainerAccess(paths), false);

  fs.writeFileSync(paths.digestPath, computeDigest(fs.readFileSync(paths.keyPath)), 'ascii');
  fs.chmodSync(paths.keyPath, 0o644);
  assert.equal(checkMaintainerAccess(paths), false);

  fs.chmodSync(paths.keyPath, 0o600);
  fs.writeFileSync(paths.keyPath, 'not-a-token\n', { mode: 0o600 });
  assert.equal(checkMaintainerAccess(paths), false);
});

test('check rejects a symlinked key even when its target is valid', (t) => {
  const paths = createPaths(t);
  const token = writeValidAuthorization(paths, 0x33);
  const targetPath = path.join(paths.root, 'real-key');
  fs.writeFileSync(targetPath, token, { mode: 0o600 });
  fs.rmSync(paths.keyPath);
  fs.symlinkSync(targetPath, paths.keyPath);

  assert.equal(checkMaintainerAccess(paths), false);
});

test('init refuses a broken symlink instead of following it', (t) => {
  const paths = createPaths(t);
  fs.mkdirSync(path.dirname(paths.keyPath), { recursive: true });
  fs.symlinkSync(path.join(paths.root, 'missing-target'), paths.keyPath);

  assert.throws(
    () => initMaintainer({ ...paths, randomBytes: randomFilledWith(0x34) }),
    /already configured/
  );
  assert.equal(fs.existsSync(path.join(paths.root, 'missing-target')), false);
});

test('rotate replaces the key and invalidates the previous token', (t) => {
  const paths = createPaths(t);
  const oldToken = writeValidAuthorization(paths, 0x44);

  rotateMaintainer({ ...paths, randomBytes: randomFilledWith(0x55) });
  const newToken = fs.readFileSync(paths.keyPath);
  assert.notDeepEqual(newToken, oldToken);
  assert.equal(checkMaintainerAccess(paths), true);

  fs.writeFileSync(paths.keyPath, oldToken, { mode: 0o600 });
  fs.chmodSync(paths.keyPath, 0o600);
  assert.equal(checkMaintainerAccess(paths), false);
});

test('revoke is idempotent and restores the disabled digest', (t) => {
  const paths = createPaths(t);
  writeValidAuthorization(paths, 0x66);

  assert.deepEqual(revokeMaintainer(paths), {
    keyPath: paths.keyPath,
    digestPath: paths.digestPath,
    removed: true
  });
  assert.equal(fs.existsSync(paths.keyPath), false);
  assert.equal(fs.readFileSync(paths.digestPath, 'ascii'), DISABLED_DIGEST);
  assert.equal(checkMaintainerAccess(paths), false);

  assert.deepEqual(revokeMaintainer(paths), {
    keyPath: paths.keyPath,
    digestPath: paths.digestPath,
    removed: false
  });
  assert.equal(fs.readFileSync(paths.digestPath, 'ascii'), DISABLED_DIGEST);
});

test('check CLI prints exactly one generic status line', (t) => {
  const paths = createPaths(t);
  writeValidAuthorization(paths, 0x77);
  const authorizedOutput = [];
  const authorizedErrors = [];

  assert.equal(runCli(['check'], {
    ...paths,
    writeOutput: (line) => authorizedOutput.push(line),
    writeError: (line) => authorizedErrors.push(line)
  }), 0);
  assert.deepEqual(authorizedOutput, ['AUTHORIZED']);
  assert.deepEqual(authorizedErrors, []);

  fs.writeFileSync(paths.digestPath, DISABLED_DIGEST, 'ascii');
  const deniedOutput = [];
  assert.equal(runCli(['check'], {
    ...paths,
    writeOutput: (line) => deniedOutput.push(line),
    writeError() {}
  }), 1);
  assert.deepEqual(deniedOutput, ['NOT AUTHORIZED']);
});

test('administrative CLI messages never include token or digest contents', (t) => {
  const paths = createPaths(t);
  fs.mkdirSync(path.dirname(paths.digestPath), { recursive: true });
  fs.writeFileSync(paths.digestPath, DISABLED_DIGEST, 'ascii');
  const output = [];

  assert.equal(runCli(['init'], {
    ...paths,
    randomBytes: randomFilledWith(0x88),
    writeOutput: (line) => output.push(line),
    writeError() {}
  }), 0);

  const token = fs.readFileSync(paths.keyPath, 'ascii').trimEnd();
  const digest = fs.readFileSync(paths.digestPath, 'ascii').trimEnd();
  assert.doesNotMatch(output.join('\n'), new RegExp(token));
  assert.doesNotMatch(output.join('\n'), new RegExp(digest));
});

test('the real local key path is ignored and untracked by Git', () => {
  const ignored = spawnSync(
    'git',
    ['check-ignore', '--quiet', 'tools/.llm-maintainer-key'],
    { cwd: path.resolve(__dirname, '..') }
  );
  const tracked = spawnSync(
    'git',
    ['ls-files', '--error-unmatch', 'tools/.llm-maintainer-key'],
    { cwd: path.resolve(__dirname, '..') }
  );

  assert.equal(ignored.status, 0);
  assert.notEqual(tracked.status, 0);
});
