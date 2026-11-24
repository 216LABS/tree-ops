import { devices, expect, test } from '@playwright/test';
import { acceptDialogs, photo, shareUrl, sign, signInDemo, sql } from './helpers';

/**
 * docs/SPEC.md section 16, E2E: estimate -> approve -> schedule -> link -> briefing -> confirm -> close -> pay, plus the
 * proof packet's hash staying the same when rebuilt with no new records.
 */
test('estimate to paid invoice, with a stable proof packet', async ({ page, browser }) => {
  acceptDialogs(page);
  await signInDemo(page);

  // A new customer who said OK to texts, with a pinned property.
  await page.goto('/customers');
  await page.getByTestId('new-customer').click();
  await page.locator('#cn').fill('E2E Homeowner');
  await page.locator('#cp').fill('(330) 555-0177');
  await page.getByText('They said it’s OK to text them').click();
  await page.locator('#pa').fill('77 Test Hollow Ln');
  await page.locator('#pc').fill('Kent');
  await page.locator('#plat').fill('41.1601');
  await page.locator('#plon').fill('-81.3702');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL('**/properties/**');

  // The sales arborist's estimate: a tree, a photo with its number circled, a priced removal.
  await page.getByTestId('new-estimate').click();
  await page.waitForURL('**/estimates/**');
  await page.getByTestId('add-tree').click();
  await page.getByLabel('Species').fill('Red oak');
  await page.getByLabel('DBH (in)').fill('24');
  await page.getByTestId('photo-input-1').setInputFiles(photo(3));
  const editor = page.getByTestId('markup-editor');
  await expect(editor).toBeVisible();
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45, { steps: 4 });
  await page.mouse.up();
  await page.getByTestId('save-markup').click();
  await page.getByRole('button', { name: '+ Remove' }).click();
  await page.getByTestId('line-price').first().fill('1400');
  await page.getByTestId('line-price').first().press('Tab');
  await page.getByLabel('Crew hours').first().fill('6');
  await expect(page.getByTestId('sync-badge')).toHaveText('Synced', { timeout: 30_000 });
  await expect(page.getByTestId('estimate-total')).toHaveText('$1,400.00');
  await page.getByTestId('send-estimate').click();
  const estimateUrl = await shareUrl(page);

  // The customer, on their phone, no account.
  const customer = await (await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' } as never)).newPage();
  await customer.goto(estimateUrl);
  await expect(customer.getByTestId('customer-tree-1')).toBeVisible();
  await expect(customer.getByTestId('tree-number').first()).toHaveText('1');
  await customer.getByLabel('Your full name').fill('Pat E2E');
  await sign(customer);
  await customer.getByTestId('consent').check();
  await customer.getByTestId('approve').click();
  await expect(customer.getByTestId('approved')).toBeVisible();
  // 25% deposit (the demo company's default), paid through the mock checkout.
  await customer.getByTestId('pay-deposit').click();
  await customer.getByTestId('mock-pay').click();
  await customer.waitForURL('**/e/**');
  await expect(customer.getByText('Deposit received')).toBeVisible();

  // The office schedules it and sends the crew link.
  await page.goto(page.url());
  await page.getByRole('link', { name: /Open job/ }).click();
  await page.waitForURL('**/jobs/**');
  const jobUrl = page.url();
  await page.getByTestId('schedule-day').click();
  await page.locator('#sd').fill(new Date().toISOString().slice(0, 10));
  await page.getByTestId('save-day').click();
  await expect(page.getByTestId('job-day')).toHaveCount(1);
  await page.getByTestId('crew-link').click();
  const crewUrl = await shareUrl(page);

  // The crew: arrive, briefing, sign, confirm the tree with before and after photos.
  const crew = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  await crew.goto(crewUrl);
  await crew.getByTestId('arrive-Dana Brooks (DEMO)').click();
  await crew.getByTestId('go-next').click();
  for (const h of ['drop_zone', 'traffic', 'structures', 'weather', 'lines', 'rescue']) await crew.getByTestId(`hazard-${h}`).click();
  await crew.getByTestId('finish-briefing').click();
  await crew.getByTestId('sign-Dana Brooks (DEMO)').click();
  await crew.getByTestId('to-trees').click();
  await crew.getByTestId('before-photo-1').setInputFiles(photo(11));
  await crew.getByTestId('after-photo-1').setInputFiles(photo(12));
  await crew.getByTestId('done-1').click();
  await expect(crew.getByText('All trees done.')).toBeVisible();
  await expect(crew.getByTestId('crew-sync')).toHaveText('Synced', { timeout: 60_000 });

  // Close and bill: $1,400 less the $350 deposit.
  await page.goto(jobUrl);
  await expect(page.getByText(/Tree 1.*: done/)).toBeVisible();
  await page.getByTestId('close-job').click();
  await page.getByRole('link', { name: /^\d+$/ }).first().click();
  await page.waitForURL('**/invoices/**');
  await expect(page.getByTestId('invoice-total')).toHaveText('$1,050.00');
  await page.getByTestId('send-invoice').click();
  const invoiceUrl = await shareUrl(page);
  await customer.goto(invoiceUrl);
  await customer.getByTestId('pay-invoice').click();
  await customer.getByTestId('mock-pay').click();
  await customer.waitForURL('**/i/**');
  await customer.reload();
  await expect(customer.getByTestId('paid')).toHaveText('Paid. Thank you.');

  // Proof packet: building twice with nothing new gives the same hash.
  await page.goto(jobUrl);
  await page.getByTestId('proof-packet').click();
  const hash1 = (await page.getByTestId('proof-hash').textContent())!.trim();
  expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  await page.getByTestId('proof-packet').click();
  await expect(page.getByTestId('proof-hash')).toHaveText(hash1);

  // The database agrees: one confirmation, two crew photos, one payment each for deposit and invoice.
  const db = sql();
  const jobId = jobUrl.split('/').pop()!;
  const [counts] = await db`select
    (select count(*)::int from tree_confirmations tc join job_days jd on jd.id = tc.job_day_id where jd.job_id = ${jobId}) as confirmations,
    (select count(*)::int from photos p join job_days jd on jd.id = p.job_day_id where jd.job_id = ${jobId}) as photos,
    (select count(*)::int from payments p join invoices i on i.id = p.invoice_id where i.job_id = ${jobId}) as invoice_payments,
    (select status from jobs where id = ${jobId}) as status`;
  await db.end();
  expect(counts).toEqual({ confirmations: 1, photos: 2, invoice_payments: 1, status: 'billed' });
});
