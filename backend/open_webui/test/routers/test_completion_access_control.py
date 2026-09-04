import asyncio
import importlib
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import JSONResponse

ROUTERS_DIR = Path(__file__).parents[2] / "routers"


def get_router_import_stubs():
    config = ModuleType("open_webui.config")
    config.CACHE_DIR = ""
    config.UPLOAD_DIR = ""
    payload = ModuleType("open_webui.utils.payload")
    payload.apply_model_params_to_body_openai = lambda _params, body: body
    payload.apply_model_params_to_body_ollama = lambda _params, body: body
    payload.apply_model_system_prompt_to_body = (
        lambda _params, body, _metadata, _user: body
    )
    misc = ModuleType("open_webui.utils.misc")
    misc.calculate_sha256 = lambda value: value
    misc.convert_logit_bias_input_to_json = lambda value: value
    models = ModuleType("open_webui.models.models")
    models.Models = type(
        "Models", (), {"get_model_by_id": staticmethod(lambda _model_id: None)}
    )
    users = ModuleType("open_webui.models.users")
    users.UserModel = object

    auth = ModuleType("open_webui.utils.auth")
    auth.get_admin_user = lambda: None
    auth.get_verified_user = lambda: None
    auth.get_call_type = lambda: None
    auth.get_forwarded_headers = lambda *args, **kwargs: {}
    auth.api_key_private_model_access = lambda *args, **kwargs: False
    access_control = ModuleType("open_webui.utils.access_control")
    access_control.has_access = lambda *args, **kwargs: False
    return {
        config.__name__: config,
        payload.__name__: payload,
        misc.__name__: misc,
        models.__name__: models,
        users.__name__: users,
        auth.__name__: auth,
        access_control.__name__: access_control,
    }


def load_router_module(module_name, router_filename):
    spec = importlib.util.spec_from_file_location(
        module_name, ROUTERS_DIR / router_filename
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def route_modules():
    constants = importlib.import_module("open_webui.constants")
    stubs = get_router_import_stubs()
    original_modules = {name: sys.modules.get(name) for name in stubs}
    with patch.dict(sys.modules, stubs):
        openai = load_router_module("completion_acl_openai", "openai.py")
        ollama = load_router_module("completion_acl_ollama", "ollama.py")
        yield SimpleNamespace(openai=openai, ollama=ollama)

    for name, original_module in original_modules.items():
        assert sys.modules.get(name) is original_module
    assert "completion_acl_openai" not in sys.modules
    assert "completion_acl_ollama" not in sys.modules
    assert importlib.import_module("open_webui.constants") is constants


class FakeOpenAIResponse:
    headers = {"Content-Type": "application/json"}
    status = 200

    async def json(self):
        return {"upstream": "called"}

    def raise_for_status(self):
        pass

    def close(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class FakeOpenAIModelResponse(FakeOpenAIResponse):
    async def json(self):
        return {"data": [{"id": "private-model"}]}


class FakeOpenAISession:
    requests = []

    def __init__(self, **kwargs):
        pass

    async def request(self, **kwargs):
        self.requests.append(kwargs)
        return FakeOpenAIResponse()

    async def close(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def get(self, url, **kwargs):
        self.requests.append({"url": url, **kwargs})
        return FakeOpenAIModelResponse()


def private_model():
    return SimpleNamespace(
        base_model_id=None,
        user_id="model-owner",
        access_control={"read": {"group_ids": []}},
        params=SimpleNamespace(model_dump=lambda: {}),
    )


def regular_user():
    return SimpleNamespace(
        id="untrusted-user",
        name="Untrusted User",
        email="untrusted@example.com",
        role="user",
    )


def make_request(app, path):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "app": app,
        }
    )


def configure_openai(monkeypatch, openai):
    app = FastAPI()
    app.include_router(openai.router, prefix="/openai")
    app.dependency_overrides[openai.get_verified_user] = regular_user
    app.state.config = SimpleNamespace(
        OPENAI_API_BASE_URLS=["https://upstream.example"],
        OPENAI_API_KEYS=["test-key"],
        OPENAI_API_CONFIGS={},
    )
    app.state.OPENAI_MODELS = {"private-model": {"urlIdx": 0}}
    monkeypatch.setattr(openai.Models, "get_model_by_id", lambda _model_id: private_model())
    monkeypatch.setattr(openai, "has_access", lambda *args, **kwargs: False)
    monkeypatch.setattr(openai, "BYPASS_MODEL_ACCESS_CONTROL", False)

    async def do_not_refresh_models(*args, **kwargs):
        return {}

    monkeypatch.setattr(openai, "get_all_models", do_not_refresh_models)
    FakeOpenAISession.requests = []
    monkeypatch.setattr(openai.aiohttp, "ClientSession", FakeOpenAISession)
    return app


def configure_ollama(monkeypatch, ollama):
    app = FastAPI()
    app.include_router(ollama.router, prefix="/ollama")
    app.dependency_overrides[ollama.get_verified_user] = regular_user
    app.state.config = SimpleNamespace(
        OLLAMA_BASE_URLS=["https://upstream.example"],
        OLLAMA_API_CONFIGS={},
    )
    app.state.OLLAMA_MODELS = {"private-model:latest": {"urls": [0]}}
    monkeypatch.setattr(ollama.Models, "get_model_by_id", lambda _model_id: private_model())
    monkeypatch.setattr(ollama, "has_access", lambda *args, **kwargs: False)
    monkeypatch.setattr(ollama, "BYPASS_MODEL_ACCESS_CONTROL", False)
    calls = []

    async def fake_get_all_models(*args, **kwargs):
        return {"models": [{"model": "private-model:latest"}]}

    async def fake_send_post_request(**kwargs):
        calls.append(kwargs)
        return JSONResponse({"upstream": "called"})

    def fake_sync_request(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"upstream": "called"},
        )

    monkeypatch.setattr(ollama, "get_all_models", fake_get_all_models)
    monkeypatch.setattr(ollama, "send_post_request", fake_send_post_request)
    monkeypatch.setattr(ollama.requests, "request", fake_sync_request)
    return app, calls


