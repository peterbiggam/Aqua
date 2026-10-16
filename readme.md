# AQUA WALLET // XRPL Universal Command Center v3.1 PRO

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL.js](https://img.shields.io/badge/XRPL.js-v3.1.0-cyan.svg)](https://xrpl.org)
[![Security: Zero-Server AES-256-GCM](https://img.shields.io/badge/Security-16%2B%20Char%20Passphrase%20%2B%20AES--256-emerald.svg)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

**AQUA WALLET** is an ultra-secure, zero-server, OS-independent Web3 cryptocurrency wallet built exclusively for the XRP Ledger (XRPL). Designed with an authoritative **"Single-Focus Command"** interface that guides users step-by-step, Aqua Wallet allows anyone to manage XRP, **all XRPL tokens**, DEX swaps, NFTs, hardware wallet connections, and multi-signature vaults securely from any browser.

Repository: [https://github.com/peterbiggam/Aqua](https://github.com/peterbiggam/Aqua)

---

## ✨ Key Features (v3.1 PRO)

- **🔐 Military-Grade Client-Side Security:** Your secret keys never leave your device. Keys are encrypted in your browser's WebCrypto enclave using **PBKDF2 (100,000 iterations) + AES-256-GCM**, secured by a user-defined alphanumeric master passphrase (**minimum 16 characters**).
- **📝 Universal Seed Phrase & Secret Seed Import:** Seamlessly import any existing XRP wallet using either your 12/24-word recovery phrase (BIP39/XRPL mnemonic) or standard family seed (`sEd...` / `s...`).
- **🛡️ Encrypted `.aqua` Vault Backups:** Export your encrypted vault data into a portable `.aqua` backup file or securely reveal your raw secret seed anytime.
- **🔌 Hardware Wallet WebHID Pairing:** Connect hardware signing devices (Ledger and Tangem) directly via browser WebHID integration.
- **🌊 Universal Trustline Engine:** Support for holding, receiving, and sending **any XRPL asset**—including stablecoins (RLUSD), meme coins, and custom tokens using 3-character ticker codes or 40-character hex codes.
- **📈 XRPL DEX & NFT Studio:** Place peer-to-peer DEX market/limit swap orders and mint or view digital collectibles on the XRPL NFT gallery grid.
- **⚡ Instant Faucet & Network Switcher:** Switch instantly between **XRPL Mainnet (Live)** and **XRPL Testnet** (with 1-click test XRP faucet funding).
- **🏛️ Multi-Sig & BNS Resolution:** Configure weighted multi-signature co-signer accounts and send funds to human-readable names (`alice.xrp`).

---

## 🛡️ Security Architecture

Aqua Wallet operates on a **Zero-Server Trustless Architecture**:
1. **No Backend Database:** We store zero private keys, zero IP addresses, and zero personal data. All state is held locally in your browser storage or encrypted `.aqua` backup files.
2. **Local Enclave:** Your encrypted seed string never travels over the network. All signing happens locally in memory using official `xrpl.js` cryptographic bindings.
3. **Auto-Lock Enclave:** Features an automated inactivity timer that instantly locks the vault and clears sensitive memory buffers.

---

## 🗺️ Roadmap & Upgrades

As outlined in [roadmap.md](roadmap.md), our expansion phases include:
- Multi-Signature Vault Governance (Multi-Sig Co-Signers)
- Human-Readable Name Resolution (`alice.xrp` BNS / ENS)
- Real-Time Phishing & Scam Guard API Integration
- Biometric Passkey Cloud Sync

---

## 🚀 Quick Start / Local Deployment

Because Aqua Wallet is bundled into a single high-performance HTML file (`index.html`), you can run it anywhere instantly without complex build pipelines.

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/peterbiggam/Aqua.git
   cd Aqua
   ```

2. **Run Locally:**
   Simply open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge, Brave) on desktop or mobile.

   *Alternatively, using Python:*
   ```bash
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080` in your browser.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

```text
MIT License

Copyright (c) 2026 Aqua Wallet Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.