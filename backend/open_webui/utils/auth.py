import logging
import time
import uuid
import jwt
import base64
import hmac
import hashlib
import requests
import os


from datetime import datetime, timedelta
import pytz
from pytz import UTC
from typing import Optional, Union, List, Dict

from open_webui.models.users import Users

from open_webui.constants import ERROR_MESSAGES
from open_webui.env import (
    WEBUI_SECRET_KEY,
    TRUSTED_SIGNATURE_KEY,
    STATIC_DIR,
    SRC_LOG_LEVELS,
    NO_CC_AUTH,
    ALLOW_API_KEY_PRIVATE_MODEL_ACCESS,
)

from fastapi import BackgroundTasks, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from open_webui.utils.forwarded_identity import (
    FORWARDED_IDENTITY_KEY_INFO,
    derive_forwarded_identity_key,
    sign_forwarded_identity,
)


logging.getLogger("passlib").setLevel(logging.ERROR)

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["OAUTH"])

SESSION_SECRET = WEBUI_SECRET_KEY
ALGORITHM = "HS256"

##############
# Auth Utils
##############


def verify_signature(payload: str, signature: str) -> bool:
    """
    Verifies the HMAC signature of the received payload.
    """
    try:
        expected_signature = base64.b64encode(
            hmac.new(TRUSTED_SIGNATURE_KEY, payload.encode(), hashlib.sha256).digest()
        ).decode()

        # Compare securely to prevent timing attacks
        return hmac.compare_digest(expected_signature, signature)

    except Exception:
        return False


def override_static(path: str, content: str):
    # Ensure path is safe
    if "/" in path or ".." in path:
        log.error(f"Invalid path: {path}")
        return

    file_path = os.path.join(STATIC_DIR, path)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(base64.b64decode(content))  # Convert Base64 back to raw binary


def get_license_data(app, key):
    if key:
        try:
            res = requests.post(
                "https://api.openwebui.com/api/v1/license/",
                json={"key": key, "version": "1"},
                timeout=5,
            )

            if getattr(res, "ok", False):
                payload = getattr(res, "json", lambda: {})()
                for k, v in payload.items():
                    if k == "resources":
                        for p, c in v.items():
                            globals().get("override_static", lambda a, b: None)(p, c)
                    elif k == "count":
                        setattr(app.state, "USER_COUNT", v)
                    elif k == "name":
                        setattr(app.state, "WEBUI_NAME", v)
                    elif k == "metadata":
                        setattr(app.state, "LICENSE_METADATA", v)
                return True
            else:
                log.error(
                    f"License: retrieval issue: {getattr(res, 'text', 'unknown error')}"
                )
        except Exception as ex:
            log.exception(f"License: Uncaught Exception: {ex}")
    return False


bearer_security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return (
        pwd_context.verify(plain_password, hashed_password) if hashed_password else None
    )


def get_password_hash(password):
    return pwd_context.hash(password)


def create_token(data: dict, expires_delta: Union[timedelta, None] = None) -> str:
    payload = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
        payload.update({"exp": expire})

    encoded_jwt = jwt.encode(payload, SESSION_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        decoded = jwt.decode(token, SESSION_SECRET, algorithms=[ALGORITHM])
        return decoded
    except Exception:
        return None


def extract_token_from_auth_header(auth_header: str):
    return auth_header[len("Bearer ") :]


def create_api_key():
    key = str(uuid.uuid4()).replace("-", "")
    return f"sk-{key}"


def get_http_authorization_cred(auth_header: Optional[str]):
    if not auth_header:
        return None
    try:
        scheme, credentials = auth_header.split(" ")
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)
    except Exception:
        return None


def get_call_type(request: Request) -> str:
    """
    Determine if this is an API call or UI call based on the token type.
    API calls use tokens that start with "sk-" (API keys)
    UI calls use JWT tokens (don't start with "sk-")
    """
    if hasattr(request.state, 'token') and request.state.token:
        token = request.state.token.credentials
        if token and token.startswith("sk-"):
            return "API"
    return "UI"


def api_key_private_model_access(request: Request) -> bool:
    """
    True only when the operator has explicitly opted in to letting API-key
    ("sk-") callers bypass model access control AND this request is such a call.
    Access control is otherwise enforced regardless of transport.
    """
    return ALLOW_API_KEY_PRIVATE_MODEL_ACCESS and get_call_type(request) == "API"


# The only inbound X-PolyChat-* header the polychat backend reads. Every other
# client-supplied X-PolyChat-* header is dropped rather than forwarded verbatim.
FORWARDABLE_POLYCHAT_HEADERS = frozenset({"x-polychat-memory"})

