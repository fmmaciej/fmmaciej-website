const { expect, expectMainReady, gotoPath, test } = require('./fixtures');

test('every public sitemap route renders without runtime errors', async ({ page, request }) => {
  test.slow();
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);

  const sitemap = await response.text();
  const paths = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, location]) => {
    const url = new URL(location);
    return `${url.pathname}${url.search}${url.hash}`;
  });

  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    await gotoPath(page, path);
  }
});

test('soft navigation synchronizes route-specific styles and scripts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.formFactor !== 'desktop', 'Primary links are hidden on mobile');
  await gotoPath(page, '/');

  const primary = page.getByRole('navigation', { name: 'Primary navigation' });
  await primary.getByRole('link', { name: '/projects' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('link[data-page-style][href="/assets/css/sections/projects.css"]')).toHaveCount(1);
  await expectMainReady(page);

  await primary.getByRole('link', { name: '/blog' }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator('link[data-page-style][href="/assets/css/sections/blog-archive.css"]')).toHaveCount(1);
  await expect(page.locator('script[data-page-script][src="/assets/js/pages/page-boot.js"]')).toHaveCount(1);
  await expectMainReady(page);
});
