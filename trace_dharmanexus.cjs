const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const pageUrl =
  process.argv[2] ||
  "https://dharmamitra.org/nexus/db/sa/SA_T06_vasvvmsu/text";
const outputDirectory = path.resolve(
  process.argv[3] || "reference-source/dharmanexus-network",
);
const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function safeName(value) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .slice(0, 180);
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: edgePath,
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const records = [];
  let responseNumber = 0;

  page.on("request", (request) => {
    if (!request.url().includes("/api-db/")) return;
    records.push({
      event: "request",
      method: request.method(),
      url: request.url(),
      postData: request.postData(),
    });
  });

  page.on("response", async (response) => {
    if (!response.url().includes("/api-db/")) return;
    const contentType = response.headers()["content-type"] || "";
    const record = {
      event: "response",
      status: response.status(),
      url: response.url(),
      contentType,
    };
    try {
      const body = await response.body();
      responseNumber += 1;
      const extension = contentType.includes("json") ? ".json" : ".bin";
      const fileName = `${String(responseNumber).padStart(3, "0")}-${safeName(
        response.url(),
      )}${extension}`;
      fs.writeFileSync(path.join(outputDirectory, fileName), body);
      record.file = fileName;
      record.length = body.length;
    } catch (error) {
      record.error = error.message;
    }
    records.push(record);
  });

  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(5000);
  fs.writeFileSync(
    path.join(outputDirectory, "trace.json"),
    JSON.stringify({ pageUrl, capturedAt: new Date().toISOString(), records }, null, 2),
  );
  console.log(JSON.stringify(records, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
