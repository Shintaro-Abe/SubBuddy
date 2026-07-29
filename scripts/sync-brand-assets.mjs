import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = resolve(repositoryRoot, "assets/brand");
const webDirectory = resolve(repositoryRoot, "apps/web/public/brand");
const iosAssetDirectory = resolve(repositoryRoot, "apps/ios/SubBuddyApp/Assets.xcassets");

const sourceWordmark = resolve(sourceDirectory, "mudask-wordmark.svg");
const sourceMascot = resolve(sourceDirectory, "mudask-mascot.png");
const derivedWordmark = resolve(webDirectory, "mudask-wordmark.svg");
const webMascot = resolve(webDirectory, "mudask-mascot.png");
const iosWordmark = resolve(
  iosAssetDirectory,
  "MudaskWordmark.imageset/mudask-wordmark.svg",
);
const iosMascot = resolve(iosAssetDirectory, "MudaskMascot.imageset/mudask-mascot.png");

await Promise.all([
  mkdir(webDirectory, { recursive: true }),
  mkdir(dirname(iosWordmark), { recursive: true }),
  mkdir(dirname(iosMascot), { recursive: true }),
]);

const originalWordmark = await readFile(sourceWordmark, "utf8");
const svgOpeningPattern =
  /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">/;

if (!svgOpeningPattern.test(originalWordmark)) {
  throw new Error("MUDASKワードマークSVGのルート要素が想定形式ではありません。");
}

// 元画像の描画範囲（x=70..959、y=420..619）へ10px以上の安全余白を残す。
// pathとfillは変更せず、表示領域と縦横比だけを調整する。
const croppedWordmark = originalWordmark.replace(
  svgOpeningPattern,
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="909" height="220" viewBox="60 410 909 220">',
);

await Promise.all([
  writeFile(derivedWordmark, croppedWordmark),
  writeFile(iosWordmark, croppedWordmark),
  copyFile(sourceMascot, webMascot),
  copyFile(sourceMascot, iosMascot),
]);

console.log("MUDASKブランド画像をWebとiPhoneへ同期しました。");
