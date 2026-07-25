import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import type { NotificationConfig } from "@/config/notifications";

type EnabledConfig = Extract<NotificationConfig, { enabled: true }>;

export type DeliveryResult =
  | { status: "sent"; providerMessageId?: string }
  | { status: "retry"; errorClass: string; retryAfterSeconds?: number }
  | { status: "permanent"; errorClass: string };

let cachedToken: { value: string; expiresAt: number; identity: string } | null = null;

async function providerToken(config: EnabledConfig["apns"]): Promise<string> {
  const identity = `${config.teamId}:${config.keyId}:${config.privateKey.slice(-32)}`;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.identity === identity && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }
  const key = await importPKCS8(config.privateKey, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .sign(key);
  cachedToken = { value, expiresAt: now + 50 * 60, identity };
  return value;
}

export async function sendApnsNotification(input: {
  config: EnabledConfig;
  deviceToken: string;
  title: string;
  body: string;
  eventId: string;
  route: "sessions" | "notices";
}): Promise<DeliveryResult> {
  const authority =
    input.config.apns.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
  const token = await providerToken(input.config.apns);
  const client = connect(authority);
  try {
    return await new Promise<DeliveryResult>((resolve, reject) => {
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${input.deviceToken}`,
        authorization: `bearer ${token}`,
        "apns-topic": input.config.apns.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "apns-collapse-id": input.eventId,
        "content-type": "application/json",
      });
      let status = 0;
      let responseBody = "";
      let apnsId: string | undefined;
      let retryAfterSeconds: number | undefined;
      request.setEncoding("utf8");
      request.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
        apnsId = typeof headers["apns-id"] === "string" ? headers["apns-id"] : undefined;
        const retryAfter = headers["retry-after"];
        if (typeof retryAfter === "string" && /^\d+$/.test(retryAfter)) {
          retryAfterSeconds = Number(retryAfter);
        }
      });
      request.on("data", (chunk) => {
        responseBody += chunk;
      });
      request.setTimeout(10_000, () => {
        request.destroy(new Error("APNs request timed out"));
      });
      request.on("error", reject);
      request.on("end", () => {
        let reason = "apns_error";
        try {
          const parsed = JSON.parse(responseBody) as { reason?: unknown };
          if (typeof parsed.reason === "string") reason = parsed.reason;
        } catch {
          // APNsの本文をログへ出さず、定型分類だけを使う。
        }
        if (status === 200) return resolve({ status: "sent", providerMessageId: apnsId });
        if (status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") {
          return resolve({ status: "permanent", errorClass: "invalid_device_token" });
        }
        if (status === 429 || status >= 500 || status === 0) {
          return resolve({ status: "retry", errorClass: "apns_temporary", retryAfterSeconds });
        }
        return resolve({ status: "permanent", errorClass: "apns_rejected" });
      });
      request.end(
        JSON.stringify({
          aps: {
            alert: { title: input.title, body: input.body },
            sound: "default",
          },
          route: input.route,
        }),
      );
    });
  } catch {
    return { status: "retry", errorClass: "apns_transport" };
  } finally {
    client.close();
  }
}
