import { expect, test } from '@playwright/test';
import { acceptDialogs, signInDemo, sql } from './helpers';

const jobPath = async (number: number) => {
  const db = sql();
  const [j] = await db`select j.id from jobs j join tenants t on t.id = j.tenant_id where t.slug = 'maple-ridge-demo' and j.number = ${number}`;
  await db.end();
  return `/jobs/${j!.id}`;
};

/** docs/SPEC.md screen 3 ACs: open checks lock scheduling until an override with a reason; equipment can't double-book. */
test('a job with open checks is gated until overridden, and the override is audited', async ({ page }) => {
  acceptDialogs(page);
  await signInDemo(page);
  await page.goto(await jobPath(1003));
  await page.getByTestId('schedule-day').click();
  await page.getByTestId('save-day').click();
  await expect(page.getByTestId('error').first()).toContainText('Finish or override the pre-work checks first');

  for (const kind of ['811', 'hoa']) {
    await page.getByTestId(`edit-check-${kind}`).click();
    await page.getByRole('textbox', { name: /Override/ }).fill('Confirmed by phone with the utility and the HOA board (e2e).');
    await page.getByTestId('override-check').click();
    await expect(page.getByTestId(`check-${kind}`)).toContainText('Overridden');
  }
  // The form stayed open after the refusal; submit it again.
  await page.getByTestId('save-day').click();
  await expect(page.getByTestId('job-day')).toHaveCount(1);

  const db = sql();
  const rows = await db`select a.after ->> 'status' as status, a.after ->> 'override_reason' as reason from audit_log a join prework_checks pc on pc.id = a.target_id join jobs j on j.id = pc.job_id
    join tenants t on t.id = j.tenant_id where t.slug = 'maple-ridge-demo' and j.number = 1003 and a.action = 'update' and a.actor_id is not null`;
  await db.end();
  expect(rows.filter((r) => r.status === 'overridden')).toHaveLength(2);
});

test('the crane can’t be booked twice on the same day', async ({ page }) => {
  acceptDialogs(page);
  await signInDemo(page);
  await page.goto(await jobPath(1004));
  await page.getByTestId('schedule-day').click();
  await page.locator('#sd').fill(new Date().toISOString().slice(0, 10));
  await page.locator('#sc').selectOption({ label: 'Crew B (bucket)' });
  // The crane is pre-ticked for a crane job; job 1001 already has it today.
  await page.getByTestId('save-day').click();
  await expect(page.getByTestId('error').first()).toContainText('Crane 1 (40 t) is booked on job 1001');
  await expect(page.getByTestId('job-day')).toHaveCount(0);
});

test('a sales arborist can’t override a check', async ({ page }) => {
  await signInDemo(page, 'sales');
  await page.goto(await jobPath(1003));
  await page.getByTestId('edit-check-811').click();
  await expect(page.getByTestId('override-check')).toHaveCount(0);
});
