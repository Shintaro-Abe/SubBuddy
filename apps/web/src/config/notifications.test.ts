import { describe, expect, it } from "vitest";
import { NotificationConfigError, parseNotificationConfig } from "./notifications";

describe("parseNotificationConfig", () => {
  const privateKeyLabel = ["PRIVATE", "KEY"].join(" ");
  const validEnvironment = {
    SUBBUDDY_MODE: "cloud-testflight",
    NOTIFICATIONS_ENABLED: "true",
    NOTIFICATION_ENCRYPTION_KEYS: "1:MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA",
    NOTIFICATION_ACTIVE_KEY_VERSION: "1",
    NOTIFICATION_FINGERPRINT_KEY_BASE64URL: "MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE",
    APNS_KEY_ID: "SYNTHETIC1",
    APNS_TEAM_ID: "SYNTHETIC2",
    APNS_PRIVATE_KEY: `-----BEGIN ${privateKeyLabel}-----\\nsynthetic\\n-----END ${privateKeyLabel}-----`,
    APNS_TOPIC: "com.subbuddy.app",
    APNS_ENVIRONMENT: "sandbox",
  };

  it("初期状態は無効", () => {
    expect(parseNotificationConfig({ SUBBUDDY_MODE: "cloud-testflight" })).toEqual({
      enabled: false,
    });
  });

  it("local modeでの有効化を拒否", () => {
    expect(() =>
      parseNotificationConfig({ SUBBUDDY_MODE: "local", NOTIFICATIONS_ENABLED: "true" }),
    ).toThrow(NotificationConfigError);
  });

  it("必要な秘密値と環境境界がそろった場合だけ有効化する", () => {
    const config = parseNotificationConfig(validEnvironment);
    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(config.apns.environment).toBe("sandbox");
    }
  });

  it("APNs環境がない設定を拒否する", () => {
    const missingEnvironment: Record<string, string | undefined> = { ...validEnvironment };
    delete missingEnvironment.APNS_ENVIRONMENT;
    expect(() => parseNotificationConfig(missingEnvironment)).toThrow(NotificationConfigError);
  });
});
