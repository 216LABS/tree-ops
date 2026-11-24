import { expect, test } from '@playwright/test';
import { photo, sql } from './helpers';

/**
 * docs/SPEC.md screen 4 and section 16: the crew works the whole job with no signal, reloads the page, and when signal
 * returns every record reaches the server exactly once.
 */
test('offline: briefing, three trees and six photos sync exactly once', async ({ page, context, request }) => {
  const db = sql();
  // A fresh day for an approved job no one has worked yet, so each browser run starts clean.
  const [job] = await db`select j.id, j.tenant_id from jobs j join tenants t on t.id = j.tenant_id where t.slug = 'maple-ridge-demo' and j.status = 'unscheduled' and not j.needs_crane
    and not exists (select 1 from job_days jd where jd.job_id = j.id) and not exists (select 1 from prework_checks pc where pc.job_id = j.id and pc.status in ('needed','requested')) order by j.number limit 1`;
  const [crew] = await db`select c.id from crews c join workers w on w.id = c.leader_worker_id where c.tenant_id = ${job!.tenant_id} and w.full_name like 'Dana%'`;
  const [jd] = await db`insert into job_days (tenant_id, job_id, crew_id, day) values (${job!.tenant_id}, ${job!.id}, ${crew!.id}, current_date) returning id`;
  const { url } = await (await request.post('/api/dev/links', { data: { kind: 'crew', id: jd!.id } })).json();

  await page.goto(url);
  await expect(page.getByTestId('crew-app')).toBeVisible();
  // Let the service worker take over, then load once more through it so the page and its scripts are cached.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId('crew-app')).toBeVisible();

  await context.setOffline(true);
  await page.getByTestId('go-next').click();
  for (const h of ['drop_zone', 'traffic', 'structures', 'weather', 'lines', 'rescue']) await page.getByTestId(`hazard-${h}`).click();
  await page.getByTestId('finish-briefing').click();
  await page.getByTestId('sign-Dana Brooks (DEMO)').click();
  await page.getByTestId('to-trees').click();
  const lines = page.locator('[data-testid^="tree-line-"]');
  await expect(lines).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const line = lines.nth(i);
    if (!(await line.getByText('Confirm this is the tree').isVisible())) await line.locator('button').first().click();
    await line.locator('[data-testid^="before-photo-"]').setInputFiles(photo(20 + i * 2));
    await line.locator('[data-testid^="after-photo-"]').setInputFiles(photo(21 + i * 2));
    await line.locator('[data-testid^="done-"]').click();
  }
  await expect(page.getByText('All trees done.')).toBeVisible();
  await expect(page.getByTestId('crew-sync')).toContainText('No signal');

  // Nothing reached the server yet.
  const before = await db`select (select count(*)::int from tree_confirmations where job_day_id = ${jd!.id}) as c, (select count(*)::int from photos where job_day_id = ${jd!.id}) as p`;
  expect(before[0]).toEqual({ c: 0, p: 0 });

  // Reload with no signal: the page comes from the phone, and so does the work.
  await page.reload();
  await expect(page.getByTestId('crew-app')).toBeVisible();
  await page.getByTestId('tab-trees').click();
  await expect(page.getByText('All trees done.')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('crew-sync')).toHaveText('Synced', { timeout: 90_000 });

  const after = await db`select
    (select count(*)::int from tree_confirmations where job_day_id = ${jd!.id}) as confirmations,
    (select count(*)::int from photos where job_day_id = ${jd!.id}) as photos,
    (select count(*)::int from briefings where job_day_id = ${jd!.id}) as briefings,
    (select count(*)::int from briefing_signoffs so join briefings b on b.id = so.briefing_id where b.job_day_id = ${jd!.id}) as signoffs`;
  expect(after[0]).toEqual({ confirmations: 3, photos: 6, briefings: 1, signoffs: 1 });

  // Another flush (a reload sends again) changes nothing.
  await page.reload();
  await expect(page.getByTestId('crew-sync')).toHaveText('Synced');
  const again = await db`select (select count(*)::int from tree_confirmations where job_day_id = ${jd!.id}) as c, (select count(*)::int from photos where job_day_id = ${jd!.id}) as p`;
  expect(again[0]).toEqual({ c: 3, p: 6 });
  await db.end();
});
