import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDir = fileURLToPath(
  new URL("../SubBuddyApp/Assets.xcassets/AppIcon.appiconset/", import.meta.url),
);
const defaultSource = fileURLToPath(
  new URL("./assets/app-icon-source-1024.png", import.meta.url),
);
const source = process.argv[2] ? resolve(process.argv[2]) : defaultSource;

const icons = [
  ["iphone", "20x20", "2x", 40],
  ["iphone", "20x20", "3x", 60],
  ["iphone", "29x29", "2x", 58],
  ["iphone", "29x29", "3x", 87],
  ["iphone", "40x40", "2x", 80],
  ["iphone", "40x40", "3x", 120],
  ["iphone", "60x60", "2x", 120],
  ["iphone", "60x60", "3x", 180],
  ["ipad", "20x20", "1x", 20],
  ["ipad", "20x20", "2x", 40],
  ["ipad", "29x29", "1x", 29],
  ["ipad", "29x29", "2x", 58],
  ["ipad", "40x40", "1x", 40],
  ["ipad", "40x40", "2x", 80],
  ["ipad", "76x76", "1x", 76],
  ["ipad", "76x76", "2x", 152],
  ["ipad", "83.5x83.5", "2x", 167],
  ["ios-marketing", "1024x1024", "1x", 1024],
];

if (process.platform !== "darwin") {
  throw new Error("App icon generation requires macOS and the built-in sips command.");
}

const workingDir = mkdtempSync(join(tmpdir(), "subbuddy-app-icons-"));

try {
  const images = icons.map(([idiom, size, scale, pixels]) => {
    const filename = `app-icon-${idiom}-${size.replace(".", "_")}-scale${scale}.png`;
    const temporaryOutput = join(workingDir, filename);
    const result = spawnSync(
      "sips",
      ["-z", String(pixels), String(pixels), source, "--out", temporaryOutput],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `sips failed for ${filename}`);
    }

    return { idiom, size, scale, filename, temporaryOutput };
  });

  mkdirSync(outputDir, { recursive: true });
  const expectedFilenames = new Set(images.map(({ filename }) => filename));

  for (const existing of readdirSync(outputDir)) {
    if (existing.endsWith(".png") && !expectedFilenames.has(existing)) {
      unlinkSync(join(outputDir, existing));
    }
  }

  for (const { filename, temporaryOutput } of images) {
    copyFileSync(temporaryOutput, join(outputDir, filename));
  }

  writeFileSync(
    join(outputDir, "Contents.json"),
    `${JSON.stringify(
      {
        images: images.map(({ idiom, size, scale, filename }) => ({
          idiom,
          size,
          scale,
          filename,
        })),
        info: {
          author: "xcode",
          version: 1,
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Generated ${images.length} app icons from ${basename(source)}.`);
} finally {
  rmSync(workingDir, { recursive: true, force: true });
}
