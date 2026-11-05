# AQUA WALLET // XRPL Universal Command Center v3.4.1

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL.js](https://img.shields.io/badge/XRPL.js-v3.1.0-cyan.svg)](https://xrpl.org)
[![Security: Zero-Server AES-256-GCM](https://img.shields.io/badge/Security-16%2B%20Char%20Passphrase%20%2B%20AES--256-emerald.svg)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

**AQUA WALLET** is a client-side XRPL wallet for managing an encrypted local vault, reading validated account balances, sending XRP and trust-line tokens, and trading through XRPL decentralized-exchange liquidity. The app signs transactions in the browser and submits only after the user reviews and confirms the transaction. Funding, payment streams, and DID entries remain local simulations.

Repository: [https://github.com/peterbiggam/Aqua](https://github.com/peterbiggam/Aqua)

---

## ✨ Key Features

- **Mobile-First Responsive Design:** Fully optimized touch targets, fluid spacing, and responsive modals designed specifically for mobile browsers (Brave, Safari, Chrome).
- **Portable `.aqua` Vault Backups:** Export and import encrypted vault files in the browser.
- **Validated XRPL Reads:** View XRP and issued-token balances from validated ledger responses.
- **XRP and Token Payments:** Review the destination, amount, issuer, destination tag, fee, network, and expiry before local signing. Token sends check the recipient trust line, authorization, capacity, and issuer transfer rate.
- **XRPL DEX / AMM Swaps:** Compare available order-book and AMM quotes, show estimated price impact, set slippage from 0.1% to 5%, and use a fill-or-kill offer with a minimum output.
- **Explicit Network Selection:** Switch between XRPL Testnet and Mainnet and check endpoint status before unlocking a wallet.
- **Clearly Labeled Simulations:** Funding, payment streams, and DID entries are local examples only and never submit transactions.
- **Local Address Book:** Save human-readable labels for XRPL addresses in this browser.
- **Client-Side Security:** Private keys are used for local signing and are not sent to the XRPL endpoint. Vault v2 uses **PBKDF2-HMAC-SHA-256 (600,000 iterations) + AES-256-GCM** and a 16+ character passphrase. Older 100,000-iteration backups remain restorable and are upgraded after successful unlock.

---

## 🛡️ Security Architecture

Aqua Wallet stores its encrypted vault in browser storage:
1. **Local key custody:** The browser signs transactions. Network requests carry XRPL account and transaction data; they must not contain the wallet seed.
2. **Review before signing:** Payments and swaps display the selected network and transaction details. Swap offers are fill-or-kill and enforce a minimum output; the quote is indicative and can change before validation.
3. **Validated outcomes:** A transaction is reported as successful only after the endpoint returns a validated result with `tesSUCCESS`. If the response is uncertain, check the transaction hash before retrying.
4. **Vault integrity:** New backups declare their KDF and cipher versions. Imports are structurally checked before replacing the stored backup, and the decrypted wallet address must match the backup address.
5. **Browser hardening:** Pinned third-party scripts use Subresource Integrity, the app has a restrictive Content Security Policy, and stored/user-provided labels are escaped before HTML rendering.

Use a separate, disposable wallet secret on Testnet; never import or reuse a Mainnet secret there. XRPL endpoints are third-party network services, and this software has not received a public third-party security audit. Review the code and transaction details before using real funds.

## Browser backup regression test

Run `npm install` once, then `npm test` to check version/CSP policy and exercise
disposable vault creation, manual locking, correct and incorrect passphrases,
encrypted `.aqua` export/import, damaged-backup rejection, legacy-backup upgrade,
and restore at another browser origin. No real transaction is submitted by this
test. Run `npm run test:testnet` separately to exercise disposable Testnet
payments and a fill-or-kill DEX swap; it may use faucet funds. No test submits a
Mainnet transaction.

The browser test depends on Chromium, the static CDN dependencies, and Web
Crypto. The Testnet integration test needs network access and the Testnet faucet.
A passing test run is a regression check, not a substitute for a public audit or
a guarantee that wallets are safe for real funds.

---

## 🚀 Quick Start

The wallet is a standalone HTML app and needs no build step.

1. **Open the app:** Serve `aqua_wallet_v3_4_application.html` over HTTPS in a modern browser.
2. **Load a vault:** Import an encrypted `.aqua` backup or create a new vault.

The existing XRPL and display libraries are loaded from public CDNs, so an
internet connection is required.

## 📦 Versions and release notes

**Current version: v3.4.1.** The app version is declared in the HTML and displayed
in the page header and footer. Update that value and this README together for
each push to `main`; `npm test` rejects mismatched versions. GitHub release
creation remains a separate manual step on the
[GitHub Releases page](https://github.com/peterbiggam/Aqua/releases).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
