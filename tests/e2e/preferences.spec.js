const { expect, gotoPath, test } = require('./fixtures');

test('theme follows system preference and persists after soft navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.formFactor !== 'desktop', 'Uses the visible primary navigation');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await gotoPath(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: '/projects' })
    .click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
});

test('reduced motion skips the boot overlay', async ({ page }) => {
  await gotoPath(page, '/');
  await expect(page.locator('#bootOverlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/\bbooting\b/);
});

test('normal motion shows and completes the boot sequence', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.formFactor !== 'desktop', 'Normal boot is covered once on desktop');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.__bootOverlayObserved = false;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && (node.id === 'bootOverlay' || node.querySelector('#bootOverlay'))) {
            window.__bootOverlayObserved = true;
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const response = await page.goto('/');
  expect(response.status()).toBeLessThan(400);

  await expect.poll(() => page.evaluate(() => window.__bootOverlayObserved)).toBe(true);
  await expect(page.locator('#bootOverlay')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('body')).not.toHaveClass(/\bbooting\b/);
});
