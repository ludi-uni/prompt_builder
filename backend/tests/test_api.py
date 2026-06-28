from fastapi.testclient import TestClient

from app.main import app
from app.services.bootstrap import (
    ensure_layers_initialized,
    is_layers_empty,
)
from app.services.prompt_builder import build_prompt

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_layers():
    response = client.get("/api/layers")
    assert response.status_code == 200
    layers = response.json()["layers"]
    assert any(layer["id"] == "persona" for layer in layers)
    persona = next(layer for layer in layers if layer["id"] == "persona")
    assert persona.get("display_name") == "🧠 人格"


def test_get_build():
    response = client.get("/api/build")
    assert response.status_code == 200
    data = response.json()
    assert "build" in data
    assert any(step["layer"] == "persona" for step in data["build"])


def test_build_prompt_contains_separator():
    prompt = build_prompt()
    assert "---" in prompt


def test_build_prompt_order():
    config = client.get("/api/build").json()
    persona = next(step for step in config["build"] if step["layer"] == "persona")
    first_file, second_file = persona["prompts"][0], persona["prompts"][1]

    prompt = build_prompt()
    first_content = client.get(f"/api/layers/persona/files/{first_file}").json()[
        "content"
    ]
    second_content = client.get(f"/api/layers/persona/files/{second_file}").json()[
        "content"
    ]
    marker_a = first_content.strip().splitlines()[0]
    marker_b = second_content.strip().splitlines()[0]
    assert prompt.index(marker_a) < prompt.index(marker_b)


def test_build_prompt_api():
    response = client.get("/api/build/prompt")
    assert response.status_code == 200
    assert "prompt" in response.json()


def test_create_file_with_content():
    response = client.post(
        "/api/layers/system/files",
        json={"filename": "_test_import.md", "content": "# Test\n\nImported content."},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "_test_import.md"
    assert data["created"] is True

    get_response = client.get("/api/layers/system/files/_test_import.md")
    assert get_response.status_code == 200
    assert "Imported content." in get_response.json()["content"]

    client.delete("/api/layers/system/files/_test_import.md")


def test_create_file_conflict_without_overwrite():
    client.post(
        "/api/layers/system/files",
        json={"filename": "_test_conflict.md", "content": "first"},
    )
    conflict = client.post(
        "/api/layers/system/files",
        json={"filename": "_test_conflict.md", "content": "second"},
    )
    assert conflict.status_code == 409
    client.delete("/api/layers/system/files/_test_conflict.md")


def test_create_file_overwrite():
    client.post(
        "/api/layers/system/files",
        json={"filename": "_test_overwrite.md", "content": "first"},
    )
    response = client.post(
        "/api/layers/system/files",
        json={"filename": "_test_overwrite.md", "content": "second", "overwrite": True},
    )
    assert response.status_code == 201
    assert response.json()["created"] is False

    get_response = client.get("/api/layers/system/files/_test_overwrite.md")
    assert get_response.json()["content"] == "second"

    client.delete("/api/layers/system/files/_test_overwrite.md")


def test_bootstrap_empty_layers(tmp_path, monkeypatch):
    layers_dir = tmp_path / "layers"
    layers_dir.mkdir()
    (layers_dir / "layers.yaml").write_text("layers: []\n", encoding="utf-8")

    monkeypatch.setattr("app.config.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.services.bootstrap.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.services.yaml_loader.LAYERS_DIR", layers_dir)

    assert is_layers_empty() is True
    assert ensure_layers_initialized() is True
    assert (layers_dir / "system" / "role.md").exists()
    assert (layers_dir / "persona" / "identity.md").exists()
    assert ensure_layers_initialized() is False


def test_bootstrap_skips_when_markdown_exists(tmp_path, monkeypatch):
    layers_dir = tmp_path / "layers"
    custom_dir = layers_dir / "custom"
    custom_dir.mkdir(parents=True)
    (custom_dir / "note.md").write_text("# Custom\n", encoding="utf-8")
    (layers_dir / "layers.yaml").write_text("layers: []\n", encoding="utf-8")

    monkeypatch.setattr("app.config.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.services.bootstrap.LAYERS_DIR", layers_dir)

    assert is_layers_empty() is False
    assert ensure_layers_initialized() is False
    assert not (layers_dir / "system" / "role.md").exists()


def test_llm_health_not_configured(monkeypatch):
    monkeypatch.setattr("app.services.llm_runner.load_llm_config", lambda: None)
    response = client.get("/api/llm/health")
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is False
    assert data["reachable"] is False
    assert data["error"] is not None


def test_extract_message_content_reasoning_model():
    from app.services.llm_runner import (
        extract_assistant_content,
        extract_message_content,
        extract_spoken_line_from_reasoning,
    )

    assert extract_message_content(
        {"role": "assistant", "content": "hello", "reasoning_content": "think"}
    ) == "hello"
    assert extract_message_content(
        {
            "role": "assistant",
            "content": "",
            "reasoning_content": "reasoning output",
        }
    ) == "reasoning output"
    draft_reasoning = (
        '* Draft 3: やっほー\n'
        '`やっほー！アイリだよ。AITuberとして活動してるの。`'
    )
    assert (
        extract_spoken_line_from_reasoning(draft_reasoning)
        == "やっほー！アイリだよ。AITuberとして活動してるの。"
    )
    assert (
        extract_assistant_content(
            {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "reasoning_content": draft_reasoning,
                        }
                    }
                ]
            }
        )
        == "やっほー！アイリだよ。AITuberとして活動してるの。"
    )


