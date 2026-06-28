from fastapi.testclient import TestClient

from app.main import app
from app.services.regression.hashing import compute_prompt_hash
from app.services.regression.matchers import evaluate_case, evaluate_matcher

client = TestClient(app)


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
