const {
  expect,
  expectAndClearRuntimeError,
  expectMainReady,
  gotoPath,
  test
} = require('./fixtures');

async function activateShell(page) {
  const activator = page.getByRole('button', { name: 'Activate portfolio shell' });
  await activator.click();
  const input = page.getByLabel('Command');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  const activatorState = page.locator('#terminalActivator');
  await expect(activatorState).toHaveAttribute('aria-expanded', 'true');
  return { activator, activatorState, input };
}

test('the filesystem manifest stays lazy and the shell supports commands and completion', async ({ page }) => {
  const manifestRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/terminal/filesystem.json') {
      manifestRequests.push(request.url());
    }
  });

  await gotoPath(page, '/');
  expect(manifestRequests).toHaveLength(0);

  const { input } = await activateShell(page);
  expect(manifestRequests).toHaveLength(1);

  await input.fill('pwd');
  await input.press('Enter');
  await expect(page.locator('.terminal-shell-output').last()).toHaveText('/home/fm');

  await input.fill('pw');
  await input.press('Tab');
  await expect(input).toHaveValue('pwd ');
});

test('cd preserves the shell while open navigates and collapses it', async ({ page }) => {
  await gotoPath(page, '/');
  const { activatorState, input } = await activateShell(page);

  await input.fill('cd /home/fm/projects');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(activatorState).toHaveAttribute('aria-expanded', 'true');
  await expect(input).toBeFocused();
  await expect(page.locator('#terminalPath')).toHaveText('/home/fm/projects');

  await input.fill('open /home/fm/blog');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(activatorState).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#terminalShellPanel')).toBeHidden();
  await expectMainReady(page);
});

test('Escape restores activator focus and an outside click collapses without doing so', async ({ page }) => {
  await gotoPath(page, '/');
  let shell = await activateShell(page);

  await shell.input.press('Escape');
  await expect(shell.activatorState).toHaveAttribute('aria-expanded', 'false');
  await expect(shell.activatorState).toBeFocused();

  shell = await activateShell(page);
  await page.locator('footer').click({ position: { x: 5, y: 5 } });
  await expect(shell.activatorState).toHaveAttribute('aria-expanded', 'false');
  await expect(shell.activatorState).not.toBeFocused();
});

test('a failed manifest load exposes an error and the next activation retries', async ({
  page,
  runtimeErrors
}) => {
  let manifestAttempts = 0;
  await page.route('**/assets/terminal/filesystem.json', async (route) => {
    manifestAttempts += 1;
    if (manifestAttempts === 1) {
      await route.fulfill({ status: 503, body: 'temporary failure' });
      return;
    }
    await route.continue();
  });

  await gotoPath(page, '/');
  const activator = page.getByRole('button', { name: 'Activate portfolio shell' });
  await activator.click();

  const status = page.locator('#terminalShellStatus');
  await expect(status).toBeVisible();
  await expect(status).toContainText('filesystem unavailable');
  await expect(page.locator('.terminal-box')).toHaveClass(/\bis-shell-error\b/);

  await activator.click();
  await expect(page.getByLabel('Command')).toBeFocused();
  await expect(status).toBeHidden();
  expect(manifestAttempts).toBe(2);
  expectAndClearRuntimeError(runtimeErrors, /503 \(Service Unavailable\)/);
});
