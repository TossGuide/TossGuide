import { test, expect } from '@playwright/test';
import { expectDestination, hook, waitModelReady } from './helpers';

test.use({ serviceWorkers: 'allow' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'runs once (mobile project)'));

test('@real-model offline: after one visit, the app and model work with no network', async ({ page, context }) => {
  await page.goto('/');
  await waitModelReady(page);
  // Wait until the service worker controls the page (it precaches the app shell).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });

  await context.setOffline(true);
  await page.reload();
  await waitModelReady(page, 60_000);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload a photo' }).click()]);
  await chooser.setFiles('tests/fixtures/coffee_cup.jpg');
  await page.waitForFunction(() => ['result', 'question', 'picker'].includes((window as any).__trashifyyeg?.screen));
  if ((await hook(page, 'screen')) === 'picker') await page.locator('.choice', { hasText: 'coffee cup' }).first().click();
  await expectDestination(page, 'edm_blue_bag');

  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await expect(page.getByText('Leaderboard offline.')).toBeVisible();
});

test('the install manifest is never stuck on an old cached copy (app name after a rename)', async ({ page, context }) => {
  await page.goto('/?stub=1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
  // Plant a stale manifest (an old app name) in the offline cache, as an old version would have.
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((k) => k.startsWith('trashifyyeg-shell-'))!;
    const stale = new Response(JSON.stringify({ name: 'TossGuide', short_name: 'TossGuide' }), {
      headers: { 'Content-Type': 'application/manifest+json' },
    });
    await (await caches.open(name)).put('/manifest.webmanifest', stale);
  });
  const online = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  expect(online.short_name).toBe('TrashifyYEG');

  // Offline it still answers, from the copy the online fetch just refreshed.
  await context.setOffline(true);
  const offline = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  expect(offline.short_name).toBe('TrashifyYEG');
  await context.setOffline(false);
});
