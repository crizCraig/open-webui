from starlette.responses import Response

from open_webui.utils.payment_switch import (
    MAX_LOGIN_HINT_LENGTH,
    clean_login_hint,
    delete_session_cookie,
    login_hint_kwargs,
)


def test_login_hint_accepts_one_plausible_email():
    assert clean_login_hint("craig.quiter@gmail.com") == "craig.quiter@gmail.com"
    assert clean_login_hint("  a@b.co ") == "a@b.co"
    assert login_hint_kwargs("a@b.co") == {"login_hint": "a@b.co", "prompt": "select_account"}


def test_login_hint_rejects_everything_else():
    long = "a" * MAX_LOGIN_HINT_LENGTH + "@b.co"
    for bad in (None, "", "nope", "a@b", "a b@c.d", "a@b.co\nx", "a@b@c.d", long, "a@b.co\u202e", "a\u200b@b.co"):
        assert clean_login_hint(bad) is None, bad
        assert login_hint_kwargs(bad) == {}


def test_sign_out_expires_the_domain_cookie_too():
    response = Response()
    delete_session_cookie(response, ".polychat.co")
    cookies = response.headers.getlist("set-cookie")
    assert len(cookies) == 2
    assert all(c.startswith('token=""') and "Max-Age=0" in c for c in cookies)
    assert sum("Domain=.polychat.co" in c for c in cookies) == 1


def test_sign_out_without_a_domain_expires_the_host_cookie_only():
    response = Response()
    delete_session_cookie(response, None)
    cookies = response.headers.getlist("set-cookie")
    assert len(cookies) == 1 and "Domain=" not in cookies[0]
