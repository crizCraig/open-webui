import hashlib
import hmac
import subprocess
import sys

from open_webui.utils.forwarded_identity import (
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


def test_signer_import_does_not_initialize_database_or_app():
    script = """
import builtins
import importlib
import sys

blocked = {"open_webui.internal.db", "open_webui.main"}
real_import = builtins.__import__

def guarded_import(name, *args, **kwargs):
    if name in blocked:
        raise AssertionError(f"unexpected import: {name}")
    return real_import(name, *args, **kwargs)

builtins.__import__ = guarded_import
importlib.import_module("open_webui.utils.forwarded_identity")
assert not blocked.intersection(sys.modules)
"""
    completed = subprocess.run(
        [sys.executable, "-c", script],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout
