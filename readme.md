# AQUA WALLET // XRPL Universal Command Center v3.4 MOBILE

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL.js](https://img.shields.io/badge/XRPL.js-v3.1.0-cyan.svg)](https://xrpl.org)
[![Security: Zero-Server AES-256-GCM](https://img.shields.io/badge/Security-16%2B%20Char%20Passphrase%20%2B%20AES--256-emerald.svg)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

**AQUA WALLET** is a client-side wallet interface for viewing validated XRPL balances and managing an encrypted local vault. Its send, funding, swap, payment-stream, and DID controls currently run as local simulations only; they do not submit XRPL transactions. The standalone HTML file also includes local address-book and backup features.

Repository: [https://github.com/peterbiggam/Aqua](https://github.com/peterbiggam/Aqua)

---

## ✨ Key Features (v3.4 TRENDING & MOBILE)

- **Mobile-First Responsive Design:** Fully optimized touch targets, fluid spacing, and responsive modals designed specifically for mobile browsers (Brave, Safari, Chrome).
- **Portable `.aqua` Vault Backups:** Export and import encrypted vault files in the browser.
- **Validated XRPL Balance Reads:** View account balances only when the selected XRPL endpoint returns a validated ledger response.
- **Local Action Simulations:** Try example send, funding, swap, payment-stream, and DID flows without submitting transactions to any ledger.
- **Local Address Book:** Save human-readable labels for XRPL addresses in this browser.
- **Client-Side Security:** Private keys never leave your device. Encrypted in your browser using **PBKDF2 (100,000 iterations) + AES-256-GCM**, secured by a 16+ character master passphrase.

---

## 🛡️ Security Architecture

Aqua Wallet stores its encrypted vault in browser storage:
1. **No Backend Database:** Zero private keys, IP addresses, or personal data are stored on external servers. All state is held locally in browser storage or encrypted `.aqua` backup files.
2. **Separate Simulation Mode:** Local simulated balances and actions are explicitly labeled and are not XRPL ledger data.
3. **No Transaction Submission:** The current app does not broadcast or claim successful XRPL transactions.

## Browser backup regression test

Run `npm install` once, then `npm test` to exercise disposable vault creation,
manual locking, correct and incorrect passphrases, encrypted `.aqua` export and
import, and restore/unlock at a different local browser origin. The test uses a
fresh random wallet, blocks XRPL and all non-static external requests, checks
the exported file, and scans observed request URLs and bodies for the generated
seed. It writes temporary backup data outside the repository and removes it
afterward.

The test depends on Chromium, network access to the page's existing static CDN
dependencies, and Web Crypto. Failures should be reported as test failures; a
passing run is a regression check only, not a security audit or proof that
wallets are safe for real funds.

---

## 🚀 Quick Start / Mobile Deployment

Because Aqua Wallet is packaged into a single HTML file (`aqua.html`), it requires no complex build pipelines.

1. **Clone or Download:**
   Save `aqua.html` to your device or repository.
2. **Open in Browser:**
   Open `aqua.html` directly in Brave, Safari, or Chrome on your mobile or desktop device.
3. **Load Vault:**
   Import an existing `.aqua` backup file or forge a new secure vault instantly.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
