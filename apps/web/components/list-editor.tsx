'use client';

import { Button, Input, Label, Select } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorNote } from './actions';
import { api, ApiError } from './client-api';

export interface Field { key: string; label: string; type?: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'tel'; options?: [string, string][]; required?: boolean; wide?: boolean; hint?: string; numeric?: boolean }

const toValue = (f: Field, v: string | boolean) => (f.type === 'checkbox' ? Boolean(v) : f.type === 'number' || f.numeric ? (v === '' ? null : Number(v)) : v === '' ? null : v);

/**
 * One editor for the simple settings lists (crews, workers, equipment, hospitals, products, certificates, rules).
 * Rows read as text with Edit and Remove; Add opens a short form.
 */
export function ListEditor({ table, rows, fields, show, addLabel = 'Add', extra }: { table: string; rows: Record<string, unknown>[]; fields: Field[]; show: (r: Record<string, unknown>) => React.ReactNode; addLabel?: string; extra?: Record<string, unknown> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [vals, setVals] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const open = (row: Record<string, unknown> | null) => {
    setErr(null);
    setEditing(row ? (row.id as string) : 'new');
    setVals(Object.fromEntries(fields.map((f) => [f.key, row ? (f.type === 'checkbox' ? Boolean(row[f.key]) : row[f.key] == null ? '' : String(row[f.key])) : f.type === 'checkbox' ? false : (f.options?.[0]?.[0] ?? '')])));
  };
  const save = async () => {
    setErr(null);
    const body: Record<string, unknown> = { ...(extra ?? {}) };
    for (const f of fields) body[f.key] = toValue(f, vals[f.key] ?? '');
    try {
      if (editing === 'new') await api(`/api/settings/${table}`, { body });
      else await api(`/api/settings/${table}`, { method: 'PATCH', body: { ...body, id: editing } });
      setEditing(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
    }
  };
  const form = (
    <div className="mt-2 rounded-control border border-line bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className={f.wide ? 'sm:col-span-3' : ''}>
            {f.type === 'checkbox' ? (
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={Boolean(vals[f.key])} onChange={(e) => setVals({ ...vals, [f.key]: e.target.checked })} />{f.label}</label>
            ) : (
              <>
                <Label htmlFor={`${table}-${f.key}`}>{f.label}</Label>
                {f.type === 'select' ? (
                  <Select id={`${table}-${f.key}`} value={String(vals[f.key] ?? '')} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                ) : (
                  <Input id={`${table}-${f.key}`} type={f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} required={f.required} value={String(vals[f.key] ?? '')} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
                )}
                {f.hint ? <p className="mt-0.5 text-xs text-muted">{f.hint}</p> : null}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2"><Button size="sm" onClick={save} data-testid={`save-${table}`}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
  return (
    <div>
      <ul className="divide-y divide-line-faint rounded-surface border border-line-faint bg-surface">
        {rows.map((r) => (
          <li key={r.id as string} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">{show(r)}</div>
              <Button size="sm" variant="ghost" onClick={() => open(r)}>Edit</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm('Remove this?')) return;
                  try {
                    await api(`/api/settings/${table}?id=${r.id}`, { method: 'DELETE' });
                    router.refresh();
                  } catch (e) {
                    setErr(e instanceof ApiError ? e.message : 'Didn’t remove.');
                  }
                }}
              >
                Remove
              </Button>
            </div>
            {editing === r.id ? form : null}
          </li>
        ))}
        {!rows.length ? <li className="p-3 text-sm text-muted">None yet.</li> : null}
      </ul>
      {editing === 'new' ? form : <Button size="sm" variant="outline" className="mt-2" onClick={() => open(null)} data-testid={`add-${table}`}>{addLabel}</Button>}
      {editing === null ? <ErrorNote>{err}</ErrorNote> : null}
    </div>
  );
}
