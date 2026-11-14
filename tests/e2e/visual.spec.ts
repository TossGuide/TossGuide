/** Visual regression: result card and impact screen (dynamic numbers masked). */
import { test, expect } from '@playwright/test';
import { openStubbed, typeItem } from './helpers';

test.use({ deviceScaleFactor: 1 });

test('result card looks right', async ({ page }) => {
  await openStubbed(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await typeItem(page, 'coffee cup');
  await page.waitForTimeout(300);
  await expect(page.locator('.result')).toHaveScreenshot('result-coffee-cup.png', { mask: [page.locator('#tally-line')] });
});

test('impact screen looks right', async ({ page }) => {
  await page.route('**/api/leaderboard', (r) => r.fulfill({ json: { faculties: [] } }));
  await openStubbed(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('.impact')).toHaveScreenshot('impact.png', { mask: [page.locator('.stat-num')] });
});
