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


def test_list_exports():
    response = client.get("/api/exports")
    assert response.status_code == 200
    exports = response.json()["exports"]
    assert any(item["id"] == "aituber" for item in exports)


def test_build_prompt_contains_separator():
    prompt = build_prompt("aituber")
    assert "---" in prompt
    assert "Airi" in prompt
    assert "Safety" in prompt


def test_build_prompt_order():
    prompt = build_prompt("aituber")
    role_index = prompt.index("helpful AI assistant")
    identity_index = prompt.index("Name: Airi")
    concise_index = prompt.index("Prefer short")
    assert role_index < identity_index < concise_index


def test_build_export_api():
    response = client.get("/api/exports/aituber/build")
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


def test_llm_health_not_configured():
    response = client.get("/api/llm/health")
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is False
    assert data["reachable"] is False
    assert data["error"] is not None
