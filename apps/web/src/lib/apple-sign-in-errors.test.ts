import { describe, expect, it } from "vitest";
import { appleSignInErrorMessage } from "@/lib/apple-sign-in-errors";

describe("appleSignInErrorMessage", () => {
  it("Webセッション上限では解除方法を案内する", () => {
    expect(appleSignInErrorMessage(409)).toContain("端末とセッション");
    expect(appleSignInErrorMessage(409)).toContain("10件");
  });

  it("その他の失敗では内部理由を出さず汎用案内にする", () => {
    expect(appleSignInErrorMessage(500)).toBe(
      "Appleでサインインできませんでした。時間をおいて再度お試しください。",
    );
  });
});
