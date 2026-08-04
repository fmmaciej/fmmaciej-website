const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const navigation = require('../src/assets/js/core/navigation-coordinator.js');
const shellRuntime = require('../src/assets/js/components/terminal-shell-coordinator.js');

function terminalActionsFixture(currentHref = 'https://example.com/music/') {
  const context = {
    URL,
    location: new URL(currentHref),
    window: {}
  };
  vm.runInNewContext(
    fs.readFileSync('src/assets/js/components/terminal-actions-utils.js', 'utf8'),
    context
  );
  vm.runInNewContext(
    fs.readFileSync('src/assets/js/components/terminal-actions.js', 'utf8'),
    context
  );

  function anchor(href, options = {}) {
    return {
      dataset: {},
      href: new URL(href, currentHref).href,
      rel: options.rel || '',
      target: options.target || '',
      getAttribute: (name) => name === 'href' ? href : null,
      hasAttribute: (name) => name === 'download' && !!options.download
    };
  }

  return {
    actions: context.window.terminalActions,
    anchor,
    event: { ctrlKey: false, metaKey: false, shiftKey: false },
    utils: context.window.terminalActionUtils
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function navigationFixture(overrides = {}) {
  const commits = [];
  const hashes = [];
  const fallbacks = [];
  const fixture = {
    commits,
    fallbacks,
    hashes,
    coordinator: navigation.createNavigationCoordinator({
      getCurrentUrl: () => 'https://example.com/start/',
      resolveUrl: (value, base) => new URL(value, base).href,
      isSameDocument: (current, target) => {
        const currentUrl = new URL(current);
        const targetUrl = new URL(target);
        return currentUrl.origin === targetUrl.origin
          && currentUrl.pathname === targetUrl.pathname
          && currentUrl.search === targetUrl.search;
      },
      loadPage: async (url, context) => ({ url, context }),
      commitPage: async (page, context) => commits.push({ page, context }),
      commitHash: async (url, context) => hashes.push({ url, context }),
      hardNavigate: (url, context) => fallbacks.push({ url, context }),
      ...overrides
    })
  };
  return fixture;
}

function bootFixture(reducedMotion) {
  const classes = new Set();
  const timers = new Map();
  const frames = new Map();
  const elements = new Map();
  let elementCount = 0;
  let nextId = 0;

  function classList() {
    const values = new Set();
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name))
    };
  }

  function createElement() {
    elementCount += 1;
    const element = {
      classList: classList(),
      appendChild() {},
      remove() {
        if (element.id) elements.delete(element.id);
      },
      querySelector: () => ({ appendChild() {}, scrollHeight: 0, scrollTop: 0 }),
      set id(value) {
        this._id = value;
        elements.set(value, this);
      },
      get id() { return this._id; }
    };
    return element;
  }

  const bodyClassList = {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name))
  };
  const context = {
    console: { warn() {} },
    document: {
      body: {
        classList: bodyClassList,
        appendChild(element) {
          if (element.id) elements.set(element.id, element);
        }
      },
      createElement,
      getElementById: (id) => elements.get(id) || null
    },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      setTimeout(callback) {
        const id = ++nextId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame(callback) {
        const id = ++nextId;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => frames.delete(id)
    }
  };
  return {
    classes,
    context,
    elementCount: () => elementCount,
    frames,
    timers
  };
}

test('same-document URL classification ignores hashes but respects route, query, and origin', () => {
  const { utils } = terminalActionsFixture();

  assert.equal(utils.isSameDocumentUrl(
    'https://example.com/music/?view=grid#first',
    'https://example.com/music/?view=grid#second'
  ), true);
  assert.equal(utils.isSameDocumentUrl(
    'https://example.com/music/?view=grid',
    'https://example.com/music/?view=list'
  ), false);
  assert.equal(utils.isSameDocumentUrl(
    'https://example.com/music/',
    'https://example.com/projects/'
  ), false);
  assert.equal(utils.isSameDocumentUrl(
    'https://example.com/music/',
    'https://portfolio.example/music/'
  ), false);
  assert.equal(utils.isSameDocumentUrl('not-an-absolute-url', '/music/'), false);
  assert.equal(utils.isSameDocumentUrl('https://example.com/music/', 'http://['), false);
});

