import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  responseStatus: 200,
  responseBody: "",
  responseHeaders: {} as Record<string, string>,
  transportError: false,
  close: vi.fn(),
  requestHeaders: [] as unknown[],
  requestBodies: [] as string[],
}));
const syntheticAccountId = String(0).padStart(12, "0");

vi.mock("jose", () => ({
  importPKCS8: vi.fn(async () => "synthetic-key"),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    async sign() {
      return "synthetic-provider-token";
    }
  },
}));

vi.mock("node:http2", () => ({
  connect: () => ({
    request: (headers: unknown) => {
      mocks.requestHeaders.push(headers);
      const request = new EventEmitter() as EventEmitter & {
        setEncoding: () => void;
        setTimeout: (_timeout: number, _callback: () => void) => void;
        destroy: (error: Error) => void;
        end: (body: string) => void;
      };
      request.setEncoding = () => undefined;
      request.setTimeout = () => undefined;
      request.destroy = (error) => request.emit("error", error);
      request.end = (body) => {
        mocks.requestBodies.push(body);
        queueMicrotask(() => {
          if (mocks.transportError) {
            request.emit("error", new Error("synthetic transport error"));
            return;
          }
          request.emit("response", {
            ":status": mocks.responseStatus,
            ...mocks.responseHeaders,
          });
          if (mocks.responseBody) request.emit("data", mocks.responseBody);
          request.emit("end");
        });
      };
      return request;
    },
    close: mocks.close,
  }),
}));

import { sendApnsNotification } from "./apns";

const config = {
  enabled: true as const,
  encryptionKeys: new Map(),
  activeKeyVersion: 1,
  fingerprintKey: new Uint8Array(32),
  apns: {
    keyId: "synthetic-key-id",
    teamId: "synthetic-team-id",
    privateKey: "synthetic-private-key",
    topic: "com.example.synthetic",
    environment: "sandbox" as const,
  },
  ses: {
    region: "ap-southeast-1",
    fromAddress: ["sender", "example.invalid"].join("@"),
    feedbackTopicArn: `arn:aws:sns:ap-southeast-1:${syntheticAccountId}:synthetic`,
  },
};

function send() {
  return sendApnsNotification({
    config,
    deviceToken: "synthetic-device-token",
    title: "合成通知",
    body: "合成データによる通知です。",
    eventId: "synthetic-event",
    route: "notices",
  });
}

describe("APNs送信アダプタ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.responseStatus = 200;
    mocks.responseBody = "";
    mocks.responseHeaders = {};
    mocks.transportError = false;
    mocks.requestHeaders.length = 0;
    mocks.requestBodies.length = 0;
  });

  it("成功時はAPNs IDを返し、本文へ安全な表示情報だけを入れる", async () => {
    mocks.responseHeaders = { "apns-id": "synthetic-apns-id" };

    await expect(send()).resolves.toEqual({
      status: "sent",
      providerMessageId: "synthetic-apns-id",
    });
    expect(JSON.parse(mocks.requestBodies[0])).toEqual({
      aps: {
        alert: { title: "合成通知", body: "合成データによる通知です。" },
        sound: "default",
      },
      route: "notices",
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it.each([
    [410, "Unregistered"],
    [400, "BadDeviceToken"],
    [400, "DeviceTokenNotForTopic"],
  ])("HTTP %s / %sは無効トークンとして停止対象にする", async (status, reason) => {
    mocks.responseStatus = status;
    mocks.responseBody = JSON.stringify({ reason });

    await expect(send()).resolves.toEqual({
      status: "permanent",
      errorClass: "invalid_device_token",
    });
  });

  it("混雑応答はRetry-Afterを保って再試行する", async () => {
    mocks.responseStatus = 429;
    mocks.responseHeaders = { "retry-after": "120" };

    await expect(send()).resolves.toEqual({
      status: "retry",
      errorClass: "apns_temporary",
      retryAfterSeconds: 120,
    });
  });

  it("通信例外は資格情報を露出せず再試行へ分類する", async () => {
    mocks.transportError = true;
    await expect(send()).resolves.toEqual({
      status: "retry",
      errorClass: "apns_transport",
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
