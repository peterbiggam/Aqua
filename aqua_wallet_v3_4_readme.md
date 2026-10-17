# AQUA WALLET // XRPL Universal Command Center v3.4 MOBILE

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL.js](https://img.shields.io/badge/XRPL.js-v3.1.0-cyan.svg)](https://xrpl.org)
[![Security: Zero-Server AES-256-GCM](https://img.shields.io/badge/Security-16%2B%20Char%20Passphrase%20%2B%20AES--256-emerald.svg)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

**AQUA WALLET** is a client-side, zero-server cryptocurrency wallet built for the XRP Ledger (XRPL). Optimized for both desktop and mobile browsers, Aqua Wallet allows users to manage XRP, trustline assets, cross-chain atomic swaps, payment streams, decentralized identity (DID) credentials, and human-readable BNS handles from a single self-contained file (`aqua.html`).

Repository: [https://github.com/peterbiggam/Aqua](https://github.com/peterbiggam/Aqua)

---

## ✨ Key Features (v3.4 TRENDING & MOBILE)

- **Mobile-First Responsive Design:** Fully optimized touch targets, fluid spacing, and responsive modals designed specifically for mobile browsers (Brave, Safari, Chrome).
- **Portable `.aqua` Vault Backups:** Export and import your encrypted vault files directly on your mobile device. Open `aqua.html`, load your `.aqua` file, enter your master passphrase, and command your funds anywhere.
- **Cross-Chain Atomic Swaps:** Execute trustless, hash-time locked contract (HTLC) swaps directly between XRP and assets on Bitcoin, Ethereum, or Solana networks.
- **Subscription & Recurring Streams:** Set up automated monthly payment streams and escrow channels for payroll or creator support.
- **Decentralized Identity (DID) Vault:** Manage verifiable credentials and self-sovereign identity badges on-chain.
- **BNS Human-Readable Names:** Map custom human-readable handles (e.g., `alice.xrp`) directly to XRPL addresses using the built-in registrar.
- **Client-Side Security:** Private keys never leave your device. Encrypted in your browser using **PBKDF2 (100,000 iterations) + AES-256-GCM**, secured by a 16+ character master passphrase.

---

## 🛡️ Security Architecture

Aqua Wallet operates on a trustless client-side architecture:
1. **No Backend Database:** Zero private keys, IP addresses, or personal data are stored on external servers. All state is held locally in browser storage or encrypted `.aqua` backup files.
2. **Local Cryptographic Enclave:** All signing operations happen locally in memory using official `xrpl.js` bindings.
3. **Auto-Lock / Vault Wipe:** Manual and automatic vault locks clear sensitive memory buffers instantly.

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