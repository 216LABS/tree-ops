import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { required } from './env';

/** Link tokens (copied from Flake): 32 random bytes, stored only as an HMAC-SHA256 hash. */
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHmac('sha256', required('LINK_TOKEN_SECRET')).update(token).digest('hex');

/**
 * A token derived from a record's id, for links on append-only records (PHC copies, claim viewers): the same link can be
 * shown again later without storing it, and only its hash is in the database.
 */
export const derivedToken = (kind: string, id: string) => createHmac('sha256', required('LINK_TOKEN_SECRET')).update(`derived:${kind}:${id}`).digest('base64url');

const key = () => createHash('sha256').update(`enc:${required('LINK_TOKEN_SECRET')}`).digest();

/** Lets the office show a crew link again (QR, copy) without keeping the token in the clear. */
export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function decryptToken(enc: string): string {
  const raw = Buffer.from(enc, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export const sha256Hex = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
