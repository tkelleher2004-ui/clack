import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.SOCIAL_TOKENS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SOCIAL_TOKENS_ENCRYPTION_KEY must be set and at least 32 characters for token encryption"
    );
  }
  return scryptSync(secret, "clack-social", KEY_LENGTH);
}

export interface TokenPayload {
  access_token: string;
  refresh_token?: string;
  token_expires_at?: number;
}

export function encryptTokens(payload: TokenPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptTokens(encrypted: string): TokenPayload {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encryptedData = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as TokenPayload;
}
