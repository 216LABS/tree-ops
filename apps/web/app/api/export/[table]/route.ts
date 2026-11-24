import type { P } from '@/lib/api';
import { asUser, requireApi } from '@/lib/auth';
import { fail, route } from '@/lib/http';

const EXPORTABLE = new Set([
  'customers', 'properties', 'trees', 'estimates', 'estimate_options', 'estimate_lines', 'jobs', 'prework_checks', 'job_days', 'equipment_bookings', 'briefings', 'briefing_signoffs',
  'work_log', 'tree_confirmations', 'change_orders', 'corrections', 'disposal_tickets', 'invoices', 'invoice_lines', 'payments', 'deposits', 'photos', 'signatures', 'workers', 'crews',
  'crew_members', 'equipment', 'products', 'phc_programs', 'phc_applications', 'storm_events', 'storm_intake', 'claims', 'certificates', 'messages', 'consents', 'audit_log', 'branches',
]);

const cell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Quote, and defuse spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of one table for this company (owner and enterprise admin). Token hashes are left out. */
export const GET = route<P<'table'>>(async (_req, { params }) => {
  const ctx = await requireApi(['owner', 'enterprise_admin']);
  const table = (await params).table.replace(/\.csv$/, '');
  if (!EXPORTABLE.has(table)) fail('not_found', 'That table can’t be exported.');
  const rows = await asUser(ctx, (tx) => tx.unsafe(`select * from ${table} where tenant_id = $1 order by created_at`, [ctx.tenantId]));
  const cols = rows.columns.map((c) => c.name).filter((c) => !/token_(hash|enc)$/.test(c));
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c])).join(','))].join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${table}.csv"` } });
});