def test_openai_query_bypass_cannot_access_private_model(monkeypatch, route_modules):
    app = configure_openai(monkeypatch, route_modules.openai)

    with TestClient(app) as client:
        response = client.post(
            "/openai/chat/completions?bypass_filter=true",
            json={"model": "private-model", "messages": []},
        )

    assert response.status_code == 403
    assert FakeOpenAISession.requests == []


def test_ollama_query_bypass_cannot_access_private_model(monkeypatch, route_modules):
    app, calls = configure_ollama(monkeypatch, route_modules.ollama)

    with TestClient(app) as client:
        response = client.post(
            "/ollama/api/chat?bypass_filter=true",
            json={
                "model": "private-model",
                "messages": [{"role": "user", "content": "hello"}],
            },
        )

    assert response.status_code == 403
    assert calls == []


def test_openai_completion_path_aliases_cannot_reach_proxy(monkeypatch, route_modules):
    app = configure_openai(monkeypatch, route_modules.openai)

    with TestClient(app) as client:
        for path in (
            "/openai/chat/completions/",
            "/openai/chat//completions",
            "/openai/./chat/completions",
            "/openai/chat%252Fcompletions",
            "/openai/chat/completions%253Fignored",
        ):
            response = client.post(
                f"{path}?bypass_filter=true",
                json={"model": "private-model", "messages": []},
            )
            assert response.status_code == 403

    assert FakeOpenAISession.requests == []


def test_openai_generic_model_requests_enforce_private_model_access(
    monkeypatch, route_modules
):
    app = configure_openai(monkeypatch, route_modules.openai)

    with TestClient(app) as client:
        for path in ("/openai/responses", "/openai/responses%253Fignored"):
            response = client.post(
                f"{path}?bypass_filter=true",
                json={"model": "private-model", "input": "hello"},
            )
            assert response.status_code == 403

    assert FakeOpenAISession.requests == []


def test_openai_generic_non_model_requests_still_proxy(monkeypatch, route_modules):
    app = configure_openai(monkeypatch, route_modules.openai)

    with TestClient(app) as client:
        response = client.post(
            "/openai/legacy/provider-feature",
            json={"unrelated": "payload"},
        )

    assert response.status_code == 200
    assert response.json() == {"upstream": "called"}
    assert len(FakeOpenAISession.requests) == 1


