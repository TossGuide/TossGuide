import { test, expect } from '@playwright/test';
import { expectDestination, hook, openStubbed, typeItem } from './helpers';

test.describe('impact tally + leaderboard', () => {
  test('tally counts only diverted items; the leaderboard updates after a scan', async ({ page }, info) => {
    await openStubbed(page);
    // Pick a faculty (unique per project so parallel runs don't collide on the shared server).
    const faculty = info.project.name === 'mobile' ? 'Engineering' : 'Science';
    await page.getByRole('button', { name: 'Impact', exact: true }).click();
    await page.getByLabel('Your faculty').selectOption(faculty);

    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await typeItem(page, 'pop can');
    await expectDestination(page, 'bottle_depot');
    await expect(page.locator('#tally-line')).toContainText('+1 kept out of landfill');
    expect((await hook(page, 'tally')).itemsDiverted).toBe(1);

    await page.getByRole('button', { name: 'Scan another' }).click();
    await page.getByRole('button', { name: 'Campus', exact: true }).click();
    await typeItem(page, 'chip bag');
    await expectDestination(page, 'uofa_landfill');
    await expect(page.locator('#tally-line')).toContainText('isn’t counted');
    const t = await hook(page, 'tally');
    expect(t).toMatchObject({ scans: 2, itemsDiverted: 1 });

    await page.getByRole('button', { name: 'Impact', exact: true }).click();
    await expect(page.getByTestId('items-diverted')).toHaveText('1');
    const row = page.locator('.board li', { hasText: faculty });
    await expect(row).toBeVisible();
    await expect(row).toContainText('(you)');
    await expect(row.locator('.board-num')).toContainText('1');
    // Scans (including the landfill one) are counted on the server even though the row shows only diverted items.
    const lb = await hook(page, 'leaderboard');
    expect(lb.rows.find((r: { faculty: string }) => r.faculty === faculty)).toMatchObject({ scans: 2, itemsDiverted: 1 });
  });

  test('a correction ("Not right?") replaces the scan instead of counting twice', async ({ page }) => {
    await openStubbed(page);
    await typeItem(page, 'pop can');
    await expectDestination(page, 'bottle_depot');
    await page.getByRole('button', { name: 'Not right?' }).click();
    await page.getByLabel('What are you holding?').fill('chip bag');
    await page.getByRole('button', { name: 'Find the bin' }).click();
    await expectDestination(page, 'edm_blue_bag');
    expect(await hook(page, 'tally')).toMatchObject({ scans: 1, itemsDiverted: 1 });
  });

  test('backend down: sorting still works and the leaderboard says offline', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await openStubbed(page);
    await typeItem(page, 'pop can');
    await expectDestination(page, 'bottle_depot');
    await page.getByRole('button', { name: 'Impact', exact: true }).click();
    await expect(page.getByText('Leaderboard offline.')).toBeVisible();
    await expect(page.getByTestId('items-diverted')).toHaveText('1');
  });
});
