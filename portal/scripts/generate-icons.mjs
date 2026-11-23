// Genera los PNG de la PWA a partir de public/icons/icon.svg (requiere Playwright).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // preinstalado globalmente (NODE_PATH)
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const out = (n) => new URL(`../public/icons/${n}`, import.meta.url).pathname;
for (const [name, size, pad, round] of [['icon-192.png', 192, 0, true], ['icon-512.png', 512, 0, true], ['icon-maskable-512.png', 512, 0.12, false], ['apple-touch-icon.png', 180, 0, false]]) {
  const inner = round ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${round ? 'transparent' : '#8A5A3B'}"><div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
    <div style="width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
  await page.screenshot({ path: out(name), omitBackground: round });
}
await browser.close();
console.log('ok');
