/**
 * Shared helpers. "Stub" tests replace the model with fixed candidates through the
 * test hook (window.__binsight), so they're fast and deterministic. These candidate
 * lists are TEST FIXTURES, not real predictions; they never appear outside tests/.
 */
import { expect, type Page } from '@playwright/test';

export type Cand = { itemId: string; score: number };

export async function openStubbed(page: Page, path = '/') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}stub=1`);
  await page.waitForFunction(() => (window as any).__binsight?.modelReady === true);
  return errors;
}

/** Run one "photo" through the stubbed classifier (any pixels; the stub ignores them). */
export async function stubScan(page: Page, candidates: Cand[]) {
  await page.evaluate(async (c) => {
    const hook = (window as any).__binsight;
    hook.useStub(c);
    await (window as any).__binsight.classifyPixels({ data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 });
  }, candidates);
}

export async function waitModelReady(page: Page, timeout = 180_000) {
  await page.waitForFunction(() => (window as any).__binsight?.modelReady === true, null, { timeout });
}

export const hook = <T = any>(page: Page, key: string) =>
  page.evaluate((k) => (window as any).__binsight?.[k], key) as Promise<T>;

export async function expectDestination(page: Page, id: string) {
  await expect(page.locator('.result')).toHaveAttribute('data-destination', id);
}

export async function typeItem(page: Page, text: string) {
  await page.getByRole('button', { name: 'Type the item' }).click();
  await page.getByLabel('What are you holding?').fill(text);
  await page.getByRole('button', { name: 'Find the bin' }).click();
}
