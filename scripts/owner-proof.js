#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_CHALLENGE_BYTES = 256;
const PUBLIC_URL = 'https://www.fmmaciej.com/.well-known/llm-owner-proof.txt';
const DEFAULT_PROOF_PATH = path.resolve(
  __dirname,
  '..',
  'tmp',
  'owner-proof',
  '.well-known',
  'llm-owner-proof.txt'
);

class OwnerProofError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OwnerProofError';
  }
}

function validateChallenge(challenge) {
  if (typeof challenge !== 'string' || challenge.length === 0) {
    throw new OwnerProofError('Challenge must not be empty.');
  }
  if (challenge.trim().length === 0) {
    throw new OwnerProofError('Challenge must not contain only whitespace.');
  }
  if (/[\r\n]/.test(challenge)) {
    throw new OwnerProofError('Challenge must not contain newline characters.');
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(challenge)) {
    throw new OwnerProofError('Challenge must not contain control characters.');
  }
  if (Buffer.byteLength(challenge, 'utf8') > MAX_CHALLENGE_BYTES) {
    throw new OwnerProofError(
      `Challenge must not exceed ${MAX_CHALLENGE_BYTES} UTF-8 bytes.`
    );
  }
  return challenge;
}

function writeOwnerProof(challenge, options = {}) {
  const proofPath = path.resolve(options.proofPath || DEFAULT_PROOF_PATH);
  const validated = validateChallenge(challenge);
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(proofPath, `${validated}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  return proofPath;
}

function clearOwnerProof(options = {}) {
  const proofPath = path.resolve(options.proofPath || DEFAULT_PROOF_PATH);
  const removed = fs.existsSync(proofPath);
  fs.rmSync(proofPath, { force: true });
  return { proofPath, removed };
}

function printUsage(writeError) {
  writeError('Usage:');
  writeError('  npm run owner-proof -- <challenge>');
  writeError('  npm run owner-proof:clear');
}

function runCli(args, options = {}) {
  const writeOutput = options.writeOutput || console.log;
  const writeError = options.writeError || console.error;
  const proofPath = options.proofPath || DEFAULT_PROOF_PATH;
  const [command, ...values] = args;

  try {
    if (command === 'set') {
      if (values.length !== 1) {
        throw new OwnerProofError('Provide exactly one challenge argument.');
      }
      const writtenPath = writeOwnerProof(values[0], { proofPath });
      writeOutput(`Owner proof written to: ${writtenPath}`);
      writeOutput('Upload this file via FTP/SFTP to the document root as:');
      writeOutput('  .well-known/llm-owner-proof.txt');
      writeOutput(`Public verification URL: ${PUBLIC_URL}`);
      writeOutput('Use SFTP or a binary transfer mode so the file bytes remain unchanged.');
      return 0;
    }

    if (command === 'clear') {
      if (values.length !== 0) {
        throw new OwnerProofError('The clear command does not accept arguments.');
      }
      const result = clearOwnerProof({ proofPath });
      writeOutput(
        result.removed
          ? `Local owner proof removed: ${result.proofPath}`
          : `No local owner proof was present: ${result.proofPath}`
      );
      writeOutput(`Also remove the remote file from: ${PUBLIC_URL}`);
      return 0;
    }

    throw new OwnerProofError('Unknown or missing command.');
  } catch (error) {
    if (!(error instanceof OwnerProofError)) throw error;
    writeError(`[owner-proof] ${error.message}`);
    printUsage(writeError);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  DEFAULT_PROOF_PATH,
  MAX_CHALLENGE_BYTES,
  OwnerProofError,
  PUBLIC_URL,
  clearOwnerProof,
  runCli,
  validateChallenge,
  writeOwnerProof
};
