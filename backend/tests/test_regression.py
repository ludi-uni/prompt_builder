import re

from fastapi.testclient import TestClient

from app.main import app
from app.services.regression.character_context import (
    build_in_character_pattern,
    extract_character_names,
    resolve_character_names,
)
from app.services.regression.hashing import compute_prompt_hash
from app.services.regression.llama_slots import build_case_prompt
from app.services.regression.matchers import evaluate_case, evaluate_matcher

client = TestClient(app)


def test_build_case_prompt_uses_project_separator():
    prompt = build_case_prompt("PREFIX", "こんにちは")
    assert prompt.startswith("PREFIX")
    assert prompt.endswith("こんにちは")
    assert "---" in prompt


def test_compute_prompt_hash():
    first = compute_prompt_hash("hello")
    second = compute_prompt_hash("hello")
    third = compute_prompt_hash("world")
    assert first == second
    assert first.startswith("sha256:")
    assert first != third


def test_matcher_contains():
    ok, failure = evaluate_matcher("hello world", {"type": "contains", "value": "world"})
    assert ok is True
    assert failure is None

    ok, failure = evaluate_matcher("hello", {"type": "contains", "value": "world"})
    assert ok is False
    assert failure is not None


def test_matcher_not_contains():
    ok, failure = evaluate_matcher("こんにちは", {"type": "not_contains", "value": "AI"})
    assert ok is True

    ok, failure = evaluate_matcher("AIアシスタントです", {"type": "not_contains", "value": "AI"})
    assert ok is False


def test_matcher_regex_and_length():
    ok, _ = evaluate_matcher("abc123", {"type": "regex", "pattern": r"\d+"})
    assert ok is True

    ok, _ = evaluate_matcher("short", {"type": "min_length", "value": 10})
    assert ok is False

    ok, _ = evaluate_matcher("short", {"type": "max_length", "value": 10})
    assert ok is True


def test_evaluate_case_and_logic():
    passed, failures = evaluate_case(
        "hello world",
        [
            {"type": "contains", "value": "hello"},
            {"type": "not_contains", "value": "bad"},
        ],
    )
    assert passed is True
    assert failures == []

    passed, failures = evaluate_case(
        "hello bad",
        [
            {"type": "contains", "value": "hello"},
            {"type": "not_contains", "value": "bad"},
        ],
    )
    assert passed is False
    assert len(failures) == 1


def test_regression_suites_list():
    response = client.get("/api/regression/suites")
    assert response.status_code == 200
    suites = response.json()["suites"]
    assert any(item["filename"] == "default.yaml" for item in suites)


def test_regression_snapshot_status(monkeypatch):
    monkeypatch.setattr(
        "app.services.regression.snapshot.get_current_prefix",
        lambda: "test prefix",
    )
    response = client.get("/api/regression/snapshot/status")
    assert response.status_code == 200
    data = response.json()
    assert "freshness" in data
    assert data["current"]["prompt_hash"].startswith("sha256:")


def test_regression_run_requires_llm(monkeypatch):
    monkeypatch.setattr(
        "app.services.regression.runner.get_current_prefix",
        lambda: "test prefix",
    )
    monkeypatch.setattr("app.services.llm_runner.load_llm_config", lambda: None)
    response = client.post(
        "/api/regression/run",
        json={"suite": "default.yaml", "options": {"ensure_snapshot": False}},
    )
    assert response.status_code in {409, 503}


def test_extract_character_names_from_prefix():
    prefix = "System rules\n\nName: Airi\nStay in character."
    assert extract_character_names(prefix) == ["Airi"]

    japanese = "設定\n名前：アイリ\n"
    assert extract_character_names(japanese) == ["アイリ"]


def test_resolve_character_names_priority():
    prefix = "Name: Airi"
    names, source = resolve_character_names(prefix)
    assert names == ["Airi"]
    assert source == "auto"

    names, source = resolve_character_names(prefix, override_names=["Manual"])
    assert names == ["Manual"]
    assert source == "override"

    names, source = resolve_character_names("no name here")
    assert names == []
    assert source == "missing"


def test_in_character_matcher():
    ok, failure = evaluate_matcher(
        "こんにちは、アイリです！",
        {"type": "in_character", "role_keywords": False},
        character_names=["Airi", "アイリ"],
    )
    assert ok is True
    assert failure is None

    ok, failure = evaluate_matcher(
        "はい、わかりました",
        {"type": "in_character", "role_keywords": True},
        character_names=["Airi"],
    )
    assert ok is False
    assert failure is not None
    assert failure.matcher == "in_character"

    ok, failure = evaluate_matcher(
        "配信、楽しみにしてね",
        {"type": "in_character", "role_keywords": True},
        character_names=[],
    )
    assert ok is False
    assert "not configured" in failure.message


def test_build_in_character_pattern():
    pattern = build_in_character_pattern(["Airi"], include_role_keywords=False)
    assert pattern is not None
    assert re.search(pattern, "I am Airi", re.IGNORECASE)

    pattern = build_in_character_pattern(["Airi"], include_role_keywords=True)
    assert pattern is not None
    assert re.search(pattern, "AITuber")


def test_regression_character_context_endpoint(monkeypatch):
    monkeypatch.setattr(
        "app.routers.regression.get_current_prefix",
        lambda: "Name: TestChar",
    )
    response = client.get("/api/regression/character-context")
    assert response.status_code == 200
    data = response.json()
    assert data["names"] == ["TestChar"]
    assert data["source"] == "auto"
