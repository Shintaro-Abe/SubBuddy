import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

describe("cloud distribution authentication boundary", () => {
  it("固定ユーザー参照はlocal境界ファイルだけに存在する", () => {
    const root = join(process.cwd(), "src");
    const files = collectRouteFiles(join(root, "app", "api"));

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const label = relative(root, file);
      expect(source, label).not.toContain("getCurrentUserId");
      expect(source, label).not.toContain('"user_local"');
    }
  });
});
