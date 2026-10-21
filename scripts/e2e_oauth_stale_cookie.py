"""Headless end-to-end: a browser with stale sign-in cookies can still sign in.

Runs a local Open WebUI backend (this checkout's backend/ and build/) behind a fake OIDC
provider, with production's cookie settings (WEBUI_SESSION_COOKIE_DOMAIN on a parent
domain; Secure off because it's plain http) on the host polychat.test, which Chromium maps
to 127.0.0.1. Then, in one browser profile:

1. sign in once (records that callback URL), sign out;
2. plant stale cookies in both scopes: oui-session and token, host-only and domain;
3. reload the used callback URL: expect /auth with "Sign-in expired", no 500, and the
   stale cookies gone;
4. click "Continue with SSO": expect to land signed in;
5. replay that (now used) callback: expect to stay signed in (/auth#token= then /).

Usage (needs Playwright's Chromium; the backend runs in the open-webui-env conda env):
    python scripts/e2e_oauth_stale_cookie.py [--backend-python PATH] [--keep]
Exit status 0 when every step passed.
"""

import argparse
import os
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
IDP_PORT = 9137
APP_PORT = 8137
HOST = "polychat.test"
COOKIE_DOMAIN = f".{HOST}"
APP = f"http://{HOST}:{APP_PORT}"
IDP = f"http://127.0.0.1:{IDP_PORT}"
DEFAULT_BACKEND_PYTHON = Path.home() / "miniconda3/envs/open-webui-env/bin/python"
STALE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN0YWxlIn0.stale-signature"


def main() -> int:
    args = parse_args()
    data_dir = Path(tempfile.mkdtemp(prefix="owui-e2e-", dir=os.environ.get("E2E_TMP")))
    start_fake_idp()
    backend = start_backend(Path(args.backend_python), data_dir)
    try:
        wait_until_up(f"http://127.0.0.1:{APP_PORT}/health", backend)
        return run_browser_checks()
    finally:
        backend.terminate()
        backend.wait(timeout=30)
        print(f"backend log: {data_dir / 'backend.log'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--backend-python", default=str(DEFAULT_BACKEND_PYTHON))
    return parser.parse_args()


def run_browser_checks() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=[f"--host-resolver-rules=MAP {HOST} 127.0.0.1"], headless=True
        )
        page = browser.new_context().new_page()
        callbacks: list[str] = []
        page.on("request", lambda r: _record_callback(r.url, callbacks))
        results = [
            check("first sign-in", lambda: sign_in(page, via_button=False)),
            check("sign out", lambda: sign_out(page)),
        ]
        used_callback = callbacks[-1]
        plant_stale_cookies(page)
        results.append(check("used callback with stale cookies", lambda: expired(page, used_callback)))
        results.append(check("stale cookies cleared", lambda: no_stale_cookies(page)))
        results.append(check("retry signs in", lambda: sign_in(page)))
        results.append(check("duplicate callback stays signed in", lambda: goes_home(page, callbacks[-1])))
        browser.close()
    print("PASS" if all(results) else "FAIL")
    return 0 if all(results) else 1


def check(name: str, step) -> bool:
    try:
        step()
    except Exception as e:  # noqa: BLE001 - every failure is reported, then the run fails
        print(f"FAIL {name}: {e}")
        return False
    print(f"ok   {name}")
    return True


def sign_in(page, via_button: bool = True) -> None:
    if via_button:
        page.goto(f"{APP}/auth")
        page.get_by_text("Continue with SSO").click()
    else:  # no users yet: /auth shows the onboarding overlay over the button
        page.goto(f"{APP}/oauth/oidc/login")
    page.wait_for_function("() => !!localStorage.token && location.pathname === '/'", timeout=20000)


def sign_out(page) -> None:
    page.evaluate("async () => { await fetch('/api/v1/auths/signout'); localStorage.clear(); }")


def plant_stale_cookies(page) -> None:
    stale_session = "eyJfc3RhdGVfb2lkY19vbGQiOiB7fX0=.stale.signature"
    page.context.add_cookies(
        [
            {"name": "oui-session", "value": stale_session, "url": APP},
            {"name": "oui-session", "value": stale_session, "domain": COOKIE_DOMAIN, "path": "/"},
            {"name": "token", "value": STALE_TOKEN, "url": APP},
            {"name": "token", "value": STALE_TOKEN, "domain": COOKIE_DOMAIN, "path": "/"},
        ]
    )


