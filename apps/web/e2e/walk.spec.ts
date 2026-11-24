import { expect, test, type Page } from '@playwright/test';
import { acceptDialogs, signInDemo, sql } from './helpers';

/**
 * A feature walk, not a page-load check: every screen, and the main action on each, as the people who use it.
 * Fails on any server error or browser console error.
 */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(404|tiles)/i.test(m.text())) problems.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe('at the desk', () => {
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test('owner walks every office screen and uses each one', async ({ page }) => {
  acceptDialogs(page);
  const problems = watch(page);
  await signInDemo(page);

  // Today: crews and alerts.
  await expect(page.getByText('Crews today')).toBeVisible();
  await expect(page.getByText(/Job 1001/).first()).toBeVisible();

  // Customers: search, open, consent, add a property.
  await page.goto('/customers?q=Holloway');
  await page.getByRole('link', { name: /Pat Holloway/ }).click();
  await expect(page.getByText('Reach them')).toBeVisible();
  await page.getByRole('button', { name: 'Add property' }).click();
  await page.locator('#na').fill('5 Walk Test Way');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL('**/properties/**');
  await expect(page.getByText('5 Walk Test Way').first()).toBeVisible();
  await page.getByRole('button', { name: 'Start this year’s program' }).click();

  // Jobs list and filters.
  await page.goto('/jobs?status=scheduled');
  await expect(page.getByRole('link', { name: '1002' })).toBeVisible();

  // Schedule board: drag job 1006 to another day, and an unscheduled job onto a crew.
  await page.goto('/schedule');
  await page.getByRole('button', { name: 'Check weather' }).click();
  const chip = page.getByTestId('chip-1006');
  await expect(chip).toBeVisible();
  const cells = page.locator('[data-testid^="cell-Crew A (climb)-"]');
  await chip.dragTo(cells.nth(5));
  await expect(page.locator('[data-testid^="cell-Crew A (climb)-"]').nth(5).getByTestId('chip-1006')).toBeVisible();
  const unscheduled = page.getByTestId('unscheduled-1007');
  if (await unscheduled.count()) {
    await unscheduled.dragTo(page.locator('[data-testid^="cell-Crew C (grind/PHC)-"]').nth(6));
    await expect(page.locator('[data-testid^="cell-Crew C (grind/PHC)-"]').nth(6).getByTestId('chip-1007')).toBeVisible();
  }

  // A job page: weather, move for weather (texts the customer), crew link.
  await page.getByTestId('chip-1006').getByRole('link').click();
  await page.waitForURL('**/jobs/**');
  await page.getByRole('button', { name: 'Check weather' }).first().click();
  await page.getByRole('button', { name: 'Move' }).first().click();
  await page.getByTestId('move-weather').click();
  await expect(page.getByTestId('job-day')).toHaveCount(1);

  // Invoices: the paid one opens.
  await page.goto('/invoices');
  await page.getByRole('link', { name: /^\d{4}$/ }).first().click();
  await expect(page.getByTestId('invoice-total')).toBeVisible();

  // Plant health care: record a treatment (Ohio needs concentration), then send the copy.
  await page.goto('/phc');
  await page.locator('#sd').fill('Back yard ash (walk)');
  await page.locator('#ta').fill('3');
  await expect(page.getByTestId('phc-missing')).toContainText('Concentration');
  await page.locator('#cc').fill('1 fl oz per gal');
  await page.getByTestId('save-phc').click();
  await expect(page.getByText('Back yard ash (walk)')).toBeVisible();
  await page.getByRole('button', { name: 'Send copy' }).first().click();
  await expect(page.getByTestId('share-url').first()).toBeVisible();
  const copyUrl = (await page.getByTestId('share-url').first().textContent())!;
  await page.goto(copyUrl);
  await expect(page.getByText('EPA registration number')).toBeVisible();

  // Storm: the queue is ordered by danger; take a call; turn one into an estimate.
  await page.goto('/storm');
  const queue = page.getByTestId('storm-queue').locator('li');
  await expect(queue.first()).toContainText('Injury');
  await page.locator('#ia').fill('9 Fallen Oak Ct');
  await page.getByText('On a house or car').click();
  await page.getByTestId('save-call').click();
  await expect(page.getByText('9 Fallen Oak Ct')).toBeVisible();
  await page.getByRole('button', { name: 'Start an estimate' }).first().click();
  await page.waitForURL('**/estimates/**');
  await expect(page.getByTestId('add-tree')).toBeVisible();

  // Claims: the adjuster's link opens the read-only record.
  await page.goto('/claims');
  await page.getByRole('button', { name: 'Link for the adjuster' }).first().click();
  const viewer = (await page.getByTestId('share-url').first().textContent())!;
  await page.goto(viewer);
  await expect(page.getByText('Job record')).toBeVisible();

  // Reports, audit, settings tabs, an export.
  await page.goto('/reports');
  await expect(page.getByText('Finished jobs')).toBeVisible();
  await page.goto('/audit');
  await expect(page.getByText('Audit log')).toBeVisible();
  for (const tab of ['company', 'crew', 'equipment', 'safety', 'products', 'certificates', 'rules', 'branches', 'logins', 'export', 'system']) {
    await page.goto(`/settings?tab=${tab}`);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }
  await page.goto('/settings?tab=equipment');
  await page.getByTestId('add-equipment').click();
  await page.locator('#equipment-name').fill('Walk chipper');
  await page.getByTestId('save-equipment').click();
  await expect(page.getByText('Walk chipper')).toBeVisible();
  await page.goto('/settings?tab=crew');
  await page.getByTestId('add-workers').click();
  await page.locator('#workers-full_name').fill('Walk Worker');
  await page.locator('#workers-electrical_level').selectOption('2');
  await page.getByTestId('save-workers').click();
  await expect(page.getByText('Walk Worker')).toBeVisible();
  await page.goto('/settings?tab=company');
  await page.locator('#wl').fill('22');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  const csv = await page.request.get('/api/export/customers.csv');
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Pat Holloway');

  expect(problems).toEqual([]);
});
});

