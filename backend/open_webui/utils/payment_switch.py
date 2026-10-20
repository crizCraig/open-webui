"""Helpers for Polychat's payment sign-in (see src/lib/utils/paymentSwitch.ts).

* ``clean_login_hint``: the OAuth login route forwards a payment link's account to the
  provider as ``login_hint`` so Google picks that account; only a plausible email passes.
* ``delete_session_cookie``: sign-out must expire the ``token`` cookie where sign-in set it.
  With ``WEBUI_SESSION_COOKIE_DOMAIN`` (production: ``.polychat.co``) that is a domain cookie,
  which a host-only delete leaves in place, so Polychat's API host kept seeing the old
  account after sign-out.
"""

import re
from typing import Optional

from starlette.responses import Response

SESSION_COOKIE = "token"
MAX_LOGIN_HINT_LENGTH = 254
_SIMPLE_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def clean_login_hint(value: Optional[str]) -> Optional[str]:
    """The hint if it looks like one email address, else None."""
    if not value:
        return None
    hint = value.strip()
    if len(hint) > MAX_LOGIN_HINT_LENGTH or not _SIMPLE_EMAIL.match(hint):
        return None
    return hint


def login_hint_kwargs(value: Optional[str]) -> dict:
    """Extra authorize-redirect parameters for ``value`` (empty when it isn't usable)."""
    hint = clean_login_hint(value)
    return {"login_hint": hint} if hint else {}


def delete_session_cookie(response: Response, domain: Optional[str]) -> None:
    """Expire ``token`` host-only (older sign-ins) and, when configured, on its domain."""
    response.delete_cookie(SESSION_COOKIE)
    if domain:
        response.delete_cookie(SESSION_COOKIE, domain=domain)
