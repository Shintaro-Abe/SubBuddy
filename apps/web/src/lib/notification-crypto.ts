import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export type NotificationCryptoKeys = {
  encryptionKeys: Map<number, Uint8Array>;
  activeKeyVersion: number;
  fingerprintKey: Uint8Array;
};

export function encryptNotificationValue(value: string, keys: NotificationCryptoKeys) {
  const key = keys.encryptionKeys.get(keys.activeKeyVersion);
  if (!key) throw new Error("active notification encryption key is unavailable");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: [
      `v${keys.activeKeyVersion}`,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join("."),
    keyVersion: keys.activeKeyVersion,
  };
}

export function decryptNotificationValue(ciphertext: string, keys: NotificationCryptoKeys): string {
  const [rawVersion, rawIv, rawTag, rawCiphertext, ...extra] = ciphertext.split(".");
  if (!rawVersion?.startsWith("v") || !rawIv || !rawTag || !rawCiphertext || extra.length > 0) {
    throw new Error("invalid notification ciphertext");
  }
  const version = Number(rawVersion.slice(1));
  const key = keys.encryptionKeys.get(version);
  if (!key) throw new Error("notification encryption key version is unavailable");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(rawIv, "base64url"));
  decipher.setAuthTag(Buffer.from(rawTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(rawCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function notificationFingerprint(value: string, key: Uint8Array): string {
  return createHmac("sha256", key).update(value).digest("hex");
}
