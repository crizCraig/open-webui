# Security fixes — September 2026 (open-webui fork)

Companion to the polychat repo's `docs/security_fixes_2026-09.md`. Finding IDs refer to
`~/src/SECURITY_AUDIT.md` (round 1) and polychat `reports/2nd-pass-security-audit-consolidated.md`
(round 2). Branch: `benchmark-security-fixes` (from `v0.6.9-deploy`).

## What changed

| ID | Finding | Change |
|---|---|---|
| H2 | Model-ACL bypass for any `sk-` API-key caller | All six bypass sites from commit `766895c08` (`utils/chat.py`, `routers/openai.py` x2, `routers/ollama.py` x2, `main.py` x2) now go through `api_key_private_model_access(request)` in `utils/auth.py`. `check_model_access` / model filtering is enforced regardless of transport unless the new env flag `ALLOW_API_KEY_PRIVATE_MODEL_ACCESS=true` (default `false`, `env.py`) is set. |
| H4 | `NO_CC_AUTH=true` returns a synthetic user with no credential check | `env.py` raises `RuntimeError` at import when `NO_CC_AUTH` is true and `ENV != "dev"`, so the server refuses to boot outside local dev. |
| M2 | Every inbound `X-PolyChat-*` header forwarded verbatim | `get_forwarded_headers` forwards only the allowlist `FORWARDABLE_POLYCHAT_HEADERS = {"x-polychat-memory"}` (the only inbound X-PolyChat header polychat reads). |
| M3 | `/cc/api/event_logging/batch` proxied without authentication | `routers/cc.py`: `CC_NO_AUTH_PATHS` removed; every `/cc/*` path authenticates via `get_cc_user_by_authorization`. Polychat requires auth on that path too. |
| F1 / H3 (P1.1) | Identity behind the shared `POLYCHAT_API_KEY` is an unsigned header | `get_forwarded_headers` adds `X-OpenWebUI-User-Ts` (unix seconds) and `X-OpenWebUI-User-Sig` = HMAC-SHA256 hex over `"<user_id>|<email>|<ts>"`, keyed by `HMAC(WEBUI_SECRET_KEY, b"polychat-forwarded-identity-v1")`. Helper: `sign_forwarded_identity()`; test: `backend/open_webui/test/util/test_forwarded_identity.py`. Polychat verifies (`polychat/forwarded_identity.py`, `FORWARDED_IDENTITY_MODE`). |
| H1 (frontend half) | `/payment?user_id=&user_email=` links | `Sidebar/UserMenu.svelte` and `routes/pricing/+page.svelte` no longer pass `user_id`/`user_email` (only `price_id` where applicable); polychat derives the user from its cookie. The `/set-cookie` hand-off fetches in `(app)/+layout.svelte`, `pricing/+page.svelte` and (new) `UserMenu.svelte` now send `credentials: 'include'` so the cross-origin `Set-Cookie` is actually honoured. |
| A2 | `authlib==1.4.1` on the only auth path (Google OIDC) | Bumped to `authlib==1.6.12` in `pyproject.toml` and `backend/requirements.txt` (what the Dockerfile installs). `uv.lock` was left untouched: the checked-in lock is stale against `pyproject.toml`, so even `uv lock --upgrade-package authlib` re-resolves ~4.5k lines; regenerate it deliberately in a separate change. |

## Human follow-ups

1. **Deploy order:** deploy this open-webui build **before** setting polychat's
   `FORWARDED_IDENTITY_MODE=enforce`. Polychat defaults to `warn`, which logs but still serves
   unsigned identity headers; flip to `enforce` only after a clean warning-free window.
2. **`ENV`** must be set to something other than `dev` on staging/prod (the `NO_CC_AUTH` guard keys
   off it). Confirm the Cloud Run env sets `ENV=prod`.
3. **Rotate** per the audit's P0.2 runbook: `WEBUI_SECRET_KEY` (also re-keys the identity
   signature — both apps must roll together), `GOOGLE_CLIENT_SECRET`, `POLYCHAT_API_KEY`, the
   Postgres password, `DD_API_KEY`.
4. If anyone relied on API-key access to private models, set
   `ALLOW_API_KEY_PRIVATE_MODEL_ACCESS=true` deliberately (it re-opens H2 for every `sk-` caller).
5. **Not done here:** the remaining dependency bumps from the audit's A1 (fork at 0.6.9 vs
   upstream advisories), A3 (litellm) and A4 (`npm audit`, `dompurify`) tables; and Claude Code
   telemetry that arrives without an auth header will now get 401/403 on
   `/cc/api/event_logging/batch` (harmless, but watch for noise).