test('terminal link actions resume idle only when a transition keeps the current document', () => {
  const fixture = terminalActionsFixture();
  const resolve = (href, options) => fixture.actions.resolveAction(
    fixture.anchor(href, options),
    fixture.event
  );

  const current = resolve('/music/');
  assert.equal(current.name, 'internal-navigation');
  assert.equal(current.resumeCycleAfterMs, 1200);

  const currentHash = resolve('/music/#section');
  assert.equal(currentHash.name, 'internal-navigation');
  assert.equal(currentHash.resumeCycleAfterMs, 1200);

  const otherPage = resolve('/projects/');
  assert.equal(otherPage.name, 'internal-navigation');
  assert.equal(otherPage.resumeCycleAfterMs, 0);

  const native = resolve('https://outside.example/profile', { target: '_blank' });
  assert.equal(native.name, 'external-link');
  assert.equal(native.resumeCycleAfterMs, 1200);

  assert.equal(resolve('#section'), null);
});

test('latest navigation wins and a stale response never commits', async () => {
  const first = deferred();
  const second = deferred();
  const fixture = navigationFixture({
    loadPage: (url) => url.endsWith('/first/') ? first.promise : second.promise
  });

  const firstNavigation = fixture.coordinator.navigate('/first/');
  await Promise.resolve();
  const secondNavigation = fixture.coordinator.navigate('/second/');
  second.resolve({ name: 'second' });
  assert.equal((await secondNavigation).status, 'committed');
  first.resolve({ name: 'first' });
  assert.equal((await firstNavigation).status, 'superseded');

  assert.deepEqual(fixture.commits.map(({ page }) => page.name), ['second']);
  assert.equal(fixture.fallbacks.length, 0);
});

test('aborted navigation does not trigger a hard fallback', async () => {
  const fixture = navigationFixture({
    loadPage: (url, context) => new Promise((resolve, reject) => {
      if (url.endsWith('/second/')) {
        resolve({ name: 'second' });
        return;
      }
      context.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })
  });

  const firstNavigation = fixture.coordinator.navigate('/first/');
  await Promise.resolve();
  const secondNavigation = fixture.coordinator.navigate('/second/');
  assert.equal((await firstNavigation).status, 'superseded');
  assert.equal((await secondNavigation).status, 'committed');
  assert.equal(fixture.fallbacks.length, 0);
});

test('navigation failure triggers one fallback with the history mode intact', async () => {
  const fixture = navigationFixture({
    loadPage: async () => { throw new Error('offline'); }
  });

  const result = await fixture.coordinator.navigate('/target/', { pushHistory: false });
  assert.equal(result.status, 'fallback');
  assert.equal(fixture.fallbacks.length, 1);
  assert.equal(fixture.fallbacks[0].url, 'https://example.com/target/');
  assert.equal(fixture.fallbacks[0].context.pushHistory, false);
});

test('same-document hash navigation skips fetch and preserves popstate mode', async () => {
  let loads = 0;
  const fixture = navigationFixture({
    loadPage: async () => {
      loads += 1;
      return {};
    }
  });

  const result = await fixture.coordinator.navigate('/start/#project', { pushHistory: false });
  assert.equal(result.status, 'committed');
  assert.equal(loads, 0);
  assert.equal(fixture.hashes.length, 1);
  assert.equal(fixture.hashes[0].context.pushHistory, false);
});

