"""Reuse model records within a request, never access-control decisions."""

from dataclasses import dataclass, field

from fastapi import Request

from open_webui.models.models import ModelModel, Models


def get_model_for_request(request: Request, model_id: str | None) -> ModelModel | None:
    if not isinstance(model_id, str) or not model_id:
        return None
    cache = _get_cache(request)
    if model_id not in cache.by_id:
        cache.by_id[model_id] = (
            Models.get_model_by_id(model_id) if cache.all_models is None else None
        )
    return cache.by_id[model_id]


def get_models_for_request(request: Request) -> list[ModelModel]:
    """Load the full model catalog once for list filtering and model customization."""
    cache = _get_cache(request)
    if cache.all_models is None:
        models = Models.get_all_models()
        cache.by_id.update((model.id, model) for model in models)
        cache.all_models = models
    return cache.all_models


@dataclass
class _ModelCache:
    by_id: dict[str, ModelModel | None] = field(default_factory=dict)
    all_models: list[ModelModel] | None = None


def _get_cache(request: Request) -> _ModelCache:
    cache = getattr(request.state, "_model_record_cache", None)
    if cache is None:
        cache = _ModelCache()
        request.state._model_record_cache = cache
    return cache
