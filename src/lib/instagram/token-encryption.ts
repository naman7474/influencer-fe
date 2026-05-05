import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_INFO_PREFIX = "ig-token-v1:";
const SALT = Buffer.from("ig-token-salt-v1");

function deriveKey(): Buffer {
  const secret = process.env.IG_TOKEN_ENC_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "IG_TOKEN_ENC_KEY env var must be set to a strong secret (32+ chars recommended)"
    );
  }
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a string with AES-256-GCM. Output format:
 *   "ig-token-v1:<base64(iv|tag|ciphertext)>"
 */
export function encryptToken(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return KEY_INFO_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(stored: string): string {
  if (!stored.startsWith(KEY_INFO_PREFIX)) {
    // Backwards compat: tokens written before encryption was introduced
    // (e.g. early rows from migration 019) are returned as-is.
    return stored;
  }
  const buf = Buffer.from(stored.slice(KEY_INFO_PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(KEY_INFO_PREFIX);
}
