---
name: Browser wallet security
description: Security direction for the wallet's current browser-based architecture.
---

The user chose to harden the existing browser wallet rather than replace it with a native app.

**Why:** the user asked for a safer implementation while keeping the current browser-app direction.

**How to apply:** Prefer incremental browser security improvements such as pinned dependencies with integrity checks and safe handling of persisted or user-provided values. Do not claim that changing programming languages alone makes the wallet secure.
