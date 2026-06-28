import yaml
from fastapi.testclient import TestClient

from app.main import app
from app.models import BuildConfig, BuildStep
from app.services.layer_discovery import resolve_build_config
from app.services.prompt_builder import build_from_config
client = TestClient(app)


def test_resolve_skips_missing_and_includes_existing(tmp_path, monkeypatch):
    layers_dir = tmp_path / "layers"
    system_dir = layers_dir / "system"
    system_dir.mkdir(parents=True)
    (system_dir / "role.md").write_text("# Role\n", encoding="utf-8")

    build_path = tmp_path / "build.yaml"
    build_path.write_text(
        yaml.dump(
            {
                "name": "Prompt",
                "build": [
                    {
                        "layer": "system",
                        "prompts": ["missing.md", "role.md"],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr("app.config.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.config.BUILD_PATH", build_path)

    config = BuildConfig(
        name="Prompt",
        build=[BuildStep(layer="system", prompts=["missing.md", "role.md"])],
    )
    resolved, warnings = resolve_build_config(config)
    assert resolved.build[0].prompts == ["role.md"]
    assert any("skipped missing" in warning for warning in warnings)
    assert build_from_config(config) == "# Role"


def test_resolve_auto_includes_unknown_layer(tmp_path, monkeypatch):
    layers_dir = tmp_path / "layers"
    growt_dir = layers_dir / "growt"
    growt_dir.mkdir(parents=True)
    (growt_dir / "rules.md").write_text("# Growth\n", encoding="utf-8")

    build_path = tmp_path / "build.yaml"
    build_path.write_text(
        yaml.dump({"name": "Prompt", "build": []}),
        encoding="utf-8",
    )

    monkeypatch.setattr("app.config.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.config.BUILD_PATH", build_path)

    config = BuildConfig(name="Prompt", build=[])
    resolved, warnings = resolve_build_config(config)
    assert len(resolved.build) == 1
    assert resolved.build[0].layer == "growt"
    assert resolved.build[0].prompts == ["rules.md"]
    assert any("generated build from disk" in warning for warning in warnings)


def test_build_prompt_api_heals_missing_references(tmp_path, monkeypatch):
    layers_dir = tmp_path / "layers"
    system_dir = layers_dir / "system"
    system_dir.mkdir(parents=True)
    (system_dir / "role.md").write_text("# Role\n", encoding="utf-8")

    build_path = tmp_path / "build.yaml"
    build_path.write_text(
        yaml.dump(
            {
                "name": "Prompt",
                "build": [{"layer": "system", "prompts": ["system_prompt.md", "role.md"]}],
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr("app.config.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.config.BUILD_PATH", build_path)
    monkeypatch.setattr("app.services.bootstrap.LAYERS_DIR", layers_dir)
    monkeypatch.setattr("app.services.yaml_loader.LAYERS_DIR", layers_dir)

    (layers_dir / "layers.yaml").write_text(
        yaml.dump({"layers": [{"id": "system", "name": "System"}]}),
        encoding="utf-8",
    )

    response = client.get("/api/build/prompt")
    assert response.status_code == 200
    data = response.json()
    assert "# Role" in data["prompt"]
    assert any("skipped missing" in warning for warning in data.get("warnings", []))

    healed = yaml.safe_load(build_path.read_text(encoding="utf-8"))
    assert healed["build"][0]["prompts"] == ["role.md"]
