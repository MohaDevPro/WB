import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type EncryptedZoomUrl = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

type EncryptedZoomRow = {
  zoom_url_ciphertext: string;
  zoom_url_iv: string;
  zoom_url_auth_tag: string;
};

function encryptionKey() {
  const configured = process.env.EVENT_URL_ENCRYPTION_KEY;
  if (isConfiguredKey(configured)) return Buffer.from(configured, 'hex');
  if (process.env.NODE_ENV === 'production') throw new Error('EVENT_URL_ENCRYPTION_KEY must be a 32-byte hex key in production');
  return createHash('sha256').update(configured ?? 'wb-local-development-event-key').digest();
}

function isConfiguredKey(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{64}$/.test(value));
}

export function encryptZoomUrl(value: string): EncryptedZoomUrl {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptZoomUrl(row: EncryptedZoomRow) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.zoom_url_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.zoom_url_auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.zoom_url_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
