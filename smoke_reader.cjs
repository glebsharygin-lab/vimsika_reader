const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

  await page.goto("http://127.0.0.1:8765", { waitUntil: "networkidle" });
  await page.waitForSelector(".passage-card");

  const passages = await page.locator(".passage-card").count();
  if (passages !== 22) throw new Error(`Expected 22 passages, received ${passages}`);

  await page.getByRole("button", { name: "Comparison" }).click();
  const panels = await page.locator(".source-panel").count();
  if (panels !== 88) throw new Error(`Expected 88 selected source panels, received ${panels}`);

  const unavailable = await page.locator("#v5 .unavailable-text").count();
  if (unavailable !== 1) {
    throw new Error(`Expected one unavailable English panel in verse 5, received ${unavailable}`);
  }

  await page.getByRole("button", { name: "Alignment" }).click();
  await page.locator("#v15 .alignment-chip").first().click();
  const highlights = await page.locator("#v15 mark").count();
  if (highlights < 4) throw new Error(`Expected linked phrase highlights, received ${highlights}`);

  await page.screenshot({
    path: "qa-reader.png",
    fullPage: true,
  });

  console.log(`passages=${passages} panels=${panels} highlights=${highlights}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
