#!/usr/bin/env bash
set -euo pipefail

test -f server.py
test -f aqua_wallet_v3_4_application.html

python3 - <<'PY'
import ast
from pathlib import Path

ast.parse(Path("server.py").read_text(), filename="server.py")
html = Path("aqua_wallet_v3_4_application.html").read_text()
if "<title>AQUA WALLET // XRPL Universal Command Center v3.4 MOBILE</title>" not in html:
    raise SystemExit("Expected AQUA Wallet v3.4 HTML entry point was not found")
PY

echo "Post-merge setup checks passed."
