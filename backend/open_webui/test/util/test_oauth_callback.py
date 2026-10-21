"""OAuth callback failures redirect to sign-in instead of a 500 (utils/oauth_callback.py).

The app below is the real OAuthManager behind Starlette's SessionMiddleware, with a test
OIDC client registered in place of Google; nothing here touches the network.
"""

import logging
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from authlib.integrations.base_client.errors import MismatchingStateError, OAuthError
from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient
from starlette.middleware.sessions import SessionMiddleware

import open_webui.utils.oauth as oauth_module
import open_webui.utils.oauth_callback as oauth_callback
from open_webui.utils.auth import create_token
from open_webui.utils.oauth_callback import (
    EMAIL_TAKEN,
    OAUTH_SESSION_COOKIE,
    SIGNIN_CANCELLED,
    SIGNIN_EXPIRED,
    auth_error_code,
    token_error_reason,
)

PROVIDER = "testoidc"
DOMAIN = ".polychat.test"
BASE = "http://polychat.test"
SECRET = "test-session-secret"


class TokenExchangeReached(Exception):
    """Raised by the fake token endpoint: the callback's state was accepted."""


@pytest.fixture
def app(monkeypatch):
    provider = {"redirect_uri": None, "register": _register_test_client}
    monkeypatch.setattr(oauth_module, "OAUTH_PROVIDERS", {PROVIDER: provider})
    monkeypatch.setattr(oauth_callback, "WEBUI_SESSION_COOKIE_DOMAIN", DOMAIN)
    manager = oauth_module.OAuthManager(None)
    api = FastAPI()
    api.add_middleware(
        SessionMiddleware, secret_key=SECRET, session_cookie="oui-session"
    )

    @api.get("/oauth/{provider}/login")
    async def login(provider: str, request: Request):
        return await manager.handle_login(request, provider)

    @api.get("/oauth/{provider}/callback", name="oauth_callback")
    async def callback(provider: str, request: Request, response: Response):
        return await manager.handle_callback(request, provider, response)

    api.state.manager = manager
    return api


def _register_test_client(oauth) -> None:
    oauth.register(
        name=PROVIDER,
        client_id="client",
        client_secret="secret",
        authorize_url="https://idp.test/authorize",
        access_token_url="https://idp.test/token",
        client_kwargs={"scope": "openid email profile"},
    )


@pytest.fixture
def client(app):
    return TestClient(app, base_url=BASE, follow_redirects=False)


def _set_cookies(response) -> list[str]:
    return response.headers.get_list("set-cookie")


def _expired(cookies: list[str], name: str) -> list[str]:
    return [c for c in cookies if c.startswith(f"{name}=") and _is_expiry(c)]


def _is_expiry(cookie: str) -> bool:
    return "Max-Age=0" in cookie or "expires=Thu, 01 Jan 1970" in cookie


def _login_state(client) -> str:
    response = client.get(f"/oauth/{PROVIDER}/login")
    assert response.status_code == 302
    return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


def test_token_error_reason_is_the_oauth_code_or_the_class_name():
    assert token_error_reason(MismatchingStateError()) == "mismatching_state"
    assert token_error_reason(OAuthError(error="access_denied")) == "access_denied"
    assert token_error_reason(OAuthError(error="has spaces <b>")) == "OAuthError"
    assert token_error_reason(ValueError("secret detail")) == "ValueError"


def test_auth_error_code_says_cancelled_only_for_access_denied():
    assert auth_error_code("access_denied") == SIGNIN_CANCELLED
    assert auth_error_code("mismatching_state") == SIGNIN_EXPIRED
    assert auth_error_code("ValueError") == SIGNIN_EXPIRED


def test_unknown_state_redirects_to_sign_in_and_clears_both_scopes(client, caplog):
    caplog.set_level(logging.WARNING)
    client.cookies.set(OAUTH_SESSION_COOKIE, "stale-from-another-key")
    response = client.get(f"/oauth/{PROVIDER}/callback?state=gone123&code=c")
    assert response.status_code == 302
    assert response.headers["location"] == f"{BASE}/auth?error={SIGNIN_EXPIRED}"
    cookies = _set_cookies(response)
    for name in (OAUTH_SESSION_COOKIE, "token"):
        expired = _expired(cookies, name)
        assert sum(f"Domain={DOMAIN}" in c for c in expired) == 1, (name, cookies)
        assert any("Domain=" not in c for c in expired), (name, cookies)
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("mismatching_state" in m for m in warnings), warnings
    assert not any("gone123" in m for m in warnings), warnings


