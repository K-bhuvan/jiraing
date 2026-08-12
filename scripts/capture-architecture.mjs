import { chromium } from "playwright";
import path from "node:path";

const html = path.resolve("docs/architecture-flow.html");
const out = path.resolve("docs/architecture-flow.png");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2,
});
await page.goto(`file://${html}`, { waitUntil: "load" });
await page.waitForTimeout(200);
await page.locator("#diagram").screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
