const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const idle = require('../src/assets/js/components/terminal-idle-core.js');
const buildTerminalFilesystem = require('../src/_lib/terminal/buildTerminalFilesystem.js');

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test('idle selector preserves the 2:1 normal rhythm and injects Matrix every sixth item', () => {
  const selector = idle.createCommandSelector({
    contextual: [{ id: 'c1' }, { id: 'c2' }],
    common: [{ id: 'g1' }],
    matrix: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
    contextualPerCommon: 2,
    easterEggEvery: 6
  });
  const sequence = Array.from({ length: 18 }, () => selector.next().id);

  assert.deepEqual(sequence, [
    'c1', 'c2', 'g1', 'c1', 'c2', 'm1',
    'g1', 'c1', 'c2', 'g1', 'c1', 'm2',
    'c2', 'g1', 'c1', 'c2', 'g1', 'm3'
  ]);
});

test('idle selector falls back between pools and a new selector resets the route sequence', () => {
  const first = idle.createCommandSelector({
    contextual: [{ id: 'local' }],
    common: [{ id: 'global' }]
  });
  first.next();
  first.next();
  assert.equal(idle.createCommandSelector({
    contextual: [{ id: 'local' }],
    common: [{ id: 'global' }]
  }).next().id, 'local');

  assert.equal(idle.createCommandSelector({ common: [{ id: 'global' }] }).next().id, 'global');
  assert.equal(idle.createCommandSelector({ contextual: [{ id: 'local' }] }).next().id, 'local');
  assert.equal(idle.createCommandSelector().next(), null);
});

test('timing profiles use standard fallback, selected profile, overrides, and clamps', () => {
  const warnings = [];
  const profiles = {
    standard: { typingDelayMs: 24, holdMs: 1500 },
    cinematic: { typingDelayMs: 40, linePauseMs: 800 }
  };
  assert.deepEqual(idle.resolveTiming(profiles, {
    timingProfile: 'cinematic',
    linePauseMs: 180,
    frameDelayMs: 2,
    durationMs: -1
  }, (name) => warnings.push(name)), {
    typingDelayMs: 40,
    preDelayMs: 180,
    charDelayMs: 2,
    linePauseMs: 180,
    holdMs: 1500,
    frameDelayMs: 16,
    durationMs: 0
  });

  const fallback = idle.resolveTiming(profiles, { timingProfile: 'missing' }, (name) => warnings.push(name));
  assert.equal(fallback.typingDelayMs, 24);
  assert.equal(fallback.holdMs, 1500);
  assert.deepEqual(warnings, ['missing']);
});

test('sequential scheduler awaits each entry and stops without starting another one', async () => {
  const gates = [deferred(), deferred()];
  const started = [];
  let selected = 0;
  const scheduler = idle.createSequentialScheduler({
    select: () => ({ id: ++selected }),
    play: async (entry) => {
      started.push(entry.id);
      await gates[entry.id - 1]?.promise;
    }
  });

  scheduler.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, [1]);

  gates[0].resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, [1, 2]);

  scheduler.stop();
  gates[1].resolve();
  await scheduler.finished();
  assert.deepEqual(started, [1, 2]);
  assert.equal(scheduler.isRunning(), false);
});

test('sequential scheduler reports one broken entry and continues with the next one', async () => {
  const errors = [];
  const played = [];
  const entries = [{ id: 'broken' }, { id: 'healthy' }];
  const scheduler = idle.createSequentialScheduler({
    delay: async () => {},
    select: () => entries.shift() || null,
    play: async (entry) => {
      played.push(entry.id);
      if (entry.id === 'broken') throw new Error('broken renderer');
    },
    onError: (error) => errors.push(error.message)
  });

  await scheduler.start();
  assert.deepEqual(played, ['broken', 'healthy']);
  assert.deepEqual(errors, ['broken renderer']);
});

test('terminal JSON files use the versioned global and contextual schemas', () => {
  const terminalRoot = path.join(__dirname, '..', 'src', 'assets', 'terminal');
  const globalConfig = JSON.parse(fs.readFileSync(path.join(terminalRoot, 'config.json'), 'utf8'));
  assert.equal(globalConfig.schemaVersion, 2);
  assert.deepEqual(globalConfig.pools.matrix.map((entry) => entry.cmd), [
    'cmatrix',
    'cat ~/.matrix/message.txt',
    'cat ~/.matrix/white-rabbit.txt'
  ]);

  const contextualFiles = [
    'default.json', 'projects.json', 'blog.json',
    'music/music.json', 'music/bio.json', 'music/event.json',
    'music/events.json', 'music/links.json', 'music/mixes.json',
    'music/photos.json', 'music/rider.json'
  ];
  contextualFiles.forEach((fileName) => {
    const config = JSON.parse(fs.readFileSync(path.join(terminalRoot, fileName), 'utf8'));
    assert.equal(config.schemaVersion, 2, fileName);
    assert.ok(Array.isArray(config.contextual), fileName);
    assert.equal('commands' in config, false, fileName);
  });
});

test('white rabbit idle output matches the compact filesystem artwork', () => {
  const config = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'assets', 'terminal', 'config.json'),
    'utf8'
  ));
  const idleRabbit = config.pools.matrix.find((entry) => entry.cmd.endsWith('white-rabbit.txt'));
  const manifestRabbit = buildTerminalFilesystem({}).entries.find(
    (entry) => entry.path === '/home/fm/.matrix/white-rabbit.txt'
  );

  assert.equal(`${idleRabbit.output.join('\n')}\n`, manifestRabbit.content);
  assert.ok(idleRabbit.output.every((line) => line.length <= 28));
  assert.match(manifestRabbit.content, /\${10}/);
  assert.doesNotMatch(manifestRabbit.content, /Follow the white rabbit/);
});
