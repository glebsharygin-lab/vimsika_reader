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
  await page.locator("#v15 .passage-header").click();

  const phraseRows = await page.locator("#v15 .phrase-row:not(.full-passage-row)").count();
  if (phraseRows !== 5) {
    throw new Error(`Expected five phrase rows in verse 15, received ${phraseRows}`);
  }

  const resizers = await page.locator("#v15 .column-resizer").count();
  if (resizers !== 4) {
    throw new Error(`Expected four adjustable witness boundaries, received ${resizers}`);
  }

  const firstPhrase = page.locator("#v15 [data-alignment-row='v15-unity']");
  await firstPhrase.locator(".phrase-label").click();
  if (!(await firstPhrase.evaluate((element) => element.classList.contains("collapsed")))) {
    throw new Error("Expected phrase row to collapse");
  }
  await firstPhrase.locator(".phrase-label").click();

  await firstPhrase.locator(".phrase-cell").first().click();
  if (!(await firstPhrase.evaluate((element) => element.classList.contains("active")))) {
    throw new Error("Expected selected phrase alignment to become active");
  }

  await page.locator("#v15").screenshot({
    path: "qa-reader-desktop.png",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.locator("#v15 .collation-shell").evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  if (!overflow) throw new Error("Expected horizontal collation scrolling on mobile");

  await page.screenshot({
    path: "qa-reader.png",
    fullPage: true,
  });

  console.log(`passages=${passages} phraseRows=${phraseRows} resizers=${resizers} mobileOverflow=${overflow}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
