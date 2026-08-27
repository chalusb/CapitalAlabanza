const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

// Uso: node render.js [nombre-html-sin-extension] [duracion-ms]
// Ej:  node render.js outro 3400
const page_name = process.argv[2] || "intro";
const duration_ms = parseInt(process.argv[3] || "5200", 10);

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
  await page.goto("file://" + path.join(__dirname, page_name + ".html"));
  await page.waitForTimeout(duration_ms);
  const video = page.video();
  await context.close();
  await browser.close();

  const savedPath = await video.path();
  const finalPath = path.join(outDir, page_name + "-raw.webm");
  fs.renameSync(savedPath, finalPath);
  console.log("RENDERED:" + finalPath);
})();
