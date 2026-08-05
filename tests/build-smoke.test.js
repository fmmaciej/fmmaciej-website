const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const shell = require('../src/assets/js/components/terminal-shell-core.js');

test('built homepage loads boot and runtime coordinators exactly once and in order', () => {
  const html = fs.readFileSync('www/index.html', 'utf8');
  const count = (pattern) => (html.match(pattern) || []).length;

  assert.equal(count(/\/assets\/js\/core\/boot\.js/g), 1);
  assert.equal(count(/\/assets\/js\/components\/terminal-shell-coordinator\.js/g), 1);
  assert.equal(count(/\/assets\/js\/components\/terminal-idle-core\.js/g), 1);
  assert.equal(count(/\/assets\/js\/components\/terminal-matrix\.js/g), 1);
  assert.equal(count(/\/assets\/js\/core\/navigation-coordinator\.js/g), 1);
  assert.ok(
    html.indexOf('/assets/js/components/terminal-matrix.js')
      < html.indexOf('/assets/js/components/terminal-shell.js')
  );
  assert.ok(
    html.indexOf('/assets/js/components/terminal-matrix.js')
      < html.indexOf('/assets/js/components/terminal.js')
  );
  assert.ok(
    html.indexOf('/assets/js/components/terminal-shell-coordinator.js')
      < html.indexOf('/assets/js/components/terminal-shell.js')
  );
  assert.ok(
    html.indexOf('/assets/js/core/navigation-coordinator.js')
      < html.indexOf('/assets/js/core/transitions.js')
  );
});

test('homepage long listing stays consistent with the generated terminal filesystem', () => {
  const config = JSON.parse(fs.readFileSync('www/assets/terminal/default.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('www/assets/terminal/filesystem.json', 'utf8'));
  const listing = config.contextual.find((entry) => entry.cmd === 'ls -al ~');
  assert.ok(listing);
  const filesystem = shell.createFilesystem(manifest);
  const result = shell.executeCommand(filesystem, {
    user: 'guest',
    cwd: '/home/guest',
    previousCwd: null,
    history: [],
    loginStack: []
  }, listing.cmd);

  assert.equal(listing.output.join('\n'), result.output);
  assert.match(result.output, /^dr-xr-x---.*\.matrix\/$/m);
});
