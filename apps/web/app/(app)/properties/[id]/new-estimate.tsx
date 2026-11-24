'use client';

import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/actions';

export function NewEstimateButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  return (
    <ActionButton variant="accent" size="lg" path="/api/estimates" body={{ propertyId }} onDone={(o: { id: string }) => router.push(`/estimates/${o.id}`)} testId="new-estimate">
      New estimate
    </ActionButton>
  );
}
