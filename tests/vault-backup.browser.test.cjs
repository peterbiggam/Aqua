const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const appHtml = fs.readFileSync(
  path.join(__dirname, "..", "aqua_wallet_v3_4_application.html"),
  "utf8",
);
const outboundRequests = [];
const serverRequests = [];
const allowedStaticHosts = new Set([
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "unpkg.com",
  "cdnjs.cloudflare.com",
]);

function startOriginServer() {
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      serverRequests.push({
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (request.method !== "GET" || !["/", "/aqua.html"].includes(request.url)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(appHtml);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve({
        server,
        origin: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

function hidden(locator) {
  return locator.evaluate((element) => element.classList.contains("hidden"));
}

async function run() {
  const origins = await Promise.all([startOriginServer(), startOriginServer()]);
  const first = origins[0];
  const fresh = origins[1];
  let browser;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aqua-vault-test-"));

  try {
    assert.notEqual(first.origin, fresh.origin, "Restore must use a distinct origin");
    const launchOptions = { headless: true, args: ["--no-sandbox"] };
    const executablePath =
      process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      process.env.CHROMIUM_PATH ||
      "/repl/tools/bin/chromium";
    if (fs.existsSync(executablePath)) launchOptions.executablePath = executablePath;

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ acceptDownloads: true });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") {
        await route.continue();
      } else if (url.protocol === "https:" && allowedStaticHosts.has(url.hostname)) {
        await route.continue();
      } else {
        // Never contact XRPL or any other service during a wallet backup test.
        await route.abort();
      }
    });

    const sourcePage = await context.newPage();
    sourcePage.on("request", (request) => {
      outboundRequests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData() || "",
      });
    });
    await sourcePage.goto(first.origin, { waitUntil: "domcontentloaded" });
    await sourcePage.waitForFunction(() => window.xrpl?.Wallet?.generate);
    await sourcePage.getByText("Create New XRP Vault", { exact: true }).click();

    const seed = (await sourcePage.locator("#genSecretSeed").innerText()).trim();
    assert.match(seed, /^s[A-Za-z0-9]{20,}$/, "A disposable XRPL seed should be generated");
    await sourcePage.locator("#seedSavedCheckbox").check();
    await sourcePage.locator("#proceedToPinBtn").click();
    const passphrase = "TestOnly-Backup-4829";
    await sourcePage.locator("#passphraseInput").fill(passphrase);
    await sourcePage.locator("#passphraseConfirmInput").fill(passphrase);
    await sourcePage.locator("#finalizeVaultBtn").click();
    await sourcePage.waitForFunction(
      () => !document.getElementById("viewDashboard").classList.contains("hidden"),
    );

    const sourceVault = await sourcePage.evaluate(() =>
      JSON.parse(localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34")),
    );
    assert.ok(sourceVault && sourceVault.ciphertext && sourceVault.salt && sourceVault.iv);
    assert.equal(JSON.stringify(sourceVault).includes(seed), false, "Local vault must not expose the seed");
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), true);
    console.log("PASS: disposable vault creation stores encrypted seed data");

    await sourcePage.locator("#lockWalletBtn").click();
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), false, "Manual lock should show unlock view");
    await sourcePage.locator("#unlockPassphraseInput").fill("Wrong-Test-Passphrase");
    await sourcePage.getByText("Unlock Vault", { exact: true }).click();
    await sourcePage.getByText("Incorrect Passphrase").waitFor();
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), false, "Wrong passphrase must not unlock");
    await sourcePage.locator("#unlockPassphraseInput").fill(passphrase);
    await sourcePage.getByText("Unlock Vault", { exact: true }).click();
    await sourcePage.waitForFunction(
      () => !document.getElementById("viewDashboard").classList.contains("hidden"),
    );
    console.log("PASS: locking, correct unlock, and wrong-passphrase rejection");

    await sourcePage.locator('[onclick="openBackupModal()"]').click();
    const downloadPromise = sourcePage.waitForEvent("download");
    await sourcePage.locator('[onclick="downloadAquaVaultFile()"]').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.aqua$/);
    const backupPath = path.join(tempDir, "disposable-vault.aqua");
    await download.saveAs(backupPath);
    const backupText = fs.readFileSync(backupPath, "utf8");
    const backupPayload = JSON.parse(backupText);
    assert.equal(backupText.includes(seed), false, "Exported .aqua file must not contain the plaintext seed");
    assert.deepEqual(backupPayload, sourceVault, "Export should preserve the encrypted vault payload");
    console.log("PASS: .aqua export is parseable and contains no plaintext seed");

    const restorePage = await context.newPage();
    restorePage.on("request", (request) => {
      outboundRequests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData() || "",
      });
    });
    await restorePage.goto(fresh.origin, { waitUntil: "domcontentloaded" });
    await restorePage.waitForFunction(() => window.xrpl?.Wallet?.fromSeed);
    assert.equal(await hidden(restorePage.locator("#viewOnboarding")), false);
    await restorePage.locator("#aquaFileInput").setInputFiles(backupPath);
    await restorePage.getByText("Portable .aqua Vault Loaded Successfully!").waitFor();
    await restorePage.waitForFunction(
      () => !document.getElementById("viewUnlock").classList.contains("hidden"),
    );
    await restorePage.locator("#unlockPassphraseInput").fill(passphrase);
    await restorePage.getByText("Unlock Vault", { exact: true }).click();
    await restorePage.waitForFunction(
      () => !document.getElementById("viewDashboard").classList.contains("hidden"),
    );
    const restoredAddress = await restorePage.locator("#receiveFullAddress").innerText();
    const sourceAddress = sourceVault.address;
    assert.equal(restoredAddress, sourceAddress, "Restored wallet address should match the backup");
    assert.equal(
      await restorePage.evaluate(() => localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34")),
      backupText,
      "Fresh origin should store the imported encrypted backup",
    );
    console.log("PASS: backup imports and unlocks in a fresh browser origin");

    const allRequests = [
      ...outboundRequests,
      ...serverRequests.map((request) => ({
        url: request.url,
        method: request.method,
        body: request.body,
      })),
    ];
    assert.equal(
      allRequests.some((request) => request.url.includes(seed) || request.body.includes(seed)),
      false,
      "No observed server or network request may contain the plaintext seed",
    );
    assert.equal(
      serverRequests.some((request) => request.body.includes(seed)),
      false,
      "No request body sent to either test origin may contain the plaintext seed",
    );
    console.log("PASS: no observed HTTP request URL or body contains the plaintext seed");

    await context.close();
  } finally {
    if (browser) await browser.close();
    for (const { server } of origins) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  // Keep test output secret-safe: do not print browser page content or test values.
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
