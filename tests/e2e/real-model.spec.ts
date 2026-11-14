/**
 * @real-model tests: download and run the actual CLIP model (needs internet on the
 * first load, ~90 MB). They run in the mobile project only, to keep the suite fast.
 * Photos: tests/fixtures/*.jpg (Wikimedia Commons, credited in tests/fixtures/CREDITS.md).
 */
import { test, expect } from '@playwright/test';
import { expectDestination, hook, waitModelReady } from './helpers';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'real-model tests run once (mobile project)'));

/** If the app asks us to confirm, pick the expected item (the model ranked it, we just confirm). */
async function confirmIfAsked(page: import('@playwright/test').Page, name: string) {
  await page.waitForFunction(() => ['result', 'question', 'picker'].includes((window as any).__tossguide?.screen));
  if ((await hook(page, 'screen')) === 'picker') await page.locator('.choice', { hasText: name }).first().click();
}

test('@real-model app loads without errors, shows loading, then the model is ready', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.getByText('Loading the on-device model')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan item' })).toBeDisabled();
  await waitModelReady(page);
  await expect(page.getByRole('button', { name: 'Scan item' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('@real-model fake camera: scanning a coffee cup gives the blue bag with reason and source', async ({ page }) => {
  await page.goto('/');
  await waitModelReady(page);
  await expect(page.locator('.frame-guide')).toBeVisible(); // camera is live (fake device)
  await page.getByRole('button', { name: 'Scan item' }).click();
  await confirmIfAsked(page, 'coffee cup');
  const pred = await hook(page, 'lastPrediction');
  expect(pred.candidates.slice(0, 3).map((c: { itemId: string }) => c.itemId)).toContain('coffee_cup');
  await expectDestination(page, 'edm_blue_bag');
  await expect(page.locator('.reason')).not.toBeEmpty();
  await expect(page.locator('.sources a').first()).toHaveAttribute('href', /edmonton\.ca/);
});

test('@real-model upload: pizza box asks about grease, and the answer changes the bin', async ({ page }) => {
  await page.goto('/');
  await waitModelReady(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload a photo' }).click()]);
  await chooser.setFiles('tests/fixtures/pizza_box.jpg');
  await confirmIfAsked(page, 'Pizza box');
  await expect(page.locator('.question-text')).toContainText(/grease|greasy/i);
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expectDestination(page, 'edm_blue_bag');
});
