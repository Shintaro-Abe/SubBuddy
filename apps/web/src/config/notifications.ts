import { z } from "zod";

const DAY_SECONDS = 24 * 60 * 60;
type Environment = Record<string, string | undefined>;

export type NotificationConfig =
  | { enabled: false }
  | {
      enabled: true;
      encryptionKeys: Map<number, Uint8Array>;
      activeKeyVersion: number;
      fingerprintKey: Uint8Array;
      apns: {
        keyId: string;
        teamId: string;
        privateKey: string;
        topic: string;
        environment: "sandbox" | "production";
      };
    };

export const notificationPolicy = {
  yearlyReminderDays: 7,
  monthlyReminderDays: 1,
  renewalHour: 10,
  quietStartHour: 20,
  quietEndHour: 9,
  syncFailureDelaySeconds: DAY_SECONDS,
  noticeRetentionDays: 90,
  deliveryRetentionDays: 30,
  maxPendingLocalNotifications: 60,
  deliveryBatchSize: 50,
  deliveryLeaseSeconds: 5 * 60,
  maxDeliveryAttempts: 6,
} as const;

const enabledSchema = z.object({
  NOTIFICATIONS_ENABLED: z.literal("true"),
  NOTIFICATION_ENCRYPTION_KEYS: z.string().min(1),
  NOTIFICATION_ACTIVE_KEY_VERSION: z.coerce.number().int().positive(),
  NOTIFICATION_FINGERPRINT_KEY_BASE64URL: z.string().min(43),
  APNS_KEY_ID: z.string().min(1),
  APNS_TEAM_ID: z.string().min(1),
  APNS_PRIVATE_KEY: z.string().includes("PRIVATE KEY"),
  APNS_TOPIC: z.string().min(1),
  APNS_ENVIRONMENT: z.enum(["sandbox", "production"]),
});

export class NotificationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationConfigError";
  }
}

function decodeKey(value: string, label: string): Uint8Array {
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.length !== 32 || decoded.toString("base64url") !== value) throw new Error();
    return decoded;
  } catch {
    throw new NotificationConfigError(`${label} must be a 256-bit base64url value`);
  }
}

function parseEncryptionKeys(value: string): Map<number, Uint8Array> {
  const keys = new Map<number, Uint8Array>();
  for (const entry of value.split(",")) {
    const [rawVersion, rawKey, ...extra] = entry.split(":");
    const version = Number(rawVersion);
    if (!Number.isInteger(version) || version < 1 || !rawKey || extra.length > 0) {
      throw new NotificationConfigError(
        "NOTIFICATION_ENCRYPTION_KEYS must use version:base64url entries",
      );
    }
    if (keys.has(version)) {
      throw new NotificationConfigError("notification encryption key versions must be unique");
    }
    keys.set(version, decodeKey(rawKey, `notification encryption key version ${version}`));
  }
  if (keys.size === 0) throw new NotificationConfigError("notification encryption key is required");
  return keys;
}

export function parseNotificationConfig(env: Environment = process.env): NotificationConfig {
  if (env.NOTIFICATIONS_ENABLED !== "true") return { enabled: false };
  if (env.SUBBUDDY_MODE === "local") {
    throw new NotificationConfigError("notifications cannot be enabled in local mode");
  }
  const parsed = enabledSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new NotificationConfigError(`invalid notification configuration: ${fields.join(", ")}`);
  }
  const values = parsed.data;
  const encryptionKeys = parseEncryptionKeys(values.NOTIFICATION_ENCRYPTION_KEYS);
  if (!encryptionKeys.has(values.NOTIFICATION_ACTIVE_KEY_VERSION)) {
    throw new NotificationConfigError(
      "NOTIFICATION_ACTIVE_KEY_VERSION must exist in NOTIFICATION_ENCRYPTION_KEYS",
    );
  }
  return {
    enabled: true,
    encryptionKeys,
    activeKeyVersion: values.NOTIFICATION_ACTIVE_KEY_VERSION,
    fingerprintKey: decodeKey(
      values.NOTIFICATION_FINGERPRINT_KEY_BASE64URL,
      "NOTIFICATION_FINGERPRINT_KEY_BASE64URL",
    ),
    apns: {
      keyId: values.APNS_KEY_ID,
      teamId: values.APNS_TEAM_ID,
      privateKey: values.APNS_PRIVATE_KEY.replaceAll("\\n", "\n"),
      topic: values.APNS_TOPIC,
      environment: values.APNS_ENVIRONMENT,
    },
  };
}
