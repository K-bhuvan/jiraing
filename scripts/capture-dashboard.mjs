import { chromium } from "playwright";
import path from "node:path";

const out = path.resolve("docs/dashboard-screenshot.png");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 780 },
  deviceScaleFactor: 2,
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector("main.shell table.workload");
await page.waitForTimeout(800);

await page.addStyleTag({
  content: `
    nextjs-portal, [data-nextjs-toast] { display: none !important; }
    html, body {
      background: #e7eee9 !important;
      background-image: none !important;
      min-height: 100% !important;
    }
    body {
      margin: 0 !important;
      padding: 36px 28px 40px !important;
    }
    main.shell {
      width: min(1040px, 100%) !important;
      margin: 0 auto !important;
      padding: 1.6rem 1.4rem !important;
      border-radius: 1.2rem !important;
      background:
        radial-gradient(900px 420px at 10% -10%, rgba(62, 207, 142, 0.3) 0%, transparent 55%),
        radial-gradient(700px 380px at 100% 0%, rgba(240, 180, 41, 0.18) 0%, transparent 50%),
        linear-gradient(165deg, #0b1614, #142824 45%, #1a3830) !important;
      box-shadow:
        0 22px 50px rgba(15, 28, 26, 0.28),
        0 0 0 1px rgba(15, 28, 26, 0.08) !important;
    }
  `,
});

await page.waitForTimeout(400);
// Full viewport keeps the light matte around the dark UI (reads better on GitHub README)
await page.screenshot({
  path: out,
  type: "png",
  animations: "disabled",
});
await browser.close();
console.log("wrote", out);
