const {
  expect,
  expectAndClearRuntimeError,
  expectMainReady,
  gotoPath,
  test
} = require('./fixtures');

test('desktop links support route changes, repeated clicks, and history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.formFactor !== 'desktop', 'Desktop navigation only');
  await gotoPath(page, '/');

  const primary = page.getByRole('navigation', { name: 'Primary navigation' });
  await primary.getByRole('link', { name: '/projects' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expectMainReady(page);

  await primary.getByRole('link', { name: '/projects' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('.proj-list')).toBeVisible();

  await primary.getByRole('link', { name: '/blog' }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/projects\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/blog\/$/);
});

test('opening a collection group synchronizes its hash', async ({ page }) => {
  await gotoPath(page, '/music/events/');

  const group = page.locator('details.group').first();
  const slug = await group.getAttribute('data-slug');
  expect(slug).toBeTruthy();
  await group.locator(':scope > summary').click();

  await expect(group).toHaveAttribute('open', '');
  await expect(page).toHaveURL(new RegExp(`#${slug}$`));
});

test('a newer navigation wins over a slower response', async ({ page }) => {
  await gotoPath(page, '/');

  let releaseSlowRequest;
  let markSlowRequestStarted;
  const slowRequestStarted = new Promise((resolve) => {
    markSlowRequestStarted = resolve;
  });
  const slowRequest = new Promise((resolve) => {
    releaseSlowRequest = resolve;
  });

  await page.route('**/projects/', async (route) => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    markSlowRequestStarted();
    await slowRequest;
    await route.continue().catch(() => {});
  });

  await page.evaluate(() => {
    void window.terminalNavigate('/projects/');
  });
  await slowRequestStarted;
  await page.evaluate(() => window.terminalNavigate('/blog/'));
  releaseSlowRequest();

  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator('.blog-archive')).toBeVisible();
});

test('a failed soft document request falls back to a hard navigation', async ({
  page,
  runtimeErrors
}, testInfo) => {
  test.skip(testInfo.project.metadata.formFactor !== 'desktop', 'Uses the visible primary navigation');
  await gotoPath(page, '/');

  let failedSoftRequest = false;
  await page.route('**/projects/', async (route) => {
    if (!failedSoftRequest && route.request().resourceType() === 'fetch') {
      failedSoftRequest = true;
      await route.fulfill({ status: 503, body: 'temporary failure' });
      return;
    }
    await route.continue();
  });

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: '/projects' })
    .click();

  await expect(page).toHaveURL(/\/projects\/$/);
  await expectMainReady(page);
  expect(failedSoftRequest).toBe(true);
  expectAndClearRuntimeError(runtimeErrors, /503 \(Service Unavailable\)/);
});
