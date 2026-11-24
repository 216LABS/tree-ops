'use client';

import { Button } from '@treeops/ui';
import { api } from '@/components/client-api';

export function MockOnboard({ account, back }: { account: string; back: string }) {
  return <Button variant="accent" size="lg" className="mt-6 w-full" onClick={async () => { await api('/api/dev/stripe-onboard', { body: { account } }); window.location.assign(back); }}>Finish onboarding</Button>;
}
