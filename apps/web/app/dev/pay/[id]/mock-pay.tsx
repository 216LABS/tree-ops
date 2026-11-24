'use client';

import { Button } from '@treeops/ui';
import { api } from '@/components/client-api';

export function MockPay({ sessionId, amount, meta, success }: { sessionId: string; amount: number; meta: Record<string, string>; success: string }) {
  return (
    <Button variant="accent" size="lg" className="mt-6 w-full" data-testid="mock-pay" onClick={async () => { await api('/api/dev/pay', { body: { sessionId, amount, meta } }); window.location.assign(success); }}>
      Pay with test card
    </Button>
  );
}
