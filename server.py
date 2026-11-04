"""Serve the imported wallet without exposing other workspace files."""

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
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.end_headers()
        if include_body:
            self.wfile.write(body)


if __name__ == "__main__":
    print("AQUA Wallet v3.4 listening on 0.0.0.0:5000", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5000), WalletHandler).serve_forever()
