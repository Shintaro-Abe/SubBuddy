import { describe, expect, it } from "vitest";
import {
  decryptNotificationValue,
  encryptNotificationValue,
  notificationFingerprint,
} from "./notification-crypto";

const keys = {
  encryptionKeys: new Map([[1, new Uint8Array(32).fill(7)]]),
  activeKeyVersion: 1,
  fingerprintKey: new Uint8Array(32).fill(9),
};

describe("notification crypto", () => {
  it("暗号化した値を復号でき、平文を含まない", () => {
    const address = ["synthetic", "example.invalid"].join("@");
    const encrypted = encryptNotificationValue(address, keys);
    expect(encrypted.ciphertext).not.toContain("synthetic");
    expect(decryptNotificationValue(encrypted.ciphertext, keys)).toBe(address);
  });

  it("fingerprintは安定し、入力を露出しない", () => {
    const first = notificationFingerprint("synthetic-token", keys.fingerprintKey);
    expect(first).toBe(notificationFingerprint("synthetic-token", keys.fingerprintKey));
    expect(first).not.toContain("synthetic-token");
  });
});
