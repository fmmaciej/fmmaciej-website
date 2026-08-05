#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DISABLED_DIGEST = 'disabled\n';
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}\n$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}\n$/;
const DEFAULT_KEY_PATH = path.resolve(
  __dirname,
  '..',
  'tools',
  '.llm-maintainer-key'
);
const DEFAULT_DIGEST_PATH = path.resolve(__dirname, 'llm-maintainer.sha256');

class LlmMaintainerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LlmMaintainerError';
  }
}

function createToken(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(TOKEN_BYTES);
  if (!Buffer.isBuffer(bytes) || bytes.length !== TOKEN_BYTES) {
    throw new LlmMaintainerError(`Random source must return ${TOKEN_BYTES} bytes.`);
  }
  return Buffer.from(`${bytes.toString('hex')}\n`, 'ascii');
}

function computeDigest(token) {
  return `${crypto.createHash('sha256').update(token).digest('hex')}\n`;
}

function getFileStats(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function isRegularFile(filePath) {
  try {
    const stats = getFileStats(filePath);
    return stats !== null && stats.isFile() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
}

function hasPrivatePermissions(filePath) {
  try {
    return (fs.lstatSync(filePath).mode & 0o777) === 0o600;
  } catch {
    return false;
  }
}

function checkMaintainerAccess(options = {}) {
  const keyPath = path.resolve(options.keyPath || DEFAULT_KEY_PATH);
  const digestPath = path.resolve(options.digestPath || DEFAULT_DIGEST_PATH);

  try {
    if (!isRegularFile(keyPath) || !hasPrivatePermissions(keyPath)) return false;
    if (!isRegularFile(digestPath)) return false;

    const token = fs.readFileSync(keyPath);
    const configuredDigest = fs.readFileSync(digestPath, 'ascii');
    if (!TOKEN_PATTERN.test(token.toString('ascii'))) return false;
    if (!DIGEST_PATTERN.test(configuredDigest)) return false;

    const actual = Buffer.from(computeDigest(token).trimEnd(), 'hex');
    const expected = Buffer.from(configuredDigest.trimEnd(), 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function assertSafeDestination(filePath, label) {
  const stats = getFileStats(filePath);
  if (stats === null) return;
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new LlmMaintainerError(`${label} must be a regular, non-symlinked file.`);
  }
}

function writeAuthorization(token, options = {}) {
  const keyPath = path.resolve(options.keyPath || DEFAULT_KEY_PATH);
  const digestPath = path.resolve(options.digestPath || DEFAULT_DIGEST_PATH);

  if (!Buffer.isBuffer(token) || !TOKEN_PATTERN.test(token.toString('ascii'))) {
    throw new LlmMaintainerError('Maintainer token has an invalid format.');
  }
  assertSafeDestination(keyPath, 'Local maintainer key');
  assertSafeDestination(digestPath, 'Maintainer digest');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.mkdirSync(path.dirname(digestPath), { recursive: true });
  fs.writeFileSync(keyPath, token, { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
  fs.writeFileSync(digestPath, computeDigest(token), 'ascii');
  return { keyPath, digestPath };
}

function initMaintainer(options = {}) {
  const keyPath = path.resolve(options.keyPath || DEFAULT_KEY_PATH);
  const digestPath = path.resolve(options.digestPath || DEFAULT_DIGEST_PATH);
  const keyExists = getFileStats(keyPath) !== null;
  const digestExists = getFileStats(digestPath) !== null;
  const digest = digestExists && isRegularFile(digestPath)
    ? fs.readFileSync(digestPath, 'ascii')
    : null;

  if (keyExists || (digest !== null && digest !== DISABLED_DIGEST)) {
    throw new LlmMaintainerError(
      'Maintainer access is already configured; use rotate instead of init.'
    );
  }
  if (digestExists && digest === null) {
    throw new LlmMaintainerError('Maintainer digest must be a regular, non-symlinked file.');
  }

  return writeAuthorization(createToken(options.randomBytes), { keyPath, digestPath });
}

function rotateMaintainer(options = {}) {
  const keyPath = path.resolve(options.keyPath || DEFAULT_KEY_PATH);
  const digestPath = path.resolve(options.digestPath || DEFAULT_DIGEST_PATH);
  return writeAuthorization(createToken(options.randomBytes), { keyPath, digestPath });
}

function revokeMaintainer(options = {}) {
  const keyPath = path.resolve(options.keyPath || DEFAULT_KEY_PATH);
  const digestPath = path.resolve(options.digestPath || DEFAULT_DIGEST_PATH);

  assertSafeDestination(digestPath, 'Maintainer digest');
  const keyStats = getFileStats(keyPath);
  const removed = keyStats !== null;
  if (removed) {
    if (keyStats.isDirectory()) {
      throw new LlmMaintainerError('Local maintainer key path must not be a directory.');
    }
    fs.unlinkSync(keyPath);
  }
  fs.mkdirSync(path.dirname(digestPath), { recursive: true });
  fs.writeFileSync(digestPath, DISABLED_DIGEST, 'ascii');
  return { keyPath, digestPath, removed };
}

function printUsage(writeError) {
  writeError('Usage:');
  writeError('  npm run llm-maintainer:init');
  writeError('  npm run --silent llm-maintainer:check');
  writeError('  npm run llm-maintainer:rotate');
  writeError('  npm run llm-maintainer:revoke');
}

function runCli(args, options = {}) {
  const writeOutput = options.writeOutput || console.log;
  const writeError = options.writeError || console.error;
  const keyPath = options.keyPath || DEFAULT_KEY_PATH;
  const digestPath = options.digestPath || DEFAULT_DIGEST_PATH;
  const [command, ...values] = args;

  if (command === 'check') {
    const authorized = values.length === 0 && checkMaintainerAccess({ keyPath, digestPath });
    writeOutput(authorized ? 'AUTHORIZED' : 'NOT AUTHORIZED');
    return authorized ? 0 : 1;
  }

  try {
    if (values.length !== 0) {
      throw new LlmMaintainerError('This command does not accept arguments.');
    }

    if (command === 'init') {
      const result = initMaintainer({ keyPath, digestPath, randomBytes: options.randomBytes });
      writeOutput(`Local maintainer access initialized: ${result.keyPath}`);
      writeOutput(`Commit the updated public digest: ${result.digestPath}`);
      return 0;
    }

    if (command === 'rotate') {
      const result = rotateMaintainer({ keyPath, digestPath, randomBytes: options.randomBytes });
      writeOutput(`Local maintainer key rotated: ${result.keyPath}`);
      writeOutput(`Commit the updated public digest: ${result.digestPath}`);
      return 0;
    }

    if (command === 'revoke') {
      const result = revokeMaintainer({ keyPath, digestPath });
      writeOutput(
        result.removed
          ? `Local maintainer key removed: ${result.keyPath}`
          : `No local maintainer key was present: ${result.keyPath}`
      );
      writeOutput(`Commit the disabled public digest: ${result.digestPath}`);
      return 0;
    }

    throw new LlmMaintainerError('Unknown or missing command.');
  } catch (error) {
    if (!(error instanceof LlmMaintainerError)) throw error;
    writeError(`[llm-maintainer] ${error.message}`);
    printUsage(writeError);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  DEFAULT_DIGEST_PATH,
  DEFAULT_KEY_PATH,
  DIGEST_PATTERN,
  DISABLED_DIGEST,
  LlmMaintainerError,
  TOKEN_BYTES,
  TOKEN_PATTERN,
  checkMaintainerAccess,
  computeDigest,
  createToken,
  initMaintainer,
  revokeMaintainer,
  rotateMaintainer,
  runCli,
  writeAuthorization
};
