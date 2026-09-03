import hashlib
import hmac

from open_webui.utils.auth import (
    FORWARDED_IDENTITY_KEY_INFO,
    derive_forwarded_identity_key,
    sign_forwarded_identity,
)


def test_sign_forwarded_identity_matches_protocol():
    secret = "test-secret"
    key = hmac.new(secret.encode(), FORWARDED_IDENTITY_KEY_INFO, hashlib.sha256).digest()
    expected = hmac.new(key, b"u1|a@b.c|1700000000", hashlib.sha256).hexdigest()
    assert derive_forwarded_identity_key(secret) == key
    assert sign_forwarded_identity("u1", "a@b.c", "1700000000", secret) == expected


def test_sign_forwarded_identity_changes_with_any_field():
    base = sign_forwarded_identity("u1", "a@b.c", "1700000000", "s")
    assert sign_forwarded_identity("u2", "a@b.c", "1700000000", "s") != base
    assert sign_forwarded_identity("u1", "x@b.c", "1700000000", "s") != base
    assert sign_forwarded_identity("u1", "a@b.c", "1700000001", "s") != base
    assert sign_forwarded_identity("u1", "a@b.c", "1700000000", "other") != base