def expired(page, callback_url: str) -> None:
    response = page.goto(callback_url)
    page.wait_for_url(f"{APP}/auth**", timeout=20000)
    toast = page.get_by_text("Sign-in expired, please try again.")
    toast.wait_for(timeout=10000)
    assert "error=" not in page.url, page.url
    statuses = [r.status for r in _redirect_chain(response)]
    assert 500 not in statuses, statuses


def no_stale_cookies(page) -> None:
    names = [(c["name"], c["domain"]) for c in page.context.cookies(APP)]
    left = [n for n in names if n[0] in ("oui-session", "token")]
    assert not left, left


def goes_home(page, callback_url: str) -> None:
    page.goto(callback_url)
    page.wait_for_url(f"{APP}/", timeout=20000)
    page.wait_for_function("() => !!localStorage.token", timeout=10000)


def _redirect_chain(response) -> list:
    chain, request = [], response.request if response else None
    while request is not None:
        resp = request.response()
        if resp is not None:
            chain.append(resp)
        request = request.redirected_from
    return chain


def _record_callback(url: str, callbacks: list[str]) -> None:
    if "/oauth/oidc/callback" in url:
        callbacks.append(url)


def start_backend(python: Path, data_dir: Path) -> subprocess.Popen:
    env = {**os.environ, **backend_env(data_dir)}
    log = open(data_dir / "backend.log", "w")
    command = [str(python), "-m", "uvicorn", "open_webui.main:app", "--port", str(APP_PORT)]
    command += ["--host", "127.0.0.1", "--forwarded-allow-ips", "*"]
    return subprocess.Popen(command, cwd=ROOT / "backend", env=env, stdout=log, stderr=log)


def backend_env(data_dir: Path) -> dict[str, str]:
    return {
        "DATA_DIR": str(data_dir),
        "FRONTEND_BUILD_DIR": str(ROOT / "build"),
        "WEBUI_SECRET_KEY": secrets.token_hex(16),
        "WEBUI_SESSION_COOKIE_DOMAIN": COOKIE_DOMAIN,
        "WEBUI_SESSION_COOKIE_SECURE": "false",
        "ENABLE_OAUTH_SIGNUP": "true",
        "OAUTH_CLIENT_ID": "e2e-client",
        "OAUTH_CLIENT_SECRET": "e2e-secret",
        "OPENID_PROVIDER_URL": f"{IDP}/.well-known/openid-configuration",
        "OPENID_REDIRECT_URI": f"{APP}/oauth/oidc/callback",
        "OFFLINE_MODE": "true",
        "ENABLE_OLLAMA_API": "false",
        "ENABLE_OPENAI_API": "false",
        "RAG_EMBEDDING_ENGINE": "openai",
    }


def wait_until_up(url: str, backend: subprocess.Popen, timeout: float = 180) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if backend.poll() is not None:
            raise RuntimeError(f"backend exited with {backend.returncode}")
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except OSError:
            time.sleep(1)
    raise TimeoutError(url)


def start_fake_idp() -> None:
    config = uvicorn.Config(fake_idp(), host="127.0.0.1", port=IDP_PORT, log_level="warning")
    threading.Thread(target=uvicorn.Server(config).run, daemon=True).start()


def fake_idp() -> FastAPI:
    """An OIDC provider that approves every request at once (no id_token; userinfo)."""
    idp = FastAPI()

    @idp.get("/.well-known/openid-configuration")
    def metadata():
        return {
            "issuer": IDP,
            "authorization_endpoint": f"{IDP}/authorize",
            "token_endpoint": f"{IDP}/token",
            "userinfo_endpoint": f"{IDP}/userinfo",
            "jwks_uri": f"{IDP}/jwks",
        }

    @idp.get("/authorize")
    def authorize(request: Request):
        query = {"state": request.query_params["state"], "code": secrets.token_urlsafe(16)}
        return RedirectResponse(f"{request.query_params['redirect_uri']}?{urlencode(query)}")

    @idp.post("/token")
    def token():
        return {"access_token": secrets.token_urlsafe(16), "token_type": "Bearer"}

    @idp.get("/userinfo")
    def userinfo():
        return {"sub": "e2e-sub-1", "email": "stale-cookie@polychat.test", "name": "Stale Cookie"}

    return idp


if __name__ == "__main__":
    sys.exit(main())