test('sales arborist and office see what they should', async ({ page }) => {
  const problems = watch(page);
  await signInDemo(page, 'sales');
  await page.goto('/audit');
  await page.waitForURL('**/dashboard');
  const res = await page.request.get('/api/export/customers.csv');
  expect(res.status()).toBe(403);
  await page.goto('/customers');
  await expect(page.getByTestId('new-customer')).toBeVisible();
  expect(problems).toEqual([]);
});

test('a new company signs up and finishes setup', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'New company? Start here' }).click();
  await page.locator('#email').fill(`walk-${Date.now()}@tree.test`);
  await page.locator('#password').fill('walk-password-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await page.locator('#company').fill('Walk Tree Service');
  await page.locator('#leader').fill('Lee Leader');
  await page.locator('#hn').fill('Walk Hospital');
  await page.locator('#ha').fill('1 Health St, Kent, OH');
  await page.getByLabel('Customers CSV').fill('name,phone,address,city,state\nJo Walk,(330) 555-0999,9 Elm,Kent,OH\nbad row');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.waitForURL('**/settings**');
  await page.goto('/customers');
  await expect(page.getByText('Jo Walk')).toBeVisible();
  expect(problems).toEqual([]);
});

test('public pages and the free briefing form', async ({ page }) => {
  const problems = watch(page);
  for (const p of ['/', '/pricing', '/tools/tree-job-briefing-form', '/legal/terms', '/legal/privacy', '/legal/sms-terms']) {
    const r = await page.goto(p);
    expect(r!.status(), p).toBe(200);
  }
  for (const lang of ['en', 'es']) {
    const pdf = await page.request.get(`/api/tools/briefing-form?lang=${lang}`);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
  const db = sql();
  await db.end();
  expect(problems).toEqual([]);
});
