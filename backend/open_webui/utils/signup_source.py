"""Where a signup came from, recorded once in the new user's `info`.

The frontend captures utm_source / utm_medium / utm_campaign / ref and the referrer's
host name on the first page of a visit and sends them right after sign-in. Only those
keys are kept, each a short plain value, and the referrer only as a bare host name:
never a full URL or its query string. Accounts older than SIGNUP_WINDOW_SECONDS are
not signups, so their visits are not recorded, and the first record is never replaced.
"""

import re
from typing import Optional

SIGNUP_SOURCE_INFO_KEY = "signup_source"
SIGNUP_SOURCE_KEYS = ("utm_source", "utm_medium", "utm_campaign", "ref")
SIGNUP_WINDOW_SECONDS = 24 * 60 * 60
MAX_VALUE_LENGTH = 64

_VALUE_PATTERN = re.compile(r"^[A-Za-z0-9._~+\- ]+$")
_HOST_PATTERN = re.compile(r"^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*$")


def signup_source_info_update(
    info: Optional[dict], created_at: int, now: int, raw: dict
) -> Optional[dict]:
    """The user's new `info` with the source recorded, or None when nothing should change."""
    info = info or {}
    if info.get(SIGNUP_SOURCE_INFO_KEY) or now - created_at > SIGNUP_WINDOW_SECONDS:
        return None
    source = clean_signup_source(raw)
    if source is None:
        return None
    return {**info, SIGNUP_SOURCE_INFO_KEY: {**source, "recorded_at": now}}


def clean_signup_source(raw: dict) -> Optional[dict]:
    """The allowed, well-formed fields of `raw`, or None when none are left."""
    source = {}
    for key in SIGNUP_SOURCE_KEYS:
        value = _clean_value(raw.get(key))
        if value:
            source[key] = value
    referrer = _clean_host(raw.get("referrer"))
    if referrer:
        source["referrer"] = referrer
    return source or None


def _clean_value(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > MAX_VALUE_LENGTH or not _VALUE_PATTERN.match(value):
        return None
    return value


def _clean_host(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    host = value.strip().lower()
    return host if _HOST_PATTERN.match(host) else None
