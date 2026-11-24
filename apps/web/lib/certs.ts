/** Insurance certificates (copied from Flake's compliance rule): warn 30 days before the end date; never block. */
export const EXPIRING_DAYS = 30;
export type CertState = 'ok' | 'expiring' | 'expired';

export function certState(expiresOn: string, today: string): CertState {
  const days = Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days < 0 ? 'expired' : days <= EXPIRING_DAYS ? 'expiring' : 'ok';
}
