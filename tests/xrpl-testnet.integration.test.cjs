const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const xrpl = require("xrpl");

const ROOT = path.join(__dirname, "..");
const TESTNET_URL = "wss://s.altnet.rippletest.net:51233/";
const APP_ORIGIN = process.env.WALLET_TEST_ORIGIN || "http://127.0.0.1:5000";
let currentStage = "initial setup";

async function waitForServer(origin, child) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch (error) {}
    if (child?.exitCode !== null && child?.exitCode !== undefined) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Wallet test server did not start");
}

async function submitValidated(client, wallet, transaction) {
  const autofilled = await client.autofill(transaction);
  const signed = wallet.sign(autofilled);
  const response = await client.submitAndWait(signed.tx_blob);
  const result = response?.result || response;
  assert.equal(result?.validated, true, "Testnet transaction must be validated");
  assert.equal(result?.meta?.TransactionResult, "tesSUCCESS", "Testnet transaction must succeed");
  return result;
}

async function fund(client, wallet) {
  await client.fundWallet(wallet);
  const balance = await client.getXrpBalance(wallet.classicAddress, "validated");
  assert.ok(Number(balance) > 20, "Faucet wallet should have test XRP");
}

async function addTrustline(client, holder, issuer) {
  await submitValidated(client, holder, {
    TransactionType: "TrustSet",
    Account: holder.classicAddress,
    LimitAmount: { currency: "TST", issuer: issuer.classicAddress, value: "1000000" },
  });
}