def test_provider_refusal_says_cancelled(client):
    response = client.get(f"/oauth/{PROVIDER}/callback?error=access_denied&state=s")
    assert response.headers["location"] == f"{BASE}/auth?error={SIGNIN_CANCELLED}"


def test_callback_without_parameters_is_not_a_500(client):
    response = client.get(f"/oauth/{PROVIDER}/callback")
    assert response.status_code == 302
    assert response.headers["location"] == f"{BASE}/auth?error={SIGNIN_EXPIRED}"


def test_duplicate_callback_of_a_signed_in_browser_adopts_its_session(
    client, monkeypatch
):
    monkeypatch.setattr(
        oauth_callback.Users, "get_user_by_id", lambda i: SimpleNamespace(id=i)
    )
    token = create_token(data={"id": "user-1"})
    client.cookies.set("token", token)
    response = client.get(f"/oauth/{PROVIDER}/callback?state=used&code=c")
    assert response.status_code == 302
    assert response.headers["location"] == f"{BASE}/auth#token={token}"
    assert not _expired(_set_cookies(response), "token")


def test_a_pending_state_is_not_written_back_after_the_deletes(client):
    _login_state(client)  # the session now holds a live state
    response = client.get(f"/oauth/{PROVIDER}/callback?state=another&code=c")
    sessions = [
        c for c in _set_cookies(response) if c.startswith(f"{OAUTH_SESSION_COOKIE}=")
    ]
    assert sessions and all(_is_expiry(c) for c in sessions), sessions


def test_token_of_a_deleted_user_is_not_signed_in(client, monkeypatch):
    monkeypatch.setattr(oauth_callback.Users, "get_user_by_id", lambda i: None)
    client.cookies.set("token", create_token(data={"id": "gone"}))
    response = client.get(f"/oauth/{PROVIDER}/callback?state=used&code=c")
    assert response.headers["location"] == f"{BASE}/auth?error={SIGNIN_EXPIRED}"


def test_retry_after_a_failure_gets_past_the_state_check(app, client, monkeypatch):
    calls = []

    async def fake_fetch(**params):
        calls.append(params)
        raise TokenExchangeReached()

    oauth_client = app.state.manager.get_client(PROVIDER)
    monkeypatch.setattr(
        type(oauth_client), "fetch_access_token", lambda self, **p: fake_fetch(**p)
    )
    client.cookies.set(OAUTH_SESSION_COOKIE, "stale-from-another-key")
    failed = client.get(f"/oauth/{PROVIDER}/callback?state=old&code=c")
    assert failed.headers["location"].endswith(f"error={SIGNIN_EXPIRED}")
    state = _login_state(client)
    client.get(f"/oauth/{PROVIDER}/callback?state={state}&code=fresh")
    assert [c["code"] for c in calls] == ["fresh"]


def test_reload_of_a_signed_in_callback_adopts_the_session(app, client, monkeypatch):
    """A real success, then the same callback again (reload, Back, duplicate request)."""
    oauth_client = app.state.manager.get_client(PROVIDER)
    user = SimpleNamespace(id="u1", role="user", email="a@b.co", profile_image_url="")
    userinfo = {"sub": "s1", "email": "a@b.co", "name": "A"}

    async def fake_fetch(self, **params):
        return {"access_token": "at", "token_type": "Bearer", "userinfo": userinfo}

    monkeypatch.setattr(type(oauth_client), "fetch_access_token", fake_fetch)
    monkeypatch.setattr(oauth_module.Users, "get_user_by_oauth_sub", lambda sub: user)
    monkeypatch.setattr(oauth_callback.Users, "get_user_by_id", lambda i: user)
    monkeypatch.setattr(app.state.manager, "get_user_role", lambda u, d: "user")
    state = _login_state(client)
    first = client.get(f"/oauth/{PROVIDER}/callback?state={state}&code=first")
    assert first.status_code == 307 and "/auth#token=" in first.headers["location"]
    again = client.get(f"/oauth/{PROVIDER}/callback?state={state}&code=first")
    assert again.status_code == 302
    assert again.headers["location"].startswith(f"{BASE}/auth#token=")
    client.cookies.clear()
    stranger = client.get(f"/oauth/{PROVIDER}/callback?state={state}&code=first")
    assert stranger.headers["location"] == f"{BASE}/auth?error={SIGNIN_EXPIRED}"


def test_email_taken_redirects_with_its_own_code():
    request = SimpleNamespace(base_url=f"{BASE}/", session={"_state_x": {}}, cookies={})
    redirect = oauth_callback.signin_error_redirect(request, EMAIL_TAKEN)
    assert redirect.status_code == 302
    assert redirect.headers["location"] == f"{BASE}/auth?error={EMAIL_TAKEN}"
    assert request.session == {}
