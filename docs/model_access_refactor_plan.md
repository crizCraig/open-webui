# Model access refactor plan

Written 2026-09-05 during a ralph-review of the request-scoped model/group
cache (commit "Cache model records and group lookups per request for access
checks"). These are deferred restructurings, not bugs. None are scheduled.

Deployment note: in our setup every model routes through the polychat
provider, so in practice only `routers/openai.py` matters. The Ollama router
paths listed below are kept for completeness but are low priority.

## 1. Unify the model-read-access predicate into one module

**Where:** `main.py` (`get_models` inner filter), `utils/models.py`
(`check_model_access`), `routers/openai.py` (`get_filtered_models`,
`authorize_model_access`), `routers/ollama.py` (`get_filtered_models`, the
inline filter in `get_openai_models`, `authorize_model_access`).

**Problem:** Seven sites hand-roll
`user.id == model_info.user_id or has_access(user.id, "read", ...)` gated by
`user.role == "user" and not BYPASS_MODEL_ACCESS_CONTROL and not
api_key_private_model_access(request)`. They have drifted:

- `ollama.get_openai_models` omits the `api_key_private_model_access` clause.
- `ollama.authorize_model_access` returns `None` for admins on unknown models;
  `openai.authorize_model_access` 403s non-admins but returns `None` for admins.
- Only Ollama tries a `:latest` fallback.

**Proposal:** A small `utils/model_access.py` exposing
`can_read_model(request, user, model_info) -> bool`,
`authorize_model(request, user, model_id, *, bypass) -> ModelModel` (one
exception type), and `filter_readable(request, user, ids)`. It would absorb
`request_model_cache.py` as an implementation detail and let
`test_completion_access_control.py` drop its `sys.modules` stubbing.

**Scope:** ~80-line module, seven call sites, test fixture simplification.
About half a day.

**Risk:** Medium. Security code. Each behavioural divergence needs an explicit
decision, not silent smoothing. Given the polychat-only deployment, start with
the OpenAI router and main.py and treat the Ollama sites as follow-up.

## 2. Authorize once at the request boundary, carry the verdict down

**Where:** `main.chat_completion`, `utils/chat.generate_chat_completion`,
`routers/openai.generate_chat_completion_internal`,
`routers/ollama.generate_chat_completion`, and the `bypass_filter` plumbing.

**Problem:** One `/api/chat/completions` runs the access check three times
(main, utils/chat because `bypass_filter` is not forwarded, then the router).
The per-request cache mostly makes this redundancy cheap rather than removing
it.

**Proposal:** Resolve `model_info` and the authorization verdict once at the
entry point and stash it on `request.state` (precedent: `request.state.model`,
`.direct`, `.metadata`). Inner layers assert the verdict exists instead of
re-deriving it. `bypass_filter` disappears.

**Scope:** 14 `generate_chat_completion` call sites (tasks.py x7,
middleware.py x3, openai proxy, arena re-entry x2, main) each classified as
"boundary" or "already authorized". One to two days.

**Risk:** Medium-high. Inner checks are defense in depth; `routers/tasks.py`
and `utils/middleware.py` have no boundary check of their own today. Do only
after #1, and keep the inner check as an assertion rather than deleting it.

## 3. Replace `request` threading with a ContextVar per-request context

**Where:** `utils/access_control.py`, `utils/request_model_cache.py`, a new
middleware in `main.py`, the seven `request=` call sites.

**Problem:** `has_access(..., request=None)` makes a pure permission predicate
take an HTTP object, and only 7 of ~45 callers pass it. `has_permission` /
`get_permissions` (~20 call sites) also hit `Groups.get_groups_by_member_id`
and get no caching. `request.state` is an untyped grab-bag that just grew two
more underscore attributes.

**Proposal:** A `RequestContext` dataclass in a `ContextVar`, set by one
middleware and cleared on exit. Every caller in the request gets the memo
without signature changes; tests get one `reset()` hook instead of fake
`Request` objects.

**Scope:** ~100 lines, seven signatures reverted, one middleware. Half a day.

**Risk:** Low-medium. ContextVars propagate through asyncio tasks and
Starlette's threadpool, but bare threads or `BackgroundTask`s touching access
control would see an empty context. Middleware must clear on exit.

## Considered and rejected: trust `app.state.MODELS` instead of the DB

`get_all_models` already copies `access_control` into the in-memory catalog,
so `check_model_access` could skip the `Models` table. Rejected because the
catalog refreshes only on demand and per worker, so an admin revoking access
would not take effect promptly.
`test_revoked_model_access_is_rechecked_on_next_request` guards this.
