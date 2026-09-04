"""Pure helpers for signing the identity forwarded to PolyChat."""

import hashlib
import hmac


FORWARDED_IDENTITY_KEY_INFO = b"polychat-forwarded-identity-v1"


def derive_forwarded_identity_key(secret: str) -> bytes:
    """Derive the identity-signing key from the Open WebUI secret."""
    return hmac.new(
        secret.encode(), FORWARDED_IDENTITY_KEY_INFO, hashlib.sha256
    ).digest()


def sign_forwarded_identity(user_id: str, email: str, ts: str, secret: str) -> str:
    """
    Sign ``<user_id>|<email>|<ts>`` with the derived identity key.

    The protocol is shared with the PolyChat service. Keep this module free of
    application and database imports so protocol tests can run in isolation.
    """
    key = derive_forwarded_identity_key(secret)
    message = f"{user_id}|{email}|{ts}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()
