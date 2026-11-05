const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "aqua_wallet_v3_4_application.html"), "utf8");
const readme = fs.readFileSync(path.join(root, "readme.md"), "utf8");
const server = fs.readFileSync(path.join(root, "server.py"), "utf8");
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const version = html.match(/<meta name="app-version" content="([^"]+)"/)?.[1];
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];

assert.equal(version, "3.4.1", "The app version must be updated in the HTML source");
assert.ok(readme.includes(`Current version: v${version}.`), "README version must match the app");
assert.ok(html.includes(`id="headerVersionLabel"`) && html.includes(`>v${version}</span>`));
assert.ok(html.includes(`id="appVersionLabel">AQUA WALLET v${version}</span>`));
assert.ok(script, "Expected exactly one inline application script");
assert.ok(policy, "Standalone HTML must include a restrictive CSP");
assert.doesNotMatch(html, /\s(?:on(?:click|input|change))\s*=/i, "Inline event handlers are forbidden");

const scriptDirective = policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] || "";
assert.ok(scriptDirective.includes(`'sha256-${crypto.createHash("sha256").update(script).digest("base64")}'`),
  "CSP must authorize only the current inline application script hash");
assert.doesNotMatch(scriptDirective, /unsafe-inline|unsafe-eval/i);
assert.match(policy, /script-src-attr 'none'/);
assert.match(policy, /wss:\/\/s\.altnet\.rippletest\.net:51233/);
assert.match(policy, /wss:\/\/xrplcluster\.com/);
assert.match(server, /Content-Security-Policy/);

assert.match(script, /CURRENT_KDF_ITERATIONS\s*=\s*600000/);
assert.match(script, /document\.title\s*=\s*`AQUA WALLET \/\/ XRPL Universal Command Center v\$\{APP_VERSION\}`/);
assert.match(script, /LEGACY_KDF_ITERATIONS\s*=\s*100000/);
assert.match(script, /validateAquaBackupPayload/);
assert.match(script, /activeWallet\.sign\(/);
assert.match(script, /submitAndWait\(signed\.tx_blob\)/);
assert.match(script, /result\?\.validated !== true/);
assert.match(script, /0x00040000 \| 0x00080000/);
assert.doesNotMatch(script, /Wallet\.fromEntropy\(['"]1234567890abcdef/);
assert.equal(readme.toLowerCase().includes(["re", "plit"].join("")), false, "Public README must stay platform-neutral");
for (const pkg of Object.values(packageLock.packages || {})) {
  if (pkg.resolved) assert.ok(pkg.resolved.startsWith("https://registry.npmjs.org/"), "Lockfile packages must use public npm URLs");
}

console.log("PASS: release version, CSP, signing, backup, and public README checks");
