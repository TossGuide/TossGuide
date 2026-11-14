/**
 * Camera lifecycle: the preview must keep playing after a scan ("Scan another" used to
 * show a black viewport), and the app must ask for camera permission only once per visit.
 */
import { test, expect, type Page } from '@playwright/test';
import { openStubbed } from './helpers';

/** The preview is really live: attached, playing, and frames are advancing. */
async function expectPreviewLive(page: Page) {
  await expect(page.locator('.viewport video')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => {
      const v = document.querySelector<HTMLVideoElement>('.viewport video');
      return !!v && !v.paused && v.readyState >= 2 && v.videoWidth > 0;
    }))
    .toBe(true);
  const t0 = await page.evaluate(() => document.querySelector<HTMLVideoElement>('.viewport video')!.currentTime);
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('.viewport video')!.currentTime)).toBeGreaterThan(t0);
}

async function countGetUserMedia(page: Page) {
  await page.addInitScript(() => {
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).__gumCalls = 0;
    navigator.mediaDevices.getUserMedia = (c) => {
      (window as any).__gumCalls++;
      return orig(c);
    };
  });
}

test('camera keeps working after "Scan another", and permission is asked only once', async ({ page }) => {
  await countGetUserMedia(page);
  await openStubbed(page);
  await expectPreviewLive(page);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__trashifyyeg.useStub([{ itemId: 'pop_can', score: 0.97 }]));
    await page.getByRole('button', { name: 'Scan item' }).click();
    await expect(page.locator('.result')).toBeVisible();
    await page.getByRole('button', { name: 'Scan another' }).click();
    await expectPreviewLive(page);
  }

  // Through other screens and back.
  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expectPreviewLive(page);
  await page.getByRole('button', { name: 'Type the item' }).click();
  await page.getByRole('button', { name: /camera instead|Back/ }).click();
  await expectPreviewLive(page);

  expect(await page.evaluate(() => (window as any).__gumCalls)).toBe(1);
});

test('if the camera track ends (e.g. the phone locked), returning to Scan restarts it', async ({ page }) => {
  await countGetUserMedia(page);
  await openStubbed(page);
  await expectPreviewLive(page);
  await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('.viewport video')!;
    for (const t of (v.srcObject as MediaStream).getTracks()) {
      t.stop();
      t.dispatchEvent(new Event('ended'));
    }
  });
  await page.getByRole('button', { name: 'Impact', exact: true }).click();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expectPreviewLive(page);
  expect(await page.evaluate(() => (window as any).__gumCalls)).toBe(2);
});
