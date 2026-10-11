import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

// ENCRYPTION_KEY must be a 32-byte hex string (64 chars) or 32 raw bytes
function getSecretKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (secret.length === 64) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptCredential(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Input format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function decryptCredential(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }
  
  const [ivHex, authTagHex, cipherTextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Fast SHA-256 hashing for API keys
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new random API key.
 * Format: mcp_live_<32 hex chars>
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomHex = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const rawKey = `mcp_live_${randomHex}`;
  const keyPrefix = `mcp_live_${randomHex.slice(0, 8)}`;
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}
