const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "output");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto("file://" + path.join(__dirname, "intro.html"));
  await page.waitForTimeout(5200);
  const video = page.video();
  await context.close();
  await browser.close();

  const savedPath = await video.path();
  const finalPath = path.join(outDir, "intro-raw.webm");
  fs.renameSync(savedPath, finalPath);
  console.log("RENDERED:" + finalPath);
})();
