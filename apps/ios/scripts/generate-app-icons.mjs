import { deflateSync } from "node:zlib";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = new URL("../SubBuddyApp/Assets.xcassets/AppIcon.appiconset/", import.meta.url);

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

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function png(size) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const rows = [];
  const center = (size - 1) / 2;
  const radius = size * 0.32;

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      const t = (x + y) / Math.max(1, size * 2 - 2);
      let r = Math.round(22 + 28 * t);
      let g = Math.round(64 + 78 * t);
      let b = Math.round(82 + 78 * t);

      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < radius) {
        r = 239;
        g = 246;
        b = 242;
      }
      if (Math.abs(dx) < size * 0.035 && distance < radius * 0.76) {
        r = 21;
        g = 91;
        b = 99;
      }
      if (Math.abs(dy) < size * 0.035 && distance < radius * 0.76) {
        r = 21;
        g = 91;
        b = 99;
      }

      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = 255;
    }
    rows.push(row);
  }

  const idat = deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDir, { recursive: true });

for (const filename of readdirSync(outputDir)) {
  if (filename.endsWith(".png")) {
    unlinkSync(join(outputDir.pathname, filename));
  }
}

const images = icons.map(([idiom, size, scale, pixels]) => {
  const filename = `app-icon-${idiom}-${size.replace(".", "_")}-scale${scale}.png`;
  writeFileSync(join(outputDir.pathname, filename), png(pixels));
  return { idiom, size, scale, filename };
});

writeFileSync(
  join(outputDir.pathname, "Contents.json"),
  `${JSON.stringify({
    images,
    info: {
      author: "xcode",
      version: 1,
    },
  }, null, 2)}\n`
);