def test_internal_completion_bypass_remains_available(monkeypatch, route_modules):
    openai = route_modules.openai
    ollama = route_modules.ollama
    openai_app = configure_openai(monkeypatch, openai)
    openai_response = asyncio.run(
        openai.generate_chat_completion_internal(
            make_request(openai_app, "/openai/chat/completions"),
            {"model": "private-model", "messages": []},
            regular_user(),
            bypass_filter=True,
        )
    )

    ollama_app, ollama_calls = configure_ollama(monkeypatch, ollama)
    ollama_response = asyncio.run(
        ollama.generate_chat_completion_internal(
            request=make_request(ollama_app, "/ollama/api/chat"),
            form_data={
                "model": "private-model",
                "messages": [{"role": "user", "content": "hello"}],
            },
            user=regular_user(),
            bypass_filter=True,
        )
    )

    assert openai_response == {"upstream": "called"}
    assert FakeOpenAISession.requests
    assert ollama_response.status_code == 200
    assert ollama_calls


OLLAMA_EXECUTION_PATHS = (
    "/api/chat",
    "/api/generate",
    "/api/embed",
    "/api/embeddings",
    "/v1/completions",
    "/v1/chat/completions",
)


def ollama_execution_body() -> dict:
    return {
        "model": "private-model",
        "messages": [{"role": "user", "content": "hello"}],
        "prompt": "hello",
        "input": "hello",
        "stream": False,
    }


@pytest.mark.parametrize("path", OLLAMA_EXECUTION_PATHS)
@pytest.mark.parametrize("suffix", ("", "/0"))
@pytest.mark.parametrize("registered", (True, False))
def test_ollama_execution_requires_model_access(
    monkeypatch, route_modules, path, suffix, registered
):
    ollama = route_modules.ollama
    app, calls = configure_ollama(monkeypatch, ollama)
    monkeypatch.setattr(
        ollama.Models,
        "get_model_by_id",
        lambda model_id: private_model()
        if registered and model_id == "private-model:latest"
        else None,
    )

    with TestClient(app) as client:
        response = client.post(
            f"/ollama{path}{suffix}?bypass_filter=true",
            json=ollama_execution_body(),
            headers={"Authorization": "Bearer sk-untrusted"},
        )

    assert response.status_code == 403
    assert calls == []


@pytest.mark.parametrize("path", OLLAMA_EXECUTION_PATHS)
@pytest.mark.parametrize("suffix", ("", "/0"))
@pytest.mark.parametrize("access", ("owner", "public", "api_key", "operator", "admin"))
def test_ollama_authorized_execution_remains_available(
    monkeypatch, route_modules, path, suffix, access
):
    ollama = route_modules.ollama
    app, calls = configure_ollama(monkeypatch, ollama)
    model = private_model()
    if access == "owner":
        model.user_id = regular_user().id
    elif access == "public":
        model.access_control = None
        monkeypatch.setattr(
            ollama, "has_access", lambda *args, **kwargs: kwargs["access_control"] is None
        )
    elif access == "api_key":
        monkeypatch.setattr(ollama, "api_key_private_model_access", lambda request: True)
    elif access == "operator":
        monkeypatch.setattr(ollama, "BYPASS_MODEL_ACCESS_CONTROL", True)
    elif access == "admin":
        admin = regular_user()
        admin.role = "admin"
        app.dependency_overrides[ollama.get_verified_user] = lambda: admin
    monkeypatch.setattr(ollama.Models, "get_model_by_id", lambda _model_id: model)

    with TestClient(app) as client:
        response = client.post(
            f"/ollama{path}{suffix}", json=ollama_execution_body()
        )

    assert response.status_code == 200
    assert response.json() == {"upstream": "called"}
    assert len(calls) == 1


@pytest.mark.parametrize(
    "path", ("/models", "/models/", "/%2e/models/", "/models%252F", "/v1/models/")
)
def test_openai_model_list_aliases_are_filtered(monkeypatch, route_modules, path):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)

    async def fake_get_all_models(*args, **kwargs):
        return {"data": [{"id": "private-model"}]}

    monkeypatch.setattr(openai, "get_all_models", fake_get_all_models)
    with TestClient(app) as client:
        response = client.get(f"/openai{path}")

    assert response.status_code == 200
    assert response.json() == {"data": []}
    assert FakeOpenAISession.requests == []


@pytest.mark.parametrize("path", ("/models/0", "/models/0/", "/%2e/models/0/"))
def test_openai_indexed_model_list_aliases_are_filtered(monkeypatch, route_modules, path):
    app = configure_openai(monkeypatch, route_modules.openai)
    with TestClient(app) as client:
        response = client.get(f"/openai{path}")

    assert response.status_code == 200
    assert response.json() == {"data": []}
    assert len(FakeOpenAISession.requests) == 1
    assert FakeOpenAISession.requests[0]["url"] == "https://upstream.example/models"
