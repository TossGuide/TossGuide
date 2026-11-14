/**
 * @real-model Devpost screenshots, saved to docs/screenshots/<viewport>-<screen>.png.
 * Uses the real model and real fixture photos, so every number on screen is genuine.
 */
import { test, expect, type Page } from '@playwright/test';
import { hook, waitModelReady } from './helpers';

async function shot(page: Page, name: string, project: string) {
  await page.waitForTimeout(900); // let entrance animations finish
  await page.screenshot({ path: `docs/screenshots/${project}-${name}.png` });
}

async function upload(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload a photo' }).click()]);
  await chooser.setFiles(file);
  await page.waitForFunction(() => ['result', 'question', 'picker'].includes((window as any).__trashify?.screen));
}

test('@real-model screenshots for Devpost', async ({ page }, info) => {
  const p = info.project.name;
  await page.goto('/');
  await waitModelReady(page);
  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await page.getByLabel('Your scans count for').selectOption('Engineering');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('.frame-guide')).toBeVisible();
  await shot(page, '1-scan', p);

  // Result: live fake-camera scan of the coffee cup.
  await page.getByRole('button', { name: 'Scan item' }).click();
  await page.waitForFunction(() => ['result', 'question', 'picker'].includes((window as any).__trashify?.screen));
  if ((await hook(page, 'screen')) === 'picker') {
    await shot(page, '3-picker', p);
    await page.locator('.choice', { hasText: 'coffee cup' }).first().click();
  }
  await expect(page.locator('.result')).toBeVisible();
  await shot(page, '2-result', p);

  // Follow-up: uploaded pizza box photo.
  await page.getByRole('button', { name: 'Scan another' }).click();
  await upload(page, 'tests/fixtures/pizza_box.jpg');
  if ((await hook(page, 'screen')) === 'picker') await page.locator('.choice', { hasText: 'Pizza box' }).first().click();
  await expect(page.locator('.question-text')).toBeVisible();
  await shot(page, '4-follow-up', p);
  await page.getByRole('button', { name: 'No', exact: true }).click();

  // Campus difference on the same cup.
  await page.getByRole('button', { name: 'Scan another' }).click();
  await page.getByRole('button', { name: 'Type the item' }).click();
  await page.getByLabel('What are you holding?').fill('coffee cup');
  await page.getByRole('button', { name: 'Find the bin' }).click();
  await page.getByRole('button', { name: 'Campus', exact: true }).click();
  await expect(page.locator('.result')).toHaveAttribute('data-destination', 'uofa_landfill');
  await shot(page, '5-campus', p);

  // A pop can: the one item with a cited weight so far, so the CO2e estimate isn't 0.
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Scan another' }).click();
  await page.getByRole('button', { name: 'Type the item' }).click();
  await page.getByLabel('What are you holding?').fill('pop can');
  await page.getByRole('button', { name: 'Find the bin' }).click();
  await expect(page.locator('.result')).toHaveAttribute('data-destination', 'bottle_depot');

  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await expect(page.locator('.board, .callout.warn').first()).toBeVisible();
  await shot(page, '6-impact', p);
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await shot(page, '7-about', p);
});
