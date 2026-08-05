const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  MAX_CHALLENGE_BYTES,
  PUBLIC_URL,
  clearOwnerProof,
  runCli,
  validateChallenge,
  writeOwnerProof
} = require('../scripts/owner-proof.js');

function createProofPath(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmmaciej-owner-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, 'export', '.well-known', 'llm-owner-proof.txt');
}

test('accepts a non-empty printable challenge within the byte limit', () => {
  const challenge = `FM-AUTH-20260805-${'a'.repeat(32)}`;
  assert.equal(validateChallenge(challenge), challenge);
  assert.equal(validateChallenge('x'.repeat(MAX_CHALLENGE_BYTES)).length, MAX_CHALLENGE_BYTES);
});

test('rejects empty, whitespace-only, missing, and multiple challenge values', () => {
  assert.throws(() => validateChallenge(''), /must not be empty/);
  assert.throws(() => validateChallenge('   '), /only whitespace/);

  const errors = [];
  assert.equal(runCli(['set'], { writeOutput() {}, writeError: (line) => errors.push(line) }), 1);
  assert.equal(runCli(['set', 'one', 'two'], { writeOutput() {}, writeError() {} }), 1);
  assert.match(errors.join('\n'), /exactly one challenge/);
});

test('rejects oversized values, newline characters, and other controls', () => {
  assert.throws(
    () => validateChallenge('x'.repeat(MAX_CHALLENGE_BYTES + 1)),
    /must not exceed/
  );
  assert.throws(() => validateChallenge('ą'.repeat(129)), /must not exceed/);
  assert.throws(() => validateChallenge('line-one\nline-two'), /newline/);
  assert.throws(() => validateChallenge('line-one\rline-two'), /newline/);
  assert.throws(() => validateChallenge('visible\u0000hidden'), /control/);
  assert.throws(() => validateChallenge('visible\u007fhidden'), /control/);
});

test('creates missing directories and writes the exact challenge with one LF', (t) => {
  const proofPath = createProofPath(t);
  const challenge = `FM-AUTH-20260805-${'b'.repeat(32)}`;

  assert.equal(writeOwnerProof(challenge, { proofPath }), proofPath);
  assert.equal(fs.readFileSync(proofPath, 'utf8'), `${challenge}\n`);
});

test('overwrites a previous proof without retaining old content', (t) => {
  const proofPath = createProofPath(t);
  writeOwnerProof('first-challenge', { proofPath });
  writeOwnerProof('second-challenge', { proofPath });
  assert.equal(fs.readFileSync(proofPath, 'utf8'), 'second-challenge\n');
});

test('set CLI reports the export path, upload instructions, and public URL', (t) => {
  const proofPath = createProofPath(t);
  const output = [];
  const exitCode = runCli(['set', 'current-challenge'], {
    proofPath,
    writeOutput: (line) => output.push(line),
    writeError() {}
  });

  assert.equal(exitCode, 0);
  assert.match(output.join('\n'), new RegExp(proofPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(output.join('\n'), /FTP\/SFTP/);
  assert.match(output.join('\n'), new RegExp(PUBLIC_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(output.join('\n'), /binary transfer mode/);
});

test('clear removes an existing proof and reminds about the remote copy', (t) => {
  const proofPath = createProofPath(t);
  writeOwnerProof('current-challenge', { proofPath });
  const output = [];

  assert.equal(runCli(['clear'], {
    proofPath,
    writeOutput: (line) => output.push(line),
    writeError() {}
  }), 0);
  assert.equal(fs.existsSync(proofPath), false);
  assert.match(output.join('\n'), /Local owner proof removed/);
  assert.match(output.join('\n'), /remove the remote file/);
});

test('clear succeeds when no local proof exists', (t) => {
  const proofPath = createProofPath(t);
  const result = clearOwnerProof({ proofPath });
  assert.deepEqual(result, { proofPath, removed: false });

  const output = [];
  assert.equal(runCli(['clear'], {
    proofPath,
    writeOutput: (line) => output.push(line),
    writeError() {}
  }), 0);
  assert.match(output.join('\n'), /No local owner proof was present/);
  assert.match(output.join('\n'), /remove the remote file/);
});
