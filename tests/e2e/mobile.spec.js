const { expect, gotoPath, test } = require('./fixtures');

function skipDesktop(testInfo) {
  test.skip(testInfo.project.metadata.formFactor !== 'mobile', 'Mobile drawer only');
}

async function openDrawer(page) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  const drawer = page.locator('#mobileDrawer');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  return { drawer, menu };
}

test('the close button restores the drawer ARIA state', async ({ page }, testInfo) => {
  skipDesktop(testInfo);
  await gotoPath(page, '/');
  const { drawer, menu } = await openDrawer(page);

  await drawer.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
});

test('the backdrop closes the drawer', async ({ page }, testInfo) => {
  skipDesktop(testInfo);
  await gotoPath(page, '/');
  const { drawer, menu } = await openDrawer(page);

  await page.locator('#backdrop').click({ position: { x: 350, y: 20 } });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
});

test('choosing a route closes the drawer and navigates', async ({ page }, testInfo) => {
  skipDesktop(testInfo);
  await gotoPath(page, '/');
  const { drawer, menu } = await openDrawer(page);

  await drawer.getByRole('link', { name: '/music' }).click();
  await expect(page).toHaveURL(/\/music\/$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
});
