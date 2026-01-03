import logging
from typing import Optional
import json

import aiohttp
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse

from open_webui.env import (
    AIOHTTP_CLIENT_SESSION_SSL,
    AIOHTTP_CLIENT_TIMEOUT,
    SRC_LOG_LEVELS,
)
from open_webui.models.users import UserModel
from open_webui.utils.auth import (
    get_forwarded_headers,
    get_cc_user_by_authorization,
)
from open_webui.constants import ERROR_MESSAGES

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("CC", logging.INFO))

router = APIRouter()


async def cleanup_response(
    response: Optional[aiohttp.ClientResponse],
    session: Optional[aiohttp.ClientSession],
) -> None:
    if response:
        response.close()
    if session:
        await session.close()


# Paths that bypass authentication (e.g., telemetry endpoints)
CC_NO_AUTH_PATHS = {"api/event_logging/batch"}


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def cc_catch_all(
    request: Request,
    path: str,
):
    """
    Catch-all route /cc/* paths

    Authenticates via authorization header without checking API_KEY_ALLOWED_ENDPOINTS.
    Some paths (defined in CC_NO_AUTH_PATHS) bypass authentication.
    """
    # Authenticate unless path is in no-auth list
    user: Optional[UserModel] = None
    if path not in CC_NO_AUTH_PATHS:
        authorization = request.headers.get("authorization")
        x_api_key = request.headers.get("x-api-key")
        user = get_cc_user_by_authorization(request, None, authorization, x_api_key)
        if user.role not in {"user", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
            )

    if not request.app.state.config.ENABLE_OPENAI_API:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API is not enabled",
        )

    base_urls = request.app.state.config.OPENAI_API_BASE_URLS
    api_keys = request.app.state.config.OPENAI_API_KEYS

    if not base_urls or not api_keys:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API not configured",
        )

    target_base = base_urls[0].rstrip("/")
    if target_base.endswith("/v1"):
        target_base = target_base[:-3]
    target_path = path.lstrip("/")
    target_url = f"{target_base}/cc/{target_path}" if target_path else f"{target_base}/cc"
    api_key = api_keys[0]

    body = await request.body()
    params = list(request.query_params.multi_items())
    params = params if params else None

    # Log full request and authentication details
    try:
        body_json = json.loads(body) if body else None
    except Exception:
        body_json = body.decode('utf-8', errors='replace') if body else None

    def truncate_strings_for_logging(obj, max_chars=100):
        """Recursively truncate strings to show first and last max_chars characters."""
        if isinstance(obj, str):
            if len(obj) <= max_chars * 2:
                return obj
            return f"{obj[:max_chars]}...{obj[-max_chars:]}"
        elif isinstance(obj, dict):
            return {k: truncate_strings_for_logging(v, max_chars) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [truncate_strings_for_logging(item, max_chars) for item in obj]
        elif isinstance(obj, tuple):
            return tuple(truncate_strings_for_logging(item, max_chars) for item in obj)
        else:
            return obj

    request_data_to_log = {
        "method": request.method,
        "path": f"/{path}",
        "user_id": user.id if user else None,
        "user_email": user.email if user else None,
        "user_role": user.role if user else None,
        "auth_header": "Authorization" if request.headers.get('authorization') else "x-api-key",
        "headers": {
            k: (f"{v[:6]}...{v[-6:]}" if len(v) > 12 else v)
               if k.lower() in ('authorization', 'x-api-key') else v
            for k, v in request.headers.items()
        },
        "query_params": dict(request.query_params),
        "client": str(request.client),
        "body": body_json
    }

    truncated_data_for_logging = truncate_strings_for_logging(request_data_to_log)
    log.debug(f"CC Request:\n{json.dumps(truncated_data_for_logging, indent=2)}")

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    # Only add forwarded headers if we have an authenticated user
    if user:
        headers.update(get_forwarded_headers(request, user))

    # Pass original Anthropic OAuth token (sk-ant-oat01...) as orig-bearer-token header
    # This token was extracted during authentication in get_cc_user_by_authorization
    if hasattr(request.state, "cc_orig_token") and request.state.cc_orig_token:
        headers["orig-bearer-token"] = request.state.cc_orig_token

    content_type = request.headers.get("content-type")
    if content_type:
        headers["Content-Type"] = content_type

    accept_header = request.headers.get("accept")
    if accept_header:
        headers["Accept"] = accept_header

    session: Optional[aiohttp.ClientSession] = None
    response: Optional[aiohttp.ClientResponse] = None
    payload: Optional[object] = None
    streaming = False

    try:
        session = aiohttp.ClientSession(
            trust_env=True, timeout=aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT)
        )
        response = await session.request(
            method=request.method,
            url=target_url,
            data=body if body else None,
            params=params,
            headers=headers,
            ssl=AIOHTTP_CLIENT_SESSION_SSL,
        )

        content_type = response.headers.get("Content-Type", "")
        if "text/event-stream" in content_type:
            streaming = True
            return StreamingResponse(
                response.content,
                status_code=response.status,
                headers=dict(response.headers),
                background=BackgroundTask(
                    cleanup_response, response=response, session=session
                ),
            )

        # Check content type to determine how to parse response
        content_type = response.headers.get("Content-Type", "")
        is_json = "application/json" in content_type

        try:
            if is_json:
                payload = await response.json()
            else:
                payload = await response.text()
        except Exception:
            payload = await response.text()

        # Check for error status codes and return error response directly
        if response.status >= 400:
            # For error responses, pass through the payload directly
            # This preserves the exact format from downstream
            if isinstance(payload, dict):
                return JSONResponse(
                    status_code=response.status,
                    content=payload,
                )
            elif isinstance(payload, str):
                # Return plain text responses as-is to preserve newlines
                return PlainTextResponse(
                    status_code=response.status,
                    content=payload if payload else "Open WebUI: Server Connection Error",
                )
            else:
                # Fallback for other types
                return JSONResponse(
                    status_code=response.status,
                    content={"detail": str(payload)},
                )

        return payload
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as exc:
        log.exception(exc)

        # Handle other exceptions (connection errors, etc.)
        detail = "Open WebUI: Server Connection Error"
        status_code = 500

        raise HTTPException(
            status_code=status_code,
            detail=detail,
        )
    finally:
        if not streaming and session:
            if response:
                response.close()
            await session.close()
