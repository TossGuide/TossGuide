import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openStubbed, stubScan, typeItem } from './helpers';

async function noSeriousViolations(page: Page, screen: string) {
  // Wait for entrance animations so colours are final when axe measures contrast.
  await page.waitForTimeout(700);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${screen}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

test('axe: no serious/critical violations on every screen', async ({ page }) => {
  await openStubbed(page);
  await noSeriousViolations(page, 'scan');
  await page.getByRole('button', { name: 'Type the item' }).click();
  await noSeriousViolations(page, 'type');
  await page.getByLabel('What are you holding?').fill('pizza box');
  await page.getByRole('button', { name: 'Find the bin' }).click();
  await noSeriousViolations(page, 'question');
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await noSeriousViolations(page, 'result');
  await page.getByRole('button', { name: 'Scan another' }).click();
  await stubScan(page, [{ itemId: 'coffee_cup', score: 0.3 }, { itemId: 'cold_cup', score: 0.25 }, { itemId: 'napkin', score: 0.2 }]);
  await noSeriousViolations(page, 'picker');
  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await noSeriousViolations(page, 'impact');
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await noSeriousViolations(page, 'about');
  for (const item of ['banana peel', 'paper', 'pop can', 'battery', 'receipt']) {
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await typeItem(page, item);
    if (await page.locator('.question-text').count()) await page.getByRole('button', { name: 'No', exact: true }).click();
    await noSeriousViolations(page, `result:${item}`);
  }
});

test('mobile layout: no horizontal scroll, shutter in the thumb zone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await openStubbed(page);
  for (const go of [async () => {}, async () => page.getByRole('button', { name: 'Impact', exact: true }).click(), async () => page.getByRole('button', { name: 'About', exact: true }).click()]) {
    await go();
    await page.waitForTimeout(300);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  }
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const box = await page.getByRole('button', { name: 'Scan item' }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height / 2).toBeGreaterThan(844 * 0.6); // lower 40% of the screen
  expect(box!.width).toBeGreaterThanOrEqual(44);
});

test('touch targets are at least 44 px', async ({ page }) => {
  await openStubbed(page);
  await typeItem(page, 'coffee cup');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a, select, input')]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ el: el.outerHTML.slice(0, 60), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 && r.width < 44 * 3 && r.height > 0)
      .filter(({ el }) => !el.startsWith('<a')) // inline text links in the sources list
      .map(({ el, r }) => `${el} ${Math.round(r.height)}px`),
  );
  expect(small).toEqual([]);
});
