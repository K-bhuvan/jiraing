import { chromium } from "playwright";
import path from "node:path";

const out = path.resolve("docs/dashboard-screenshot.png");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.waitForSelector("main.shell table.workload");
await page.addStyleTag({
  content: `
    nextjs-portal, [data-nextjs-toast], [data-next-mark-loading] { display: none !important; }
    body { animation: none !important; }
  `,
});
await page.screenshot({
  path: out,
  type: "png",
  fullPage: false,
});
await browser.close();
console.log("wrote", out);
