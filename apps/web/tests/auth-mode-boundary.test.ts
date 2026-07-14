import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("cloud distribution authentication boundary", () => {
  it("固定ユーザー参照はlocal境界ファイルだけに存在する", () => {
    const root = join(process.cwd(), "src");
    const files = [
      "app/api/subscriptions/route.ts",
      "app/api/subscriptions/[id]/route.ts",
      "app/api/recommendations/route.ts",
      "app/api/recommendations/recompute/route.ts",
      "app/api/renewals/upcoming/route.ts",
      "app/api/spending/summary/route.ts",
      "app/api/summary/route.ts",
      "app/api/account/route.ts",
      "app/api/devices/route.ts",
      "app/api/devices/[id]/route.ts",
      "app/api/usage/daily/route.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toContain("getCurrentUserId");
      expect(source, file).not.toContain('"user_local"');
    }
  });
});
