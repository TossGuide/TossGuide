import { test, expect } from '@playwright/test';
import { expectDestination, hook, openStubbed, stubScan, typeItem } from './helpers';

test.describe('core flows (stubbed model)', () => {
  test('low confidence shows the top-3 picker, and picking gives the right result', async ({ page }) => {
    await openStubbed(page);
    await stubScan(page, [
      { itemId: 'coffee_cup', score: 0.34 },
      { itemId: 'cold_cup', score: 0.31 },
      { itemId: 'paper_takeout', score: 0.2 },
      { itemId: 'napkin', score: 0.15 },
    ]);
    await expect(page.getByRole('heading', { name: 'Is this a…' })).toBeVisible();
    const choices = page.locator('.choice');
    await expect(choices).toHaveCount(3);
    await choices.filter({ hasText: 'Coffee cup' }).click();
    await expectDestination(page, 'edm_blue_bag');
    await expect(page.locator('.sources a').first()).toHaveAttribute('href', /^https:\/\//);
  });

  test('top-2 in different bins asks even at high confidence', async ({ page }) => {
    await openStubbed(page);
    await stubScan(page, [
      { itemId: 'pop_can', score: 0.93 },
      { itemId: 'food_can', score: 0.05 },
      { itemId: 'glass_jar', score: 0.02 },
    ]);
    await expect(page.getByRole('heading', { name: 'Which one is it?' })).toBeVisible();
    await page.locator('.choice', { hasText: 'Pop' }).first().click();
    await expectDestination(page, 'bottle_depot');
  });

  test('type it: "battery" goes to the Eco Station', async ({ page }) => {
    await openStubbed(page);
    await typeItem(page, 'battery');
    await expectDestination(page, 'eco_station');
    await expect(page.locator('.dest-name')).toContainText('Eco Station');
  });

  test('campus toggle changes the answer where the rules differ (coffee cup)', async ({ page }) => {
    await openStubbed(page);
    await typeItem(page, 'coffee cup');
    await expectDestination(page, 'edm_blue_bag');
    await page.getByRole('button', { name: 'Campus', exact: true }).click();
    await expectDestination(page, 'uofa_landfill');
    await expect(page.locator('.dest-label')).toContainText('On campus');
    expect(await hook(page, 'context')).toBe('uofa-campus');
  });

  test('pizza box follow-up: Yes and No give different, correct answers', async ({ page }) => {
    await openStubbed(page);
    await stubScan(page, [{ itemId: 'pizza_box', score: 0.9 }, { itemId: 'cardboard_box', score: 0.08 }]);
    // cardboard_box and pizza_box can both reach the blue bag, but pizza can also be garbage
    // when greasy, so this may confirm first; pick pizza box if asked.
    if (await page.locator('.choice').count()) await page.locator('.choice', { hasText: 'Pizza box' }).click();
    await expect(page.locator('.question-text')).toBeVisible();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expectDestination(page, 'edm_black_cart');

    await page.getByRole('button', { name: 'Scan another' }).click();
    await typeItem(page, 'pizza box');
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expectDestination(page, 'edm_blue_bag');
  });

  test('uncertain items say "check first", never a confident guess', async ({ page }) => {
    await openStubbed(page);
    await typeItem(page, 'receipt');
    await expectDestination(page, 'check_local');
    await expect(page.locator('.callout.warn')).toBeVisible();
  });

  test('camera denied: friendly message and the upload/type fallbacks still work', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await openStubbed(page);
    await expect(page.getByText('Camera is blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload a photo' })).toBeEnabled();
    await typeItem(page, 'chip bag');
    await expectDestination(page, 'edm_blue_bag');
  });

  test('keyboard only: type an item and answer the follow-up', async ({ page }) => {
    await openStubbed(page);
    await page.getByRole('button', { name: 'Type the item' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('What are you holding?')).toBeFocused();
    await page.keyboard.type('pizza box');
    await page.keyboard.press('Enter');
    // Focus moves to the question heading; Tab reaches "Yes".
    await expect(page.locator('.question-text')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expectDestination(page, 'edm_black_cart');
    await expect(page.locator('#r-title')).toBeFocused();
  });

  test('the result is announced to screen readers', async ({ page }) => {
    await openStubbed(page);
    await typeItem(page, 'battery');
    await expect(page.locator('#announcer')).toContainText('Eco Station');
  });
});