def test_parse_llm_metrics_from_llama_response():
    from app.services.llm_runner import parse_llm_metrics

    data = {
        "usage": {
            "prompt_tokens": 185,
            "completion_tokens": 431,
            "total_tokens": 616,
        },
        "timings": {
            "prompt_ms": 2414.45,
            "predicted_ms": 59691.82,
        },
    }
    metrics = parse_llm_metrics(data, elapsed_ms=62106.0)
    assert metrics.prompt_tokens == 185
    assert metrics.completion_tokens == 431
    assert metrics.total_tokens == 616
    assert metrics.ttft_ms == 2414.4
    assert metrics.tps == 7.22
    assert metrics.total_ms == 62106.0


def test_git_baseline_api_uses_workspace_file(tmp_path, monkeypatch):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "generated_prompt.md").write_text("old prompt\n", encoding="utf-8")
    (tmp_path / ".git").mkdir()

    monkeypatch.setattr("app.services.git_baseline.ROOT", tmp_path)
    monkeypatch.setattr("app.services.git_baseline.WORKSPACE_DIR", workspace)

    response = client.get("/api/build/git-baseline")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert data["prompt"] == "old prompt\n"
    assert data["source"] == "workspace"


def test_update_build_reorder_prompts():
    original = client.get("/api/build").json()
    try:
        build = [step.copy() for step in original["build"]]
        persona = next(step for step in build if step["layer"] == "persona")
        persona["prompts"] = list(reversed(persona["prompts"]))

        response = client.put(
            "/api/build",
            json={**original, "build": build},
        )
        assert response.status_code == 200

        prompt = build_prompt()
        first_file = persona["prompts"][0]
        second_file = persona["prompts"][1]
        content_a = client.get(f"/api/layers/persona/files/{first_file}").json()[
            "content"
        ]
        content_b = client.get(f"/api/layers/persona/files/{second_file}").json()[
            "content"
        ]
        index_a = prompt.index(content_a.strip()[:20])
        index_b = prompt.index(content_b.strip()[:20])
        assert index_a < index_b
    finally:
        client.put("/api/build", json=original)


def test_git_baseline_api_not_available_without_git_or_file(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.git_baseline.ROOT", tmp_path)
    monkeypatch.setattr(
        "app.services.git_baseline.WORKSPACE_DIR",
        tmp_path / "workspace",
    )

    response = client.get("/api/build/git-baseline")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is False
    assert data["prompt"] is None
