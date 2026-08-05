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
  await expect.poll(() => drawer.evaluate((element) => {
    return Math.abs(element.getBoundingClientRect().left) < 1;
  })).toBe(true);
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

test('the drawer and backdrop stay above page stacking contexts', async ({ page }, testInfo) => {
  skipDesktop(testInfo);
  await gotoPath(page, '/');
  const { drawer } = await openDrawer(page);
  const backdrop = page.locator('#backdrop');

  await expect(drawer).toHaveCSS('z-index', '101');
  await expect(backdrop).toHaveCSS('z-index', '100');
  const stacking = await page.evaluate(() => {
    const drawerElement = document.querySelector('#mobileDrawer');
    const backdropElement = document.querySelector('#backdrop');
    const terminalElement = document.querySelector('.terminal-box');
    const drawerRect = drawerElement.getBoundingClientRect();
    const terminalRect = terminalElement.getBoundingClientRect();
    const overlapX = Math.max(drawerRect.left + 1, terminalRect.left + 1);
    const overlapY = Math.max(drawerRect.top + 1, terminalRect.top + 1);
    const overTerminal = document.elementFromPoint(overlapX, overlapY);
    const outsideDrawer = document.elementFromPoint(innerWidth - 1, innerHeight / 2);
    return {
      drawerAboveTerminal: drawerElement.contains(overTerminal),
      backdropAboveContent: outsideDrawer === backdropElement
    };
  });

  expect(stacking).toEqual({
    drawerAboveTerminal: true,
    backdropAboveContent: true
  });
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
