import asyncio
import importlib
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import JSONResponse

ROUTERS_DIR = Path(__file__).parents[2] / "routers"


def get_router_import_stubs():
    config = ModuleType("open_webui.config")
    config.CACHE_DIR = ""
    config.UPLOAD_DIR = ""
    config.DEFAULT_USER_PERMISSIONS = {}
    config.DEFAULT_ARENA_MODEL = {}
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
        "Models", (), {
            "get_model_by_id": staticmethod(lambda _model_id: None),
            "get_all_models": staticmethod(lambda: []),
        }
    )
    models.ModelModel = object
    users = ModuleType("open_webui.models.users")
    users.UserModel = object
    users.Users = object
    groups = ModuleType("open_webui.models.groups")
    groups.Groups = type(
        "Groups", (), {"get_groups_by_member_id": staticmethod(lambda _user_id: [])}
    )
    functions = ModuleType("open_webui.functions")
    functions.get_function_models = lambda *args, **kwargs: []
    function_models = ModuleType("open_webui.models.functions")
    function_models.Functions = type(
        "Functions", (), {
            "get_global_action_functions": staticmethod(lambda: []),
            "get_functions_by_type": staticmethod(lambda *args, **kwargs: []),
        }
    )
    plugin = ModuleType("open_webui.utils.plugin")
    plugin.load_function_module_by_id = lambda _function_id: None

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
        groups.__name__: groups,
        functions.__name__: functions,
        function_models.__name__: function_models,
        plugin.__name__: plugin,
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
        access_control = load_router_module(
            "completion_acl_access_control", "../utils/access_control.py"
        )
        sys.modules["open_webui.routers.openai"] = openai
        sys.modules["open_webui.routers.ollama"] = ollama
        model_utils = load_router_module("completion_acl_models", "../utils/models.py")
        model_utils.has_access = access_control.has_access
        yield SimpleNamespace(
            openai=openai,
            ollama=ollama,
            access_control=access_control,
            models=stubs["open_webui.models.models"].Models,
            model_utils=model_utils,
        )

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
        id="private-model",
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
    models = sys.modules["open_webui.models.models"].Models
    monkeypatch.setattr(models, "get_model_by_id", lambda _model_id: private_model())
    monkeypatch.setattr(models, "get_all_models", lambda: [private_model()])
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
    models = sys.modules["open_webui.models.models"].Models
    monkeypatch.setattr(models, "get_model_by_id", lambda _model_id: private_model())
    monkeypatch.setattr(models, "get_all_models", lambda: [private_model()])
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
        route_modules.models,
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
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lambda _model_id: model)

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


def test_repeated_authorization_reuses_model_but_not_permission_decisions(
    monkeypatch, route_modules
):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    lookup = Mock(return_value=private_model())
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    request = make_request(app, "/openai/chat/completions")
    for _ in range(3):
        openai.authorize_model_access(
            request, {"model": "private-model"}, regular_user(), bypass_filter=True
        )
    with pytest.raises(HTTPException) as rejected:
        openai.authorize_model_access(request, {"model": "private-model"}, regular_user())
    assert rejected.value.status_code == 403
    lookup.assert_called_once_with("private-model")


@pytest.mark.parametrize("provider", ("openai", "ollama", "ollama_openai"))
def test_model_listing_batches_model_reads_and_reuses_groups(
    monkeypatch, route_modules, provider
):
    access_control = route_modules.access_control
    if provider == "openai":
        router = route_modules.openai
        app = configure_openai(monkeypatch, router)
        path, source_key, result_key, id_key = "/openai/models", "data", "data", "id"
    else:
        router = route_modules.ollama
        app, _ = configure_ollama(monkeypatch, router)
        path = "/ollama/v1/models" if provider == "ollama_openai" else "/ollama/api/tags"
        source_key, result_key, id_key = "models", "models", "model"
        if provider == "ollama_openai":
            result_key = "data"
    records = []
    for index in range(50):
        model = private_model()
        model.id = f"model-{index}"
        model.access_control = {"read": {"group_ids": ["readers"]}}
        records.append(model)
    lookup = Mock(side_effect={model.id: model for model in records}.get)
    bulk_lookup = Mock(return_value=records)
    group_lookup = Mock(return_value=[SimpleNamespace(id="readers")])
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    monkeypatch.setattr(route_modules.models, "get_all_models", bulk_lookup)
    monkeypatch.setattr(access_control.Groups, "get_groups_by_member_id", group_lookup)
    monkeypatch.setattr(router, "has_access", access_control.has_access)

    async def all_models(*args, **kwargs):
        return {source_key: [{id_key: model.id} for model in records]}

    monkeypatch.setattr(router, "get_all_models", all_models)
    with TestClient(app) as client:
        response = client.get(path)
    assert response.status_code == 200
    assert len(response.json()[result_key]) == 50
    lookup.assert_not_called()
    bulk_lookup.assert_called_once_with()
    group_lookup.assert_called_once_with(regular_user().id)


