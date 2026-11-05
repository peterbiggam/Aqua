---
name: XRPL browser transport
description: Browser-side XRPL JSON-RPC transport and endpoint/CSP constraints.
---

Use XRPL WebSocket clients for browser-side JSON-RPC; do not fetch public XRPL HTTP endpoints directly from the app.

**Why:** The public Testnet HTTP RPC rejected browser preflight without CORS headers, while WebSocket requests worked against the same service.

**How to apply:** Use WebSocket clients for network status, validated ledger queries, account and trust-line checks, quotes, and submissions. Keep only required WSS hosts in the content security policy and verify the browser's actual connection path.
