const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const matrix = require('../src/assets/js/components/terminal-matrix.js');

test('Matrix model creates varied columns and advances or restarts their heads', () => {
  const values = [0, 0.25, 0.75, 0.5];
  let index = 0;
  const random = () => values[index++ % values.length];
  const model = matrix.createMatrixModel({ width: 48, height: 64, fontSize: 16, random });

  assert.equal(model.columns.length, 3);
  assert.ok(model.columns.every((column) => column.speed >= 0.45 && column.speed <= 1.35));
  const previousHead = model.columns[0].head;
  matrix.advanceMatrixModel(model, random);
  assert.ok(model.columns[0].head > previousHead);

  model.columns[0].head = model.rows + model.columns[0].length + 1;
  matrix.advanceMatrixModel(model, () => 0.5);
  assert.ok(model.columns[0].head < 0);
});

test('Matrix frame draws a background, heads, and fading trail characters', () => {
  const calls = [];
  const context = {
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    textBaseline: '',
    fillRect: (...args) => calls.push(['rect', ...args]),
    fillText: (...args) => calls.push(['text', ...args])
  };
  const model = {
    width: 32,
    height: 64,
    rows: 4,
    fontSize: 16,
    columns: [{ x: 0, head: 3, speed: 1, length: 4 }]
  };

  matrix.drawMatrixFrame(context, model, { random: () => 0, charset: '0' });
  assert.deepEqual(calls[0], ['rect', 0, 0, 32, 64]);
  assert.equal(calls.filter(([type]) => type === 'text').length, 4);
  assert.equal(context.globalAlpha, 1);
});

test('Matrix start has a safe no-DOM fallback', async () => {
  const effect = matrix.start({});
  assert.deepEqual(await effect.finished, { cancelled: false, reason: 'unavailable' });
  assert.doesNotThrow(() => effect.cancel());
});

test('Matrix effect cancellation removes its canvas and reports the reason', async () => {
  const source = fs.readFileSync('src/assets/js/components/terminal-matrix.js', 'utf8');
  const timers = new Map();
  const frames = new Map();
  let nextId = 0;
  let removed = false;
  const drawingContext = {
    fillRect() {},
    fillText() {},
    setTransform() {}
  };
  const canvas = {
    style: {},
    getContext: () => drawingContext,
    remove: () => { removed = true; },
    setAttribute() {}
  };
  const browserWindow = {
    addEventListener() {},
    cancelAnimationFrame: (id) => frames.delete(id),
    clearTimeout: (id) => timers.delete(id),
    devicePixelRatio: 2,
    document: { createElement: () => canvas },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false }),
    removeEventListener() {},
    requestAnimationFrame(callback) {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    },
    setTimeout(callback) {
      const id = ++nextId;
      timers.set(id, callback);
      return id;
    }
  };
  vm.runInNewContext(source, { window: browserWindow });
  const mount = {
    appendChild() {},
    getBoundingClientRect: () => ({ width: 320, height: 180 })
  };

  const effect = browserWindow.terminalMatrix.start({ mount });
  effect.cancel('interrupt');
  const outcome = await effect.finished;
  assert.equal(outcome.cancelled, true);
  assert.equal(outcome.reason, 'interrupt');
  assert.equal(removed, true);
  assert.equal(timers.size, 0);
  assert.equal(frames.size, 0);
});