def test_group_cache_is_scoped_to_request_and_user(monkeypatch, route_modules):
    access_control = route_modules.access_control
    groups = {"alice": [SimpleNamespace(id="readers")], "bob": []}
    lookup = Mock(side_effect=groups.__getitem__)
    monkeypatch.setattr(access_control.Groups, "get_groups_by_member_id", lookup)
    request = make_request(FastAPI(), "/models")
    policy = {"read": {"group_ids": ["readers"]}}
    for _ in range(3):
        assert access_control.has_access("alice", "read", policy, request=request)
    assert not access_control.has_access("bob", "read", policy, request=request)
    groups["alice"] = []
    next_request = make_request(FastAPI(), "/models")
    assert not access_control.has_access("alice", "read", policy, request=next_request)
    assert [call.args for call in lookup.call_args_list] == [("alice",), ("bob",), ("alice",)]


def test_model_cache_does_not_cross_requests_or_model_ids(monkeypatch, route_modules):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    lookup = Mock(return_value=None)
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    first = make_request(app, "/openai/chat/completions")
    for model_id in ("missing-model", "missing-model", "another-model"):
        with pytest.raises(HTTPException):
            openai.authorize_model_access(first, {"model": model_id}, regular_user())
    assert lookup.call_count == 2
    model = private_model()
    model.user_id = regular_user().id
    lookup.return_value = model
    second = make_request(app, "/openai/chat/completions")
    assert openai.authorize_model_access(second, {"model": "missing-model"}, regular_user())
    assert lookup.call_count == 3


def test_deeply_encoded_paths_are_rejected_with_bounded_work(route_modules):
    openai = route_modules.openai
    path = "v1/%" + "25" * 1000 + "63hat/completions"
    with patch.object(openai, "unquote", wraps=openai.unquote) as decode:
        with pytest.raises(HTTPException) as rejected:
            openai.normalize_proxy_path(path)
    assert rejected.value.status_code == 400
    assert decode.call_count <= 5


def test_proxy_normalizes_path_only_once(monkeypatch, route_modules):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    with patch.object(openai, "normalize_proxy_path", wraps=openai.normalize_proxy_path) as parse:
        with TestClient(app) as client:
            response = client.post(
                "/openai/v1/chat/completions", json={"model": "private-model", "messages": []}
            )
    assert response.status_code == 403
    parse.assert_called_once()
    assert FakeOpenAISession.requests == []


def test_chat_layers_reuse_model_and_groups(monkeypatch, route_modules):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    model = private_model()
    model.access_control = {"read": {"group_ids": ["readers"]}}
    lookup = Mock(return_value=model)
    groups = Mock(return_value=[SimpleNamespace(id="readers")])
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    monkeypatch.setattr(route_modules.access_control.Groups, "get_groups_by_member_id", groups)
    monkeypatch.setattr(openai, "has_access", route_modules.access_control.has_access)
    request = make_request(app, "/api/chat/completions")

    assert openai.get_model_for_request(request, model.id) is model
    for _ in range(2):
        route_modules.model_utils.check_model_access(regular_user(), {"id": model.id}, request)
    assert openai.authorize_model_access(request, {"model": model.id}, regular_user()) is model
    lookup.assert_called_once_with(model.id)
    groups.assert_called_once_with(regular_user().id)


