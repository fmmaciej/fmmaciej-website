const base = require('@playwright/test');

const test = base.test.extend({
  runtimeErrors: async ({}, use) => {
    await use([]);
  },

  page: async ({ page, baseURL, runtimeErrors }, use) => {
    const localOrigin = new URL(baseURL).origin;

    page.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(`console.error: ${message.text()}`);
      }
    });

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== localOrigin) {
        if (route.request().resourceType() === 'stylesheet') {
          await route.fulfill({
            status: 200,
            contentType: 'text/css',
            body: '/* External stylesheet intentionally replaced during E2E. */'
          });
          return;
        }
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });

    await use(page);

    base.expect(runtimeErrors, 'The page emitted JavaScript or console errors').toEqual([]);
  }
});

async function expectMainReady(page) {
  await base.expect(page.locator('main')).toBeVisible();
  await base.expect(page.locator('body')).not.toHaveClass(/\bbooting\b/);
}

async function gotoPath(page, path) {
  const response = await page.goto(path);
  base.expect(response, `No document response for ${path}`).not.toBeNull();
  base.expect(response.status(), `Unexpected status for ${path}`).toBeLessThan(400);
  await expectMainReady(page);
}

function expectAndClearRuntimeError(runtimeErrors, pattern) {
  const index = runtimeErrors.findIndex((message) => pattern.test(message));
  base.expect(index, `Expected a runtime error matching ${pattern}`).toBeGreaterThanOrEqual(0);
  runtimeErrors.splice(index, 1);
}

module.exports = {
  expect: base.expect,
  expectAndClearRuntimeError,
  expectMainReady,
  gotoPath,
  test
};
