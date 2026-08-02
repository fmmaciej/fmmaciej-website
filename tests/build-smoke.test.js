const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('built homepage loads boot and runtime coordinators exactly once and in order', () => {
  const html = fs.readFileSync('www/index.html', 'utf8');
  const count = (pattern) => (html.match(pattern) || []).length;

  assert.equal(count(/\/assets\/js\/core\/boot\.js/g), 1);
  assert.equal(count(/\/assets\/js\/components\/terminal-shell-coordinator\.js/g), 1);
  assert.equal(count(/\/assets\/js\/core\/navigation-coordinator\.js/g), 1);
  assert.ok(
    html.indexOf('/assets/js/components/terminal-shell-coordinator.js')
      < html.indexOf('/assets/js/components/terminal-shell.js')
  );
  assert.ok(
    html.indexOf('/assets/js/core/navigation-coordinator.js')
      < html.indexOf('/assets/js/core/transitions.js')
  );
});
