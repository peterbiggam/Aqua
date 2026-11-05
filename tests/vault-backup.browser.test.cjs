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
const outboundWebSocketFrames = [];
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
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      process.env.CHROMIUM_PATH ||
      chromium.executablePath();
    if (fs.existsSync(executablePath)) launchOptions.executablePath = executablePath;

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ acceptDownloads: true });
    context.on("page", page => page.on("websocket", socket => socket.on("framesent", frame => {
      const payload = frame?.payload;
      outboundWebSocketFrames.push(Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload || ""));
    })));
    await context.routeWebSocket(
      url => ["xrplcluster.com", "s.altnet.rippletest.net"].includes(url.hostname),
      socket => {
        socket.onMessage(message => {
          let request;
          try { request = JSON.parse(String(message)); } catch (error) { return; }
          const common = { id: request.id, status: "success", type: "response" };
          if (request.command === "server_info") {
            socket.send(JSON.stringify({
              ...common,
              result: { info: { validated_ledger: { seq: 123456, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } },
            }));
          } else if (request.command === "account_info") {
            socket.send(JSON.stringify({
              id: request.id,
              status: "error",
              type: "response",
              result: { status: "error", error: "actNotFound", error_message: "Account not found", ledger_index: 123456, validated: true },
            }));
          } else {
            socket.send(JSON.stringify({
              ...common,
              result: { ledger_index: 123456, validated: true, lines: [] },
            }));
          }
        });
      },
    );
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
    assert.match(await sourcePage.title(), /v3\.4\.1/);
    assert.equal(await sourcePage.locator("#headerVersionLabel").innerText(), "V3.4.1");
    await sourcePage.locator('[data-action="toggleNetworkModal"]').click();
    await sourcePage.locator('[data-action="switchNetwork"][data-value="MAINNET"]').click();
    await sourcePage.getByText(/endpoint responded; validated ledger #123456/).waitFor();
    assert.equal(await sourcePage.locator("#netName").innerText(), "MAINNET");
    await sourcePage.locator('[data-action="switchNetwork"][data-value="TESTNET"]').click();
    await sourcePage.getByText(/endpoint responded; validated ledger #123456/).waitFor();
    await sourcePage.locator('#modalNetwork [data-action="closeAllModals"]').click();
    console.log("PASS: Mainnet/Testnet selection reports read-only network status before unlock");
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
    assert.equal(sourceVault.version, 2);
    assert.equal(sourceVault.kdf.iterations, 600000);
    assert.equal(JSON.stringify(sourceVault).includes(seed), false, "Local vault must not expose the seed");
    assert.equal(await sourcePage.locator("#passphraseInput").inputValue(), "");
    assert.equal(await sourcePage.locator("#passphraseConfirmInput").inputValue(), "");
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), true);
    console.log("PASS: disposable vault creation stores encrypted seed data");

    await sourcePage.locator("#lockWalletBtn").click();
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), false, "Manual lock should show unlock view");
    await sourcePage.locator("#unlockPassphraseInput").fill("Wrong-Test-Passphrase");
    await sourcePage.locator('[data-action="attemptVaultUnlockWithPassphrase"]').click();
    await sourcePage.getByText("Vault could not be unlocked. Check the passphrase or backup integrity.").waitFor();
    assert.equal(await hidden(sourcePage.locator("#viewUnlock")), false, "Wrong passphrase must not unlock");
    await sourcePage.locator("#unlockPassphraseInput").fill(passphrase);
    const mobileUnlockStarted = Date.now();
    await sourcePage.locator('[data-action="attemptVaultUnlockWithPassphrase"]').click();
    await sourcePage.waitForFunction(
      () => !document.getElementById("viewDashboard").classList.contains("hidden"),
    );
    const mobileUnlockDuration = Date.now() - mobileUnlockStarted;
    assert.ok(mobileUnlockDuration < 30000, `Mobile-sized vault unlock took ${mobileUnlockDuration}ms`);
    assert.equal(await sourcePage.locator("#unlockPassphraseInput").inputValue(), "");
    console.log(`PASS: locking, correct unlock, wrong-passphrase rejection, and mobile-sized unlock (${mobileUnlockDuration}ms)`);

    await sourcePage.locator('[data-action="openBackupModal"]').click();
    const downloadPromise = sourcePage.waitForEvent("download");
    await sourcePage.locator('[data-action="downloadAquaVaultFile"]').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.aqua$/);
    const backupPath = path.join(tempDir, "disposable-vault.aqua");
    await download.saveAs(backupPath);
    await sourcePage.locator('#modalBackup [data-action="closeAllModals"]').click();
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
    const invalidBackup = Buffer.from(JSON.stringify({
      ...sourceVault,
      ciphertext: `!${sourceVault.ciphertext.slice(1)}`,
    }));
    await restorePage.locator("#aquaFileInput").setInputFiles({
      name: "damaged.aqua",
      mimeType: "application/json",
      buffer: invalidBackup,
    });
    await restorePage.getByText("Backup rejected: invalid or unsupported encrypted vault file").waitFor();
    assert.equal(
      await restorePage.evaluate(() => localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34")),
      null,
      "Damaged backup must not create or replace stored vault data",
    );
    await restorePage.locator("#aquaFileInput").setInputFiles(backupPath);
    await restorePage.getByText("Encrypted vault v2 loaded; unlock it to verify the backup.").waitFor();
    await restorePage.waitForFunction(
      () => !document.getElementById("viewUnlock").classList.contains("hidden"),
    );
    await restorePage.locator("#unlockPassphraseInput").fill(passphrase);
    await restorePage.locator('[data-action="attemptVaultUnlockWithPassphrase"]').click();
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

    const usableVaultBeforeDamage = await sourcePage.evaluate(() =>
      localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34"),
    );
    await sourcePage.locator("#viewUnlock input[type=file]").setInputFiles({
      name: "damaged-existing.aqua",
      mimeType: "application/json",
      buffer: invalidBackup,
    });
    await sourcePage.getByText("Backup rejected: invalid or unsupported encrypted vault file").waitFor();
    assert.equal(
      await sourcePage.evaluate(() => localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34")),
      usableVaultBeforeDamage,
      "Damaged backup must not replace an existing usable encrypted vault",
    );
    assert.equal(await hidden(sourcePage.locator("#viewDashboard")), false, "Invalid import must not unlock or lock out the current vault");
    console.log("PASS: damaged backup cannot replace an existing vault");

    await sourcePage.evaluate(async ({ seed, address, passphrase }) => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const material = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"],
      );
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(seed),
      );
      const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
      localStorage.setItem("AQUA_XRPL_AES256_VAULT_V34", JSON.stringify({
        address,
        salt: toBase64(salt),
        iv: toBase64(iv),
        ciphertext: toBase64(ciphertext),
      }));
    }, { seed, address: sourceAddress, passphrase });
    await sourcePage.locator("#lockWalletBtn").click();
    await sourcePage.locator("#unlockPassphraseInput").fill(passphrase);
    await sourcePage.locator('[data-action="attemptVaultUnlockWithPassphrase"]').click();
    await sourcePage.waitForFunction(
      () => !document.getElementById("viewDashboard").classList.contains("hidden"),
    );
    const upgradedLegacy = await sourcePage.evaluate(() =>
      JSON.parse(localStorage.getItem("AQUA_XRPL_AES256_VAULT_V34")),
    );
    assert.equal(upgradedLegacy.version, 2, "Legacy 100,000-iteration backup should upgrade on unlock");
    assert.equal(upgradedLegacy.kdf.iterations, 600000);
    console.log("PASS: legacy backup unlocks and upgrades to the versioned stronger KDF");

    const allRequests = [
      ...outboundRequests,
      ...outboundWebSocketFrames.map(body => ({ url: "websocket", method: "WS", body })),
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
