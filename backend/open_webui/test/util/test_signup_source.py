from open_webui.utils.signup_source import (
    SIGNUP_SOURCE_INFO_KEY,
    SIGNUP_WINDOW_SECONDS,
    clean_signup_source,
    signup_source_info_update,
    without_signup_source,
)

NOW = 1_800_000_000


def test_clean_keeps_only_utm_keys_ref_and_referrer_host():
    raw = {
        "utm_source": "ccc",
        "utm_medium": "cli",
        "utm_campaign": "launch",
        "ref": "hn",
        "referrer": "news.ycombinator.com",
        "email": "someone@example.com",
    }
    assert clean_signup_source(raw) == {
        "utm_source": "ccc",
        "utm_medium": "cli",
        "utm_campaign": "launch",
        "ref": "hn",
        "referrer": "news.ycombinator.com",
    }


def test_clean_rejects_full_referrer_urls_and_odd_values():
    assert clean_signup_source({"referrer": "https://x.com/a?b=c"}) is None
    assert clean_signup_source({"referrer": "x.com/path"}) is None
    assert clean_signup_source({"utm_source": "<script>"}) is None
    assert clean_signup_source({"utm_source": "a" * 65}) is None
    assert clean_signup_source({"utm_source": 7}) is None
    assert clean_signup_source({}) is None
    assert clean_signup_source({"referrer": "News.YCombinator.com"}) == {
        "referrer": "news.ycombinator.com"
    }
    assert clean_signup_source({"utm_campaign": "spring 2026"}) == {"utm_campaign": "spring 2026"}


def test_update_records_once_for_new_users():
    info = signup_source_info_update({"other": 1}, NOW - 60, NOW, {"utm_source": "ccc"})
    assert info == {"other": 1, SIGNUP_SOURCE_INFO_KEY: {"utm_source": "ccc", "recorded_at": NOW}}
    assert signup_source_info_update(info, NOW - 60, NOW, {"utm_source": "x"}) is None


def test_update_skips_old_accounts_and_empty_sources():
    old = NOW - SIGNUP_WINDOW_SECONDS - 1
    assert signup_source_info_update(None, old, NOW, {"utm_source": "ccc"}) is None
    assert signup_source_info_update(None, NOW, NOW, {"referrer": "a b"}) is None
    assert signup_source_info_update(None, NOW, NOW, {"ref": "hn"}) == {
        SIGNUP_SOURCE_INFO_KEY: {"ref": "hn", "recorded_at": NOW}
    }


def test_users_cannot_set_signup_source_through_info_update():
    update = {"location": "x", SIGNUP_SOURCE_INFO_KEY: {"utm_source": "<b>"}}
    assert without_signup_source(update) == {"location": "x"}