test('document loader rejects HTTP, parse, and host failures', async (t) => {
  const validDocument = {
    documentElement: {},
    querySelector: () => ({ id: 'host' })
  };
  const cases = [
    {
      name: 'HTTP response',
      adapters: {
        fetchPage: async () => ({ ok: false, status: 503 }),
        parseDocument: () => validDocument
      }
    },
    {
      name: 'parse failure',
      adapters: {
        fetchPage: async () => ({ ok: true, text: async () => '<html>' }),
        parseDocument: () => null
      }
    },
    {
      name: 'missing host',
      adapters: {
        fetchPage: async () => ({ ok: true, text: async () => '<html></html>' }),
        parseDocument: () => ({ documentElement: {}, querySelector: () => null })
      }
    }
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      await assert.rejects(
        navigation.loadNavigationDocument('https://example.com/', {}, item.adapters)
      );
    });
  }
});

test('shell manifest is lazy and concurrent activations share one controller', async () => {
  const manifest = deferred();
  let loads = 0;
  let controllers = 0;
  let activations = 0;
  const runtime = shellRuntime.createTerminalShellCoordinator({
    loadManifest: () => {
      loads += 1;
      return manifest.promise;
    },
    createController: () => {
      controllers += 1;
      return {
        activate: () => {
          activations += 1;
          return true;
        }
      };
    }
  });

  assert.equal(loads, 0);
  const first = runtime.activate();
  const second = runtime.activate();
  await Promise.resolve();
  assert.equal(loads, 1);
  manifest.resolve({ entries: [] });
  assert.equal(await first, await second);
  assert.equal(controllers, 1);
  assert.equal(activations, 1);
  assert.equal(runtime.getState(), 'active');
});

test('failed shell load enters error state and a later activation retries', async () => {
  let loads = 0;
  let controllers = 0;
  const states = [];
  const runtime = shellRuntime.createTerminalShellCoordinator({
    loadManifest: async () => {
      loads += 1;
      if (loads === 1) throw new Error('offline');
      return { entries: [] };
    },
    createController: () => {
      controllers += 1;
      return { activate: () => true };
    }
  });
  const unsubscribe = runtime.subscribe((state) => states.push(state));

  await assert.rejects(runtime.activate(), /offline/);
  assert.equal(runtime.getState(), 'error');
  await runtime.activate();
  assert.equal(runtime.getState(), 'active');
  assert.equal(loads, 2);
  assert.equal(controllers, 1);

  unsubscribe();
  runtime.setState('idle');
  assert.deepEqual(states, ['idle', 'loading', 'error', 'loading', 'active']);
  assert.equal(runtime.getController() !== null, true);
});

test('shell activation binding can be disposed and rebound without duplicate listeners', () => {
  const activator = new EventTarget();
  const termBox = new EventTarget();
  let activations = 0;
  const bind = () => shellRuntime.bindTerminalActivation({
    activator,
    termBox,
    activate: () => { activations += 1; },
    getState: () => 'idle'
  });

  const disposeFirst = bind();
  activator.dispatchEvent(new Event('click'));
  disposeFirst();
  const disposeSecond = bind();
  activator.dispatchEvent(new Event('click'));
  disposeSecond();
  activator.dispatchEvent(new Event('click'));

  assert.equal(activations, 2);
});

test('boot is idempotent and cleanup removes pending work', () => {
  const source = fs.readFileSync('src/assets/js/core/boot.js', 'utf8');
  const fixture = bootFixture(false);

  vm.runInNewContext(source, fixture.context);
  const createdAfterFirstRun = fixture.elementCount();
  vm.runInNewContext(source, fixture.context);

  assert.equal(fixture.elementCount(), createdAfterFirstRun);
  assert.equal(fixture.classes.has('booting'), true);
  assert.ok(fixture.timers.size > 0);
  fixture.context.window.portfolioBootController.cleanup();
  assert.equal(fixture.classes.has('booting'), false);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.frames.size, 0);
});

test('boot skips its overlay when reduced motion is requested', () => {
  const source = fs.readFileSync('src/assets/js/core/boot.js', 'utf8');
  const fixture = bootFixture(true);

  vm.runInNewContext(source, fixture.context);

  assert.equal(fixture.elementCount(), 0);
  assert.equal(fixture.classes.has('booting'), false);
  assert.equal(fixture.timers.size, 0);
});
