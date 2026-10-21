"""Polychat: what an OAuth callback does when the sign-in can't complete.

authlib keeps each sign-in's ``state`` in Starlette's ``oui-session`` cookie and drops it
when a callback uses it. So a callback whose state is gone fails with
``mismatching_state``: a reload of the callback URL, Back to Google's account chooser
after a callback already ran (Google sends the same state with a new code), a duplicate
request, or two sign-ins racing in two tabs (the cookie session is last-write-wins).
Google sends ``access_denied`` when the user cancels. All of these used to end in an
UnboundLocalError, an HTTP 500 page the user could only reload into again.

Now a browser that already holds a valid ``token`` cookie goes to ``/`` (the first of two
callbacks signed it in); any other gets its OAuth session and token cookies expired, host-
only and on ``WEBUI_SESSION_COOKIE_DOMAIN``, and lands on ``/auth?error=<code>``, where the
sign-in page says what happened and a retry starts a fresh state.
"""

import logging
import re
from typing import Optional

from starlette.requests import Request
from starlette.responses import RedirectResponse

from open_webui.env import (
    SRC_LOG_LEVELS,
    WEBUI_SESSION_COOKIE_DOMAIN,
    WEBUI_SESSION_COOKIE_SAME_SITE,
    WEBUI_SESSION_COOKIE_SECURE,
)
from open_webui.models.users import Users
from open_webui.utils.auth import decode_token
from open_webui.utils.payment_switch import SESSION_COOKIE, delete_session_cookie

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["OAUTH"])

OAUTH_SESSION_COOKIE = "oui-session"
# The /auth?error= codes; src/lib/utils/oauthError.ts has the messages.
SIGNIN_EXPIRED = "oauth_expired"
SIGNIN_CANCELLED = "oauth_cancelled"
EMAIL_TAKEN = "email_taken"
_ERROR_CODE = re.compile(r"^[a-z_]{1,64}$")


def callback_error_response(
    request: Request, provider: str, error: Exception
) -> RedirectResponse:
    """The response to a callback whose token request failed (never a 500)."""
    reason = token_error_reason(error)
    if signed_in_user_id(request):
        log.warning(f"OAuth callback ({provider}) failed: {reason}; already signed in")
        return RedirectResponse(url=str(request.base_url), status_code=302)
    log.warning(f"OAuth callback ({provider}) failed: {reason}")
    return signin_error_redirect(request, auth_error_code(reason))


def signin_error_redirect(request: Request, code: str) -> RedirectResponse:
    """Send the browser to sign-in with ``code``, expiring its OAuth session and token."""
    response = RedirectResponse(
        url=f"{request.base_url}auth?error={code}", status_code=302
    )
    expire_signin_cookies(request, response)
    return response


def token_error_reason(error: Exception) -> str:
    """A log-safe reason: the OAuth error code, else the exception's class name."""
    code = getattr(error, "error", None)
    if isinstance(code, str) and _ERROR_CODE.match(code):
        return code
    return type(error).__name__


def auth_error_code(reason: str) -> str:
    return SIGNIN_CANCELLED if reason == "access_denied" else SIGNIN_EXPIRED


def signed_in_user_id(request: Request) -> Optional[str]:
    """The id of the existing user the request's ``token`` cookie names, if valid."""
    token = request.cookies.get(SESSION_COOKIE)
    data = decode_token(token) if token else None
    user_id = data.get("id") if isinstance(data, dict) else None
    if user_id and Users.get_user_by_id(user_id):
        return user_id
    return None


def expire_signin_cookies(request: Request, response: RedirectResponse) -> None:
    """Expire ``oui-session`` and ``token`` in both scopes, so no stale copy survives."""
    # Emptied, the session middleware expires its own (host-only) cookie instead of
    # writing the leftover states back after this response's deletions.
    request.session.clear()
    domains = (
        [None, WEBUI_SESSION_COOKIE_DOMAIN] if WEBUI_SESSION_COOKIE_DOMAIN else [None]
    )
    for domain in domains:
        response.delete_cookie(
            OAUTH_SESSION_COOKIE,
            path="/",
            domain=domain,
            secure=WEBUI_SESSION_COOKIE_SECURE,
            httponly=True,
            samesite=WEBUI_SESSION_COOKIE_SAME_SITE,
        )
    delete_session_cookie(response, WEBUI_SESSION_COOKIE_DOMAIN)
