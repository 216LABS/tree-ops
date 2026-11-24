'use client';

import { Button } from '@treeops/ui';
import { api } from '@/components/client-api';

export function DevLink({ kind, id, label }: { kind: 'crew' | 'estimate' | 'invoice'; id: string; label: string }) {
  return <Button size="sm" variant="outline" data-testid={`dev-${kind}-${id}`} onClick={async () => window.location.assign((await api<{ url: string }>('/api/dev/links', { body: { kind, id } })).url)}>{label}</Button>;
}
