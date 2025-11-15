import logging
from typing import Optional

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Request
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
    auth_cc_user,
)

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


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def cc_catch_all(
    request: Request,
    path: str,
    user: UserModel = Depends(auth_cc_user),
):
    """
    Catch-all route /cc/* paths
    
    Authenticates via authorization header without checking API_KEY_ALLOWED_ENDPOINTS
    """

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

    headers = {
        "Authorization": f"Bearer {api_key}",
        **get_forwarded_headers(request, user),
    }

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

        try:
            payload = await response.json()
        except Exception:
            payload = await response.text()

        response.raise_for_status()
        return payload
    except Exception as exc:
        log.exception(exc)

        detail = None
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                detail = error.get("message") or error
            elif error is not None:
                detail = error
        elif isinstance(payload, str):
            detail = payload

        raise HTTPException(
            status_code=response.status if response else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )
    finally:
        if not streaming and session:
            if response:
                response.close()
            await session.close()
