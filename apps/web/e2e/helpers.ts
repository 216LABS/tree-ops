import { expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { demoTreePng } from '../lib/png';

export const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });

export const photo = (seed = 1) => ({ name: `tree-${seed}.png`, mimeType: 'image/png', buffer: Buffer.from(demoTreePng(seed, 640, 480)) });

export async function signInDemo(page: Page, as: 'owner' | 'sales' | 'office' = 'owner') {
  await page.goto('/login');
  await page.getByTestId(`demo-${as}`).click();
  await page.waitForURL('**/dashboard');
}

/** Draws a squiggle on a signature pad. */
export async function sign(page: Page) {
  const pad = page.getByTestId('signature-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 18, box.y + box.height / 2 + (i % 2 ? -25 : 25), { steps: 3 });
  await page.mouse.up();
}

export async function shareUrl(page: Page) {
  const link = page.getByTestId('share-url').last();
  await expect(link).toBeVisible();
  return (await link.textContent())!.trim();
}

export const acceptDialogs = (page: Page) => page.on('dialog', (d) => void d.accept());
