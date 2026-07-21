import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from '../../../apps/web/node_modules/playwright/index.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const deckDir = resolve(scriptDir, '..');
const outputDir = resolve(deckDir, 'rendered');
const deckUrl = pathToFileURL(resolve(deckDir, 'deck.html')).href;

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(deckUrl, { waitUntil: 'load' });

const slideCount = await page.locator('.slide').count();
if (slideCount !== 9) {
  throw new Error(`Expected 9 slides, found ${slideCount}`);
}

for (let index = 1; index <= slideCount; index += 1) {
  await page.evaluate((nextIndex) => {
    location.hash = String(nextIndex);
  }, index);
  await page.waitForFunction((nextIndex) => {
    const active = document.querySelector('.slide.active');
    return active?.dataset.page === String(nextIndex);
  }, index);
  const overflow = await page.locator('.slide.active').evaluate((slide) => ({
    horizontal: slide.scrollWidth > slide.clientWidth,
    vertical: slide.scrollHeight > slide.clientHeight,
    scrollWidth: slide.scrollWidth,
    clientWidth: slide.clientWidth,
    scrollHeight: slide.scrollHeight,
    clientHeight: slide.clientHeight,
  }));
  if (overflow.horizontal || overflow.vertical) {
    throw new Error(`Slide ${index} overflows: ${JSON.stringify(overflow)}`);
  }
  await page.locator('.slide.active').screenshot({
    path: resolve(outputDir, `slide-${String(index).padStart(2, '0')}.png`),
  });
}

await page.pdf({
  path: resolve(outputDir, 'subbuddy-lt-20260730.pdf'),
  width: '13.333in',
  height: '7.5in',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

const imageUrls = Array.from({ length: slideCount }, (_, index) =>
  pathToFileURL(resolve(outputDir, `slide-${String(index + 1).padStart(2, '0')}.png`)).href,
);
await page.setViewportSize({ width: 1500, height: 1000 });
await page.setContent(`<!doctype html>
  <html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: #25241f; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    img { display: block; width: 100%; border: 1px solid #5b584f; box-shadow: 0 5px 18px rgba(0,0,0,.25); }
  </style></head><body><main>
    ${imageUrls.map((url, index) => `<img src="${url}" alt="slide ${index + 1}">`).join('')}
  </main></body></html>`, { waitUntil: 'load' });
await page.screenshot({ path: resolve(outputDir, 'contact-sheet.png'), fullPage: true });

await browser.close();
console.log(`Rendered ${slideCount} slides, contact sheet, and PDF to ${outputDir}`);