def get_forwarded_headers(request: Request, user=None) -> dict:
    """
    Get headers to forward to backend services, including:
    - X-OpenWebUI user info headers, plus a signed identity assertion
      (X-OpenWebUI-User-Ts / X-OpenWebUI-User-Sig)
    - the allowlisted X-PolyChat headers from the incoming request
    """
    headers = {}

    # Add X-OpenWebUI headers if user info forwarding is enabled
    if user and hasattr(request.app.state, 'config'):
        from open_webui.env import ENABLE_FORWARD_USER_INFO_HEADERS
        if ENABLE_FORWARD_USER_INFO_HEADERS:
            ts = str(int(time.time()))
            headers.update({
                "X-OpenWebUI-User-Name": user.name,
                "X-OpenWebUI-User-Id": user.id,
                "X-OpenWebUI-User-Email": user.email,
                "X-OpenWebUI-User-Role": user.role,
                "X-OpenWebUI-Call-Type": get_call_type(request),
                "X-OpenWebUI-User-Ts": ts,
                "X-OpenWebUI-User-Sig": sign_forwarded_identity(
                    user.id, user.email, ts, SESSION_SECRET
                ),
            })

    # Forward only allowlisted X-PolyChat headers from the incoming request
    if hasattr(request, 'headers'):
        for header_name, header_value in request.headers.items():
            if header_name.lower() in FORWARDABLE_POLYCHAT_HEADERS:
                headers[header_name] = header_value

    return headers


def get_current_user(
    request: Request,
    background_tasks: BackgroundTasks,
    auth_token: HTTPAuthorizationCredentials = Depends(bearer_security),
):
    token = None

    if auth_token is not None:
        token = auth_token.credentials

    if token is None and "token" in request.cookies:
        token = request.cookies.get("token")

    if token is None:
        raise HTTPException(status_code=403, detail="Not authenticated")

    # auth by api key
    if token.startswith("sk-"):
        if not request.state.enable_api_key:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.API_KEY_NOT_ALLOWED
            )

        if request.app.state.config.ENABLE_API_KEY_ENDPOINT_RESTRICTIONS:
            allowed_paths = [
                path.strip()
                for path in str(
                    request.app.state.config.API_KEY_ALLOWED_ENDPOINTS
                ).split(",")
            ]

            # Check if the request path matches any allowed endpoint.
            if not any(
                request.url.path == allowed
                or request.url.path.startswith(allowed + "/")
                for allowed in allowed_paths
            ):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.API_KEY_NOT_ALLOWED
                )

        return get_current_user_by_api_key(token)

    # auth by jwt token
    try:
        data = decode_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if data is not None and "id" in data:
        user = Users.get_user_by_id(data["id"])
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.INVALID_TOKEN,
            )
        else:
            # Refresh the user's last active timestamp asynchronously
            # to prevent blocking the request
            if background_tasks:
                background_tasks.add_task(Users.update_user_last_active_by_id, user.id)
        return user
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )


def get_current_user_by_api_key(api_key: str):
    user = Users.get_user_by_api_key(api_key)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.INVALID_TOKEN,
        )
    else:
        Users.update_user_last_active_by_id(user.id)

    return user


def get_verified_user(user=Depends(get_current_user)):
    if user.role not in {"user", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
        )
    return user


def get_admin_user(user=Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
        )
    return user


def get_cc_user_by_authorization(
    request: Request,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None),
    x_api_key: str = Header(None, alias="x-api-key"),
):
    """
    Authenticate user via authorization header for /cc (Claude Code requests)
    Does NOT check API_KEY_ALLOWED_ENDPOINTS restrictions.
    Supports both:
    - Standard Anthropic "x-api-key: sk-..." format
    - Bearer token "Authorization: Bearer sk-..." format

    Token format can be "orig-token,user-token" where:
    - orig-token: Anthropic OAuth token (sk-ant-oat01...) to forward downstream (stored in request.state.cc_orig_token)
    - user-token: Open WebUI API key (sk-...) used for authentication in Open WebUI

    If NO_CC_AUTH is enabled, returns a default admin user without requiring authentication.
    """
    # If NO_CC_AUTH is enabled, bypass authentication
    if NO_CC_AUTH:
        from open_webui.models.users import UserModel
        return UserModel(
            id="no-auth-user",
            name="No Auth User",
            email="noauth@localhost",
            role="user",
            profile_image_url="/user.png",
            last_active_at=int(time.time()),
            updated_at=int(time.time()),
            created_at=int(time.time()),
        )

    token = None

    # Check for x-api-key header (Anthropic standard)
    if x_api_key is not None:
        token = x_api_key
    # Check for Authorization header
    elif authorization is not None:
        # Extract token from "Bearer <token>" format
        auth_cred = get_http_authorization_cred(authorization)
        if auth_cred is None or auth_cred.scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )
        token = auth_cred.credentials

    if token is None:
        raise HTTPException(
            status_code=403,
            detail="Not authenticated. Provide either 'Authorization: Bearer <token>' or 'x-api-key: <token>' header."
        )

    # Parse token format: "orig-token,user-token"
    # orig-token is an Anthropic OAuth token (sk-ant-oat01...)
    # user-token is an Open WebUI API key (sk-...)
    orig_token = None
    user_token = token
    if "," in token:
        parts = token.split(",", 1)
        orig_token = parts[0]
        user_token = parts[1]

    # Store original Anthropic OAuth token in request state for use in router
    request.state.cc_orig_token = orig_token

    # Check if it's an API key (starts with "sk-")
    if user_token.startswith("sk-"):
        if not request.state.enable_api_key:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.API_KEY_NOT_ALLOWED
            )
        # Note: We explicitly do NOT check API_KEY_ALLOWED_ENDPOINTS here
        return get_current_user_by_api_key(user_token)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
    )


def auth_cc_user(user=Depends(get_cc_user_by_authorization)):
    """
    Authenticate user via authorization header for /cc (Claude Code requests)
    """
    if user.role not in {"user", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
        )
    return user
