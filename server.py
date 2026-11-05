"""Serve the imported wallet without exposing other workspace files."""

import base64
import hashlib
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


WALLET = Path(__file__).resolve().parent / "aqua_wallet_v3_4_application.html"
PUBLIC_PATHS = {"/", "/aqua.html", "/" + WALLET.name}


class WalletHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.serve_wallet(include_body=True)

    def do_HEAD(self):
        self.serve_wallet(include_body=False)

    def serve_wallet(self, include_body):
        path = urlsplit(self.path).path
        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if path not in PUBLIC_PATHS:
            self.send_error(404)
            return
        body = WALLET.read_bytes()
        inline_scripts = re.findall(rb"<script>(.*?)</script>", body, re.DOTALL)
        if len(inline_scripts) != 1:
            self.send_error(500, "Expected exactly one inline application script")
            return
        script_hash = base64.b64encode(hashlib.sha256(inline_scripts[0]).digest()).decode("ascii")
        content_security_policy = (
            "default-src 'self'; "
            f"script-src 'self' https://unpkg.com https://cdnjs.cloudflare.com 'sha256-{script_hash}'; "
            "script-src-attr 'none'; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://unpkg.com; "
            "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; "
            "img-src 'self' data:; "
            "connect-src 'self' wss://s.altnet.rippletest.net:51233 wss://xrplcluster.com; "
            "object-src 'none'; base-uri 'none'; form-action 'none'"
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", content_security_policy)
        self.end_headers()
        if include_body:
            self.wfile.write(body)


if __name__ == "__main__":
    version_match = re.search(r'<meta name="app-version" content="([^"]+)"', WALLET.read_text(encoding="utf-8"))
    version = version_match.group(1) if version_match else "unknown"
    print(f"AQUA Wallet v{version} listening on 0.0.0.0:5000", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5000), WalletHandler).serve_forever()
