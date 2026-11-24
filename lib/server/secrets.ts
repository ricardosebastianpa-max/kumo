import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** AES-256-GCM with a key derived from BETTER_AUTH_SECRET. Stored as base64(iv|tag|ciphertext). */
const key = () => createHash("sha256").update(`kumo-secrets:${process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-dev-only-secret"}`).digest();
export function seal(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
export function open(sealed: string): string | null {
  try {
    const b = Buffer.from(sealed, "base64"), d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch { return null; }
}
