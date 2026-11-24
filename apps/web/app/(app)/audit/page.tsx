import { db } from '@treeops/db';
import { PageHeader, Table, Td, Th } from '@treeops/ui';
import { asUser, requirePage } from '@/lib/auth';
import { fmtTime } from '@/lib/format';

export const metadata = { title: 'Audit log' };

/** Every change to the records people edit by hand: who, when, what before and after (owner and enterprise admin). */
export default async function Audit({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const ctx = await requirePage(['owner', 'enterprise_admin']);
  const table = (await searchParams).table;
  const rows = await asUser(ctx, (tx) => tx`select * from audit_log where ${table ? tx`target_table = ${table}` : tx`true`} order by created_at desc limit 300`);
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const who = new Map((ids.length ? await db()`select u.id, u.email from auth.users u join memberships m on m.user_id = u.id and m.tenant_id = ${ctx.tenantId} where u.id = any(${ids})` : []).map((r) => [r.id as string, r.email as string]));
  const changed = (b: Record<string, unknown> | null, a: Record<string, unknown> | null) => {
    if (!b || !a) return '';
    return Object.keys(a).filter((k) => !['updated_at', 'created_at'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}`).join('; ');
  };
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Newest first. Export the full log from Settings, Export." />
      <Table stack>
        <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th><Th>Change</Th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><Td label="When">{fmtTime(r.created_at, ctx.tenant.timezone)}</Td><Td label="Who">{r.actor_id ? (who.get(r.actor_id) ?? 'Someone') : 'System or link'}</Td><Td label="What">{r.action} {r.target_table}</Td><Td label="Change" className="max-w-xl break-words text-xs">{r.action === 'update' ? changed(r.before, r.after) : ''}</Td></tr>)}</tbody>
      </Table>
    </div>
  );
}
