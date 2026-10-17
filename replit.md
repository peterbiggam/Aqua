# AQUA Wallet on Replit

## Run

Use the **Start application** workflow (Run button), or run `python3 server.py`.
The server listens on `0.0.0.0:5000` and serves the original
`aqua_wallet_v3_4_application.html` at `/`, `/aqua.html`, and its original filename.
Other workspace files are not publicly served.

The application remains a standalone HTML/CSS/JavaScript wallet. Python's standard
library only supplies static hosting; there are no Python packages to install,
no backend database, and no server secrets required. The older v3.0 and v3.1
files are retained unchanged.

## Browser dependencies and storage

Internet access is needed for the existing CDN-hosted XRPL, QR-code, icon, CSS,
and font dependencies and for XRPL network requests. The encrypted vault and
other state remain in browser local storage, specific to the browser and origin.
Changing preview/published domains does not transfer that data. Export an
encrypted `.aqua` backup before changing origins or clearing browser storage.
Never put wallet seeds or vault files in this repository or server configuration.

## Verification and limitations

Setup verification covers HTTP serving and the initial wallet screen, not a
security audit, real-money transactions, or full feature validation.
The imported v3.4 code includes a local simulated ledger and can fall back to
“Enclave Mode” after network failures. A successful local action is therefore
not proof of an on-chain transaction. Use test wallets only until transaction
handling and security have been independently reviewed.