def test_bulk_catalog_is_reused_for_customization_and_filtering(monkeypatch, route_modules):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    app.state.config.ENABLE_EVALUATION_ARENA_MODELS = False
    model = private_model()
    model.is_active = True
    model.name = "Visible model"
    model.model_dump = lambda: {}
    model.access_control = None
    bulk_lookup = Mock(return_value=[model])
    lookup = Mock()
    monkeypatch.setattr(route_modules.models, "get_all_models", bulk_lookup)
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    monkeypatch.setattr(openai, "has_access", route_modules.access_control.has_access)

    async def all_base_models(*args, **kwargs):
        return [{"id": model.id, "owned_by": "openai"}]

    monkeypatch.setattr(route_modules.model_utils, "get_all_base_models", all_base_models)
    request = make_request(app, "/api/models")
    models = asyncio.run(route_modules.model_utils.get_all_models(request, regular_user()))
    for _ in range(2):
        visible = asyncio.run(openai.get_filtered_models({"data": models}, regular_user(), request))
        assert [item["id"] for item in visible] == [model.id]
    assert openai.get_model_for_request(request, "missing") is None
    bulk_lookup.assert_called_once_with()
    lookup.assert_not_called()


def test_revoked_model_access_is_rechecked_on_next_request(monkeypatch, route_modules):
    openai = route_modules.openai
    app = configure_openai(monkeypatch, openai)
    public = private_model()
    public.access_control = None
    lookup = Mock(side_effect=[public, private_model()])
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    monkeypatch.setattr(openai, "has_access", route_modules.access_control.has_access)
    first = make_request(app, "/openai/chat/completions")
    assert openai.authorize_model_access(first, {"model": public.id}, regular_user()) is public
    second = make_request(app, "/openai/chat/completions")
    with pytest.raises(HTTPException) as rejected:
        openai.authorize_model_access(second, {"model": public.id}, regular_user())
    assert rejected.value.status_code == 403
    assert lookup.call_count == 2


@pytest.mark.parametrize("rounds", (0, 1, 2, 3, 4, 5))
def test_proxy_decode_depth_boundary(route_modules, rounds):
    openai = route_modules.openai
    path = "v1/chat/completions"
    if rounds:
        path = "v1/%" + "25" * (rounds - 1) + "63hat/completions"
    if rounds <= openai.MAX_PROXY_DECODE_ROUNDS:
        assert openai.normalize_proxy_path(path) == "v1/chat/completions"
    else:
        with pytest.raises(HTTPException) as rejected:
            openai.normalize_proxy_path(path)
        assert rejected.value.status_code == 400


def test_oversized_proxy_path_is_rejected_before_decoding(route_modules):
    openai = route_modules.openai
    path = "x" * openai.MAX_PROXY_PATH_CHARS
    assert openai.normalize_proxy_path(path) == path
    with patch.object(openai, "unquote", wraps=openai.unquote) as decode:
        with pytest.raises(HTTPException) as rejected:
            openai.normalize_proxy_path(path + "x")
    assert rejected.value.status_code == 414
    decode.assert_not_called()


@pytest.mark.parametrize("method", ("GET", "POST", "PUT", "DELETE"))
def test_excessively_encoded_proxy_paths_never_reach_upstream(
    monkeypatch, route_modules, method
):
    app = configure_openai(monkeypatch, route_modules.openai)
    path = "/openai/v1/%" + "25" * 20 + "63hat/completions"
    with TestClient(app) as client:
        response = client.request(method, path, json={"model": "private-model", "messages": []})
    assert response.status_code == 400
    assert FakeOpenAISession.requests == []


@pytest.mark.parametrize("provider", ("openai", "ollama"))
def test_empty_model_list_does_not_read_the_database(monkeypatch, route_modules, provider):
    router = getattr(route_modules, provider)
    lookup = Mock()
    bulk_lookup = Mock(return_value=[])
    monkeypatch.setattr(route_modules.models, "get_model_by_id", lookup)
    monkeypatch.setattr(route_modules.models, "get_all_models", bulk_lookup)
    request = make_request(FastAPI(), "/models")
    assert asyncio.run(router.get_filtered_models({}, regular_user(), request)) == []
    lookup.assert_not_called()
    bulk_lookup.assert_not_called()
