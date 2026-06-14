const { chromium } = require("playwright");

let browser;

async function main() {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

  await page.goto("http://127.0.0.1:8765", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".passage-card");

  const passages = await page.locator(".passage-card").count();
  if (passages !== 22) throw new Error(`Expected 22 passages, received ${passages}`);
  const readingSentenceUnits = await page.locator(
    "#v1 .source-panel[data-source='san_levi_1925'] .reading-sentence-unit",
  ).count();
  if (readingSentenceUnits < 2) {
    throw new Error("Expected foldable numbered sentence units in Reading");
  }
  const firstSentenceNumber = await page
    .locator(
      "#v1 .source-panel[data-source='san_levi_1925'] .reading-sentence-number",
    )
    .first()
    .innerText();
  if (firstSentenceNumber !== "1.1") {
    throw new Error(`Expected first sentence number 1.1, received ${firstSentenceNumber}`);
  }
  const sanskritSentencePanel = page.locator(
    "#v1 .source-panel[data-source='san_levi_1925']",
  );
  const sentenceToggles = sanskritSentencePanel.locator(
    "[data-toggle-reading-unit]",
  );
  const sentenceToggleCount = await sentenceToggles.count();
  if (sentenceToggleCount < 3) {
    throw new Error("Expected at least three Sanskrit sentence toggles");
  }
  await sentenceToggles.nth(1).click();
  await page
    .locator("#v1 [data-toggle-hide-collapsed='v1']")
    .click();
  const hiddenSentenceCount = await sanskritSentencePanel
    .locator(".reading-sentence-unit")
    .count();
  if (hiddenSentenceCount !== readingSentenceUnits - 1) {
    throw new Error("Expected collapsed sentences to disappear in focus workspace");
  }
  await page
    .locator("#v1 [data-toggle-hide-collapsed='v1']")
    .click();
  await sanskritSentencePanel
    .locator("[data-focus-sentence='sentence-v1-003']")
    .click();
  if (
    (await sanskritSentencePanel.locator(".reading-sentence-unit").count()) !== 1
  ) {
    throw new Error("Expected sentence focus to show one synchronized unit");
  }
  await page.locator("#v1 [data-clear-sentence-focus='v1']").click();

  await page
    .locator("#v1 [data-token-id='v1-san_levi_1925-t00003']")
    .click();
  const readingWordHighlights = await page.locator(
    "#v1 .text-token.alignment-active",
  ).count();
  if (readingWordHighlights < 2) {
    throw new Error("Expected a Sanskrit word click to highlight projected counterparts");
  }
  if ((await page.locator("#v1 .word-alignment-bar").count()) !== 1) {
    throw new Error("Expected word alignment status in Reading");
  }
  await page.locator("#v1 [data-clear-word-alignment]").click();

  await page.locator("#sidebarToggle").click();
  await page.waitForTimeout(300);
  const sidebarCollapsed = await page.locator("body").evaluate(
    (element) => element.classList.contains("sidebar-collapsed"),
  );
  if (!sidebarCollapsed) throw new Error("Expected navigation panel to collapse");

  const collapsedMargin = await page.locator(".workspace").evaluate(
    (element) => window.getComputedStyle(element).marginLeft,
  );
  if (collapsedMargin !== "0px") {
    throw new Error(`Expected full-width workspace, received margin ${collapsedMargin}`);
  }

  await page.locator("#sidebarOpen").click();
  await page.waitForTimeout(300);
  const sidebarReopened = await page.locator("body").evaluate(
    (element) => !element.classList.contains("sidebar-collapsed"),
  );
  if (!sidebarReopened) throw new Error("Expected navigation panel to reopen");

  await page.getByRole("button", { name: "Edit text & annotations" }).click();
  const readingEditor = page.locator("#v1 .editor-workbench.inline-editor");
  if ((await readingEditor.count()) !== 1) {
    throw new Error("Expected inline editor inside Reading");
  }
  const readingTokens = await page.locator("#v1 .source-text .text-token").count();
  if (!readingTokens) throw new Error("Expected selectable tokens inside Reading");

  const sanskritReadingPanel = sanskritSentencePanel;
  await sanskritReadingPanel.getByRole("button", { name: "Edit text" }).click();
  const textEditor = page.locator(
    "#v1 [data-text-edit-form][data-source-id='san_levi_1925']",
  );
  const revisedText =
    (await textEditor.locator("[data-field='witness-text']").getAttribute("value")) ||
    (await textEditor.locator("[data-field='witness-text']").textContent()) ||
    "";
  await textEditor
    .locator("[data-field='witness-text']")
    .fill(`${revisedText}\nSMOKE REVISION`);
  await textEditor
    .locator("[data-field='witness-edit-note']")
    .fill("Browser smoke-test revision");
  await textEditor.getByRole("button", { name: "Save revised text" }).click();
  const revisedWitnessDisplay = await page
    .locator(
      "#v1 .source-panel[data-source='san_levi_1925'] .witness-text-display",
    )
    .innerText();
  if (!revisedWitnessDisplay.includes("SMOKE REVISION")) {
    throw new Error("Expected revised witness text inside Reading");
  }
  const localDraftStatus = await page
    .locator(
      "#v1 .source-panel[data-source='san_levi_1925'] .witness-text-toolbar",
    )
    .innerText();
  if (!localDraftStatus.includes("saved only in this browser")) {
    throw new Error("Expected clear browser-local draft status");
  }
  await page.screenshot({
    path: "qa-collaboration-desktop.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Finish editing" }).click();

  await page.getByRole("button", { name: "Comparison" }).click();
  await page.locator("#v15 .passage-header").click();

  const phraseRows = await page.locator("#v15 .phrase-row:not(.full-passage-row)").count();
  if (phraseRows < 2) {
    throw new Error(`Expected generated sentence rows in verse 15, received ${phraseRows}`);
  }
  const firstComparisonNumber = await page
    .locator("#v15 .phrase-row:not(.full-passage-row) .phrase-index")
    .first()
    .innerText();
  if (firstComparisonNumber !== "15.1") {
    throw new Error(`Expected first comparison sentence 15.1, received ${firstComparisonNumber}`);
  }

  const resizers = await page.locator("#v15 .column-resizer").count();
  if (resizers !== 4) {
    throw new Error(`Expected four adjustable witness boundaries, received ${resizers}`);
  }

  await page.locator("#v15").screenshot({
    path: "qa-reader-desktop.png",
  });

  await page.getByRole("button", { name: "Edit text & annotations" }).click();
  const editor = page.locator("#v15 .editor-workbench.inline-editor");
  if ((await editor.count()) !== 1) {
    throw new Error("Expected inline editor inside Comparison");
  }

  await editor.locator("[data-field='unit-label']").fill("Argument structure");
  await editor.locator("[data-create-unit='v15']").click();
  if ((await page.getByText("Argument structure", { exact: true }).count()) < 1) {
    throw new Error("Expected new structural section");
  }

  const refreshedEditor = page.locator("#v15 .editor-workbench");
  await refreshedEditor.locator("[data-field='unit-label']").fill("First objection");
  await refreshedEditor.locator("[data-field='unit-level']").selectOption("subsection");
  await refreshedEditor
    .locator("[data-field='unit-parent']")
    .selectOption({ label: "section · Argument structure" });
  await refreshedEditor.locator("[data-create-unit='v15']").click();
  if ((await page.getByText("First objection", { exact: true }).count()) < 1) {
    throw new Error("Expected nested subsection");
  }

  await page
    .locator("#v15 .full-text-cell[data-source='san_levi_1925'] .text-token")
    .nth(20)
    .click();
  await page
    .locator("#v15 .full-text-cell[data-source='tib_derge'] .text-token")
    .nth(20)
    .click();

  const alignmentEditor = page.locator("#v15 .editor-workbench");
  await alignmentEditor.locator("[data-create-alignment='v15']").click();
  if ((await page.locator("#v15 .editor-alignment-list li").count()) !== 1) {
    throw new Error("Expected saved sentence correspondence");
  }
  const synchronizedRows = await page.locator(
    "#v15 .phrase-row:not(.full-passage-row)",
  ).count();
  if (synchronizedRows !== phraseRows) {
    throw new Error("Expected reviewed sentence correspondence to replace its projected row");
  }

  const savedEditorData = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vimsika-editor-annotations-v1")),
  );
  if (
    savedEditorData.units.length !== 2 ||
    savedEditorData.alignments.length !== 1 ||
    Object.keys(savedEditorData.textEdits).length !== 1
  ) {
    throw new Error("Expected editor annotations to persist in browser storage");
  }

  await page.locator("#v15").screenshot({
    path: "qa-editor-desktop.png",
  });

  await page.getByRole("button", { name: "Finish editing" }).click();
  if ((await page.locator("#v15 .editor-workbench").count()) !== 0) {
    throw new Error("Expected inline editor to close without losing annotations");
  }
  if (
    (await page.locator("#v15 .phrase-row:not(.full-passage-row)").count()) !== phraseRows
  ) {
    throw new Error("Expected synchronized row to remain after closing editor");
  }

  await page.getByRole("button", { name: "Editor" }).click();
  if ((await page.locator("#v15 .editor-workbench").count()) !== 1) {
    throw new Error("Expected dedicated Editor view to remain available");
  }

  const savedSanskritToken = savedEditorData.alignments[0].targetTokenIds.san_levi_1925[0];
  const savedTibetanToken = savedEditorData.alignments[0].targetTokenIds.tib_derge[0];
  await page.getByRole("button", { name: "Alignment" }).click();
  await page.locator(`#v15 [data-token-id='${savedSanskritToken}']`).click();
  const liveFrames = await page.locator("#v15 .correspondence-frame.live").count();
  if (liveFrames !== 1) {
    throw new Error("Expected a live correspondence frame after Sanskrit selection");
  }
  const linkedHighlights = await page.locator(
    `#v15 [data-token-id='${savedSanskritToken}'].alignment-active, #v15 [data-token-id='${savedTibetanToken}'].alignment-active`,
  ).count();
  if (linkedHighlights !== 2) {
    throw new Error("Expected Sanskrit token click to reveal its saved correspondence");
  }

  await page.locator("#v15 [data-pin-frame]").click();
  const pinnedFrames = await page.locator("#v15 .correspondence-frame.pinned").count();
  if (pinnedFrames !== 1) throw new Error("Expected a pinned comparison frame");
  await page.locator("#v15").screenshot({
    path: "qa-alignment-frames.png",
  });

  await page.locator("#v15 [data-clear-live-frame]").click();
  const unalignedSanskritToken = "v15-san_levi_1925-t00128";
  await page.locator(`#v15 [data-token-id='${unalignedSanskritToken}']`).click();
  const machineLabels = await page.locator("#v15 .machine-label").count();
  if (machineLabels < 1) {
    throw new Error("Expected a clearly marked machine-projected candidate");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.locator("#v15 .collation-shell").evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  if (!overflow) throw new Error("Expected horizontal collation scrolling on mobile");

  await page.screenshot({
    path: "qa-reader.png",
    fullPage: true,
  });

  console.log(`passages=${passages} readingSentenceUnits=${readingSentenceUnits} hiddenSentenceCount=${hiddenSentenceCount} readingWordHighlights=${readingWordHighlights} sidebarCollapsed=${sidebarCollapsed} readingTokens=${readingTokens} initialPhraseRows=${phraseRows} synchronizedRows=${synchronizedRows} resizers=${resizers} editorUnits=${savedEditorData.units.length} editorAlignments=${savedEditorData.alignments.length} liveFrames=${liveFrames} pinnedFrames=${pinnedFrames} linkedHighlights=${linkedHighlights} mobileOverflow=${overflow}`);
  await browser.close();
  browser = null;
}

main().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