async function run() {
  const app = fs.readFileSync(path.join(ROOT, "aqua_wallet_v3_4_application.html"), "utf8");
  assert.match(app, /<meta name="app-version" content="3\.4\.1"/);

  let serverChild = null;
  let browser = null;
  let client = null;
  try {
    currentStage = "starting the local app";
    try {
      const response = await fetch(APP_ORIGIN);
      if (!response.ok) throw new Error("app not responding");
    } catch (error) {
      serverChild = spawn("python3", ["server.py"], { cwd: ROOT, stdio: "ignore" });
    }
    await waitForServer(APP_ORIGIN, serverChild);

    currentStage = "connecting to XRPL Testnet";
    client = new xrpl.Client(TESTNET_URL, { timeout: 30000 });
    await client.connect();
    console.log("Stage passed: connected to XRPL Testnet");
    const sender = xrpl.Wallet.generate();
    const receiver = xrpl.Wallet.generate();
    const inactiveReceiver = xrpl.Wallet.generate();
    const issuer = xrpl.Wallet.generate();
    currentStage = "funding three disposable Testnet wallets";
    await fund(client, sender);
    await fund(client, receiver);
    await fund(client, issuer);
    console.log("Stage passed: funded disposable Testnet wallets");

    currentStage = "setting up issued-token trust lines and liquidity";
    await submitValidated(client, issuer, {
      TransactionType: "AccountSet",
      Account: issuer.classicAddress,
      SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
    });
    await addTrustline(client, sender, issuer);
    await addTrustline(client, receiver, issuer);
    for (const holder of [sender, receiver]) {
      await submitValidated(client, issuer, {
        TransactionType: "Payment",
        Account: issuer.classicAddress,
        Destination: holder.classicAddress,
        Amount: { currency: "TST", issuer: issuer.classicAddress, value: "1000" },
      });
    }
    await submitValidated(client, receiver, {
      TransactionType: "OfferCreate",
      Account: receiver.classicAddress,
      TakerGets: { currency: "TST", issuer: issuer.classicAddress, value: "100" },
      TakerPays: xrpl.xrpToDrops("1"),
    });
    console.log("Stage passed: prepared test token and DEX liquidity");

    currentStage = "opening the wallet in a mobile-sized browser";
    const launchOptions = { headless: true, args: ["--no-sandbox"] };
    const executablePath =
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      process.env.CHROMIUM_PATH ||
      chromium.executablePath();
    if (fs.existsSync(executablePath)) launchOptions.executablePath = executablePath;
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const requestBodies = [];
    const socketFrames = [];
    page.on("request", request => requestBodies.push(request.postData() || ""));
    page.on("websocket", socket => socket.on("framesent", frame => {
      const payload = frame?.payload;
      socketFrames.push(Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload || ""));
    }));

    currentStage = "loading the app and XRPL library";
    await page.goto(APP_ORIGIN, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.xrpl?.Wallet?.fromSeed);
    currentStage = "selecting Testnet in the browser";
    await page.locator('[data-action="toggleNetworkModal"]').click();
    await page.locator('[data-action="switchNetwork"]').filter({ hasText: "XRPL Testnet" }).click();
    await page.locator('#modalNetwork [data-action="closeAllModals"]').click();
    currentStage = "opening seed import";
    await page.locator('[data-action="showImportStep"]').click();
    await page.locator("#importSeedInput").fill(sender.seed);
    await page.locator("#confirmImportBtn").click();
    currentStage = "encrypting the imported wallet";
    const passphrase = "Disposable-Testnet-Wallet-90531";
    await page.locator("#passphraseInput").fill(passphrase);
    await page.locator("#passphraseConfirmInput").fill(passphrase);
    await page.locator("#finalizeVaultBtn").click();
    await page.waitForFunction(() =>
      !document.getElementById("viewDashboard").classList.contains("hidden"),
    );
    currentStage = "waiting for validated account balance";
    await page.waitForFunction(() =>
      document.getElementById("balanceSourceLabel").textContent.includes("VALIDATED LEDGER"),
      { timeout: 60000 },
    );
    assert.equal(await page.locator("#importSeedInput").inputValue(), "");
    console.log("Stage passed: imported disposable wallet and read validated balance");

    currentStage = "checking an inactive XRP destination";
    await page.locator('[data-action="openCommandModal"][data-value="send"]').click();
    await page.locator("#sendDestInput").fill(inactiveReceiver.classicAddress);
    await page.locator("#sendNextBtn1").click();
    await page.locator("#sendAmountInput").fill("0.01");
    await page.locator('[data-action="goToSendStep3"]').click();
    await page.waitForFunction(() =>
      document.getElementById("sendReviewStatus").textContent.includes("Destination account is not active"),
      { timeout: 60000 },
    );
    assert.equal(await page.locator("#sendConfirmButton").isDisabled(), true);
    console.log("PASS: low XRP payment to an inactive destination is blocked before signing");
    await page.locator('#modalSend [data-action="closeAllModals"]').click();

    currentStage = "opening the XRP payment review";
    await page.locator('[data-action="openCommandModal"][data-value="send"]').click();
    await page.locator("#sendDestInput").fill(receiver.classicAddress);
    await page.locator("#sendNextBtn1").click();
    await page.locator("#sendAmountInput").fill("0.01");
    currentStage = "preparing the XRP payment";
    await page.locator('[data-action="goToSendStep3"]').click();
    await page.waitForFunction(() =>
      document.getElementById("sendReviewStatus").textContent.includes("Prepared, unsigned transaction"),
      { timeout: 60000 },
    );
    assert.equal(await page.locator("#summarySendNetwork").innerText(), "TESTNET");
    await page.locator("#sendConfirmCheckbox").check();
    currentStage = "submitting and validating the XRP payment";
    await page.locator("#sendConfirmButton").click();
    await page.waitForFunction(() =>
      document.getElementById("sendReviewStatus").textContent.includes("Validated success"),
      { timeout: 90000 },
    );
    await page.waitForFunction(() =>
      !document.getElementById("syncSpinner").classList.contains("animate-spin"),
      { timeout: 60000 },
    );
    console.log("PASS: real XRP payment submitted from the browser and validated on Testnet");
    await page.locator('#modalSend [data-action="closeAllModals"]').click();

    currentStage = "submitting and validating an issued-token payment";
    await page.locator('[data-action="openCommandModal"][data-value="send"]').click();
    const sendAssetOptions = await page.locator("#sendAssetSelect option").evaluateAll(options =>
      options.map(option => ({ value: option.value, label: option.textContent.trim() })),
    );
    const tokenOption = sendAssetOptions.find(option => option.label.startsWith("TST —"));
    assert.ok(tokenOption, `Expected a positive TST trust-line balance; available assets: ${sendAssetOptions.map(option => option.label.split(" —")[0]).join(", ")}`);
    await page.locator("#sendAssetSelect").selectOption(tokenOption.value);
    await page.locator("#sendDestInput").fill(receiver.classicAddress);
    await page.locator("#sendNextBtn1").click();
    await page.locator("#sendAmountInput").fill("0.5");
    await page.locator('[data-action="goToSendStep3"]').click();
    await page.waitForFunction(() =>
      document.getElementById("sendReviewStatus").textContent.includes("Prepared, unsigned transaction"),
      { timeout: 60000 },
    );
    assert.match(await page.locator("#summarySendAsset").innerText(), /TST.*Issuer/);
    await page.locator("#sendConfirmCheckbox").check();
    await page.locator("#sendConfirmButton").click();
    await page.waitForFunction(() =>
      document.getElementById("sendReviewStatus").textContent.includes("Validated success"),
      { timeout: 90000 },
    );
    await page.waitForFunction(() =>
      !document.getElementById("syncSpinner").classList.contains("animate-spin"),
      { timeout: 60000 },
    );
    console.log("PASS: issued-token payment submitted from the browser and validated on Testnet");
    await page.locator('#modalSend [data-action="closeAllModals"]').click();

    currentStage = "quoting and validating a fill-or-kill DEX swap";
    await page.locator('[data-action="openCommandModal"][data-value="swap"]').click();
    await page.locator("#swapFromAssetSelect").selectOption("0");
    const swapTokenOptions = await page.locator("#swapToAssetSelect option").evaluateAll(options =>
      options.map(option => ({ value: option.value, label: option.textContent.trim() })),
    );
    const swapTokenOption = swapTokenOptions.find(option => option.label.startsWith("TST —"));
    assert.ok(swapTokenOption, "Expected TST to be listed as a swap output asset");
    await page.locator("#swapToAssetSelect").selectOption(swapTokenOption.value);
    await page.locator("#swapAmountInput").fill("0.1");
    await page.locator('[data-action="prepareSwapQuote"]').click();
    await page.waitForFunction(() =>
      !document.getElementById("swapQuotePanel").classList.contains("hidden"),
      { timeout: 60000 },
    );
    assert.match(await page.locator("#swapEstimatedOutput").innerText(), /TST/);
    await page.locator("#swapConfirmCheckbox").check();
    await page.locator("#swapConfirmButton").click();
    await page.waitForFunction(() =>
      document.getElementById("swapStatus").textContent.includes("Validated success"),
      { timeout: 90000 },
    );
    console.log("PASS: fill-or-kill XRPL DEX swap submitted from the browser and validated on Testnet");

    currentStage = "checking browser network payloads for the wallet seed";
    const disposableSeeds = [sender.seed, receiver.seed, inactiveReceiver.seed, issuer.seed];
    assert.equal(
      [...requestBodies, ...socketFrames].some(payload => disposableSeeds.some(seed => payload.includes(seed))),
      false,
      "Any disposable wallet seed must not appear in observed request bodies or WebSocket frames",
    );
    console.log("PASS: generated wallet seed was not present in observed network payloads");
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (client) {
      try { await client.disconnect(); } catch (error) {}
    }
    if (serverChild && serverChild.exitCode === null) serverChild.kill("SIGTERM");
  }
}

run().catch(error => {
  const message = String(error.message || "")
    .replace(/\b[sr][A-Za-z0-9]{25,45}\b/g, "[redacted]")
    .slice(0, 240);
  console.error(`FAIL: Testnet integration stopped during ${currentStage} (${error.name || "Error"}${message ? `: ${message}` : ""}). No Mainnet transaction was attempted.`);
  process.exitCode = 1;
});
