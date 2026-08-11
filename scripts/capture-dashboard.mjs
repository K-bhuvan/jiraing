import { chromium } from "playwright";
import path from "node:path";

const out = path.resolve("docs/dashboard-screenshot.png");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 820 },
  deviceScaleFactor: 2,
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector("main.shell table.workload");
await page.waitForTimeout(800);

// Matte frame so the dark UI pops on GitHub's light README background
await page.addStyleTag({
  content: `
    nextjs-portal, [data-nextjs-toast] { display: none !important; }
    html, body {
      background: #dfe7e2 !important;
      background-image: none !important;
      min-height: 100% !important;
    }
    body {
      display: flex !important;
      justify-content: center !important;
      align-items: flex-start !important;
      padding: 40px 32px 48px !important;
      margin: 0 !important;
    }
    main.shell {
      width: min(1080px, 100%) !important;
      margin: 0 !important;
      padding: 1.75rem 1.5rem !important;
      border-radius: 1.25rem !important;
      background:
        radial-gradient(900px 420px at 10% -10%, rgba(62, 207, 142, 0.28) 0%, transparent 55%),
        radial-gradient(700px 380px at 100% 0%, rgba(240, 180, 41, 0.16) 0%, transparent 50%),
        linear-gradient(165deg, #0b1614, #142824 45%, #1a3830) !important;
      box-shadow:
        0 24px 60px rgba(15, 28, 26, 0.35),
        0 2px 0 rgba(255,255,255,0.35) inset !important;
    }
  `,
});

await page.waitForTimeout(400);
await page.locator("main.shell").screenshot({
  path: out,
  type: "png",
  animations: "disabled",
});
await browser.close();
console.log("wrote", out);
